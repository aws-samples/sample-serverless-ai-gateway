"""
Copyright 2025 Amazon.com, Inc. and its affiliates. All Rights Reserved.

Licensed under the Amazon Software License (the "License").
You may not use this file except in compliance with the License.
A copy of the License is located at

  http://aws.amazon.com/asl/

or in the "license" file accompanying this file. This file is distributed
on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
express or implied. See the License for the specific language governing
permissions and limitations under the License.
"""

import json
import time
from typing import Dict

import boto3
import requests
import urllib3
from aws_lambda_powertools import Logger
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest
import os

from .token_meter import TokenLimiter
from .auth import validate_channel_auth
from .response_cache import ResponseCache
from .messages import ConverseMessages, MessageTracker
from .metrics import publish_token_metrics
from .guardrails_integration import BedrockGuardrailsIntegration


# Configure structured logging with Powertools
logger = Logger(service="eventhandlers")

# Initialize clients
http = urllib3.PoolManager()
bedrock = boto3.client("bedrock-runtime")
token_limiter = TokenLimiter()
response_cache = ResponseCache()
guardrails_integration = BedrockGuardrailsIntegration()

session = boto3.Session()
credentials = session.get_credentials()


def send_iam_signed_request(url, method="POST", body=None, region=None):
    """
    Send an IAM signed request to an HTTP endpoint

    Args:
        url: The endpoint URL
        method: HTTP method (GET, POST, etc.)
        body: Request body (dictionary)
        region: AWS region

    Returns:
        Response from the endpoint
    """
    # Create the request
    request = AWSRequest(
        method=method, url=url, data=json.dumps(body) if body else None
    )

    # Add necessary headers
    request.headers["Content-Type"] = "application/json"

    # Sign the request with SigV4
    SigV4Auth(credentials, "appsync", region).add_auth(request)

    # Convert AWSRequest to a regular request
    prepared_request = request.prepare()

    # Send the request
    response = requests.request(
        method=prepared_request.method,
        url=prepared_request.url,
        headers=dict(prepared_request.headers),
        data=prepared_request.body,
    )

    return response


# Example usage for AppSync Events API
def publish_to_channel(payload, api_endpoint, region):
    """
    Publish a message to an AppSync Events API channel using IAM authentication
    """
    # Send the signed request
    response = send_iam_signed_request(
        url=api_endpoint,
        method="POST",
        body=payload,
        region=region,
    )

    if not response.ok:
        logger.error(
            "Failed to publish to channel",
            extra={"status_code": response.status_code, "response_text": response.text},
        )

    return response


def send_error_event(
    error_type: str,
    message: str,
    request_id: str,
    path: str,
    api_endpoint: str,
    response_channel: str,
    region: str,
    conversation_id: str = None,
    details: dict = None,
):
    """
    Send a structured error event to the frontend

    Args:
        error_type: Type of error (e.g., 'validation_error', 'bedrock_api_error')
        message: Human-readable error message
        request_id: Lambda request ID for log correlation
        path: Response channel path
        api_endpoint: AppSync API endpoint
        response_channel: Response channel name
        region: AWS region
        conversation_id: Optional conversation ID
        details: Optional additional error details
    """
    error_event = {
        "error": {
            "type": error_type,
            "message": message,
            "requestId": request_id,
        }
    }

    if details:
        error_event["error"]["details"] = details

    if conversation_id:
        error_event["conversationId"] = conversation_id

    payload = {
        "channel": f"/{response_channel}/{path}",
        "events": [json.dumps(error_event)],
    }

    logger.error(
        "Sending error event to frontend",
        extra={
            "error_type": error_type,
            "error_message": message,
            "request_id": request_id,
            "conversation_id": conversation_id,
        },
    )

    publish_to_channel(payload, api_endpoint, region)


def lambda_handler(event, context):
    """
    Lambda handler for processing chat events from AppSync Events API

    Args:
        event: The Lambda event object
        context: The Lambda context object

    Returns:
        None
    """
    # Set correlation ID for request tracing
    logger.set_correlation_id(context.aws_request_id)

    # Initialize variables for cleanup in finally block
    reservation_id = None
    sub = None
    path = None

    # Get environment variables
    api_endpoint = os.environ.get("APPSYNC_ENDPOINT_URL", "")
    if not api_endpoint.startswith("https://"):
        api_endpoint = f"https://{api_endpoint}/event"
    response_channel = os.environ.get("RESPONSE_CHANNEL", "Outbound-Messages")
    region = os.environ.get("AWS_REGION", "us-east-1")
    default_model_id = os.environ.get(
        "DEFAULT_MODEL_ID", "us.anthropic.claude-opus-4-1-20250805-v1:0"
    )

    try:
        # Validate channel authorization
        is_authorized, sub, path = validate_channel_auth(event)
        if not is_authorized:
            return

        # Check if the user has exceeded their limits before processing
        # Also get current token usage from DynamoDB
        is_exceeded, token_type, period, token_usage = token_limiter.is_limit_exceeded(
            sub
        )
        if is_exceeded:
            # Send a limit exceeded event with more specific information
            limit_message = f"You have exceeded your {period} {token_type} token limit."
            limit_event = {
                "error": {
                    "type": "token_limit_exceeded",
                    "message": limit_message,
                    "requestId": context.aws_request_id,
                    "details": {
                        "tokenType": token_type,
                        "period": period,
                        "tokenUsage": token_usage,
                    },
                }
            }
            payload = {
                "channel": f"/{response_channel}/{path}",
                "events": [json.dumps(limit_event)],
            }
            publish_to_channel(payload, api_endpoint, region)
            return

        # Create a reservation to prevent race conditions
        # This reserves 50% of daily output limit to prevent concurrent requests from exceeding limits
        reservation_id = token_limiter.create_reservation(sub)
        if reservation_id is None:
            # Could not create reservation - likely would exceed limits
            limit_message = "Request denied to prevent exceeding daily output token limits due to concurrent usage."
            send_error_event(
                error_type="reservation_failed",
                message=limit_message,
                request_id=context.aws_request_id,
                path=path,
                api_endpoint=api_endpoint,
                response_channel=response_channel,
                region=region,
                details={
                    "tokenType": "output",
                    "period": "daily",
                    "tokenUsage": token_usage,
                },
            )
            return

        logger.info(
            "Created token reservation for request",
            extra={
                "user_id": sub,
                "reservation_id": reservation_id,
            },
        )

        for item in event.get("events", []):
            logger.info(
                "Processing incoming event",
                extra={"event_type": str(type(item).__name__)},
            )

            # Parse the payload as a ConverseMessages structure
            try:
                # Parse the JSON string into a list of message dicts
                # Validate and convert to ConverseMessages model using model_validate
                converse_messages = ConverseMessages.model_validate(
                    json.loads(item.get("payload"))
                )
                process_message(
                    converse_messages,
                    path,
                    api_endpoint,
                    response_channel,
                    default_model_id,
                    region,
                    token_usage,
                    reservation_id,
                    context.aws_request_id,
                )
            except json.JSONDecodeError as e:
                send_error_event(
                    error_type="json_parse_error",
                    message="Invalid JSON format in request payload",
                    request_id=context.aws_request_id,
                    path=path,
                    api_endpoint=api_endpoint,
                    response_channel=response_channel,
                    region=region,
                    details={"parse_error": str(e)},
                )
            except Exception as e:
                send_error_event(
                    error_type="validation_error",
                    message="Failed to validate request payload",
                    request_id=context.aws_request_id,
                    path=path,
                    api_endpoint=api_endpoint,
                    response_channel=response_channel,
                    region=region,
                    details={"validation_error": str(e)},
                )

    except Exception as e:
        # Catch any unexpected errors at the top level
        logger.error(
            "Unexpected error in lambda handler",
            extra={"error_message": str(e), "request_id": context.aws_request_id},
        )
        # Try to send error event - path and api_endpoint are always defined by this point
        try:
            send_error_event(
                error_type="internal_server_error",
                message="An unexpected error occurred while processing your request",
                request_id=context.aws_request_id,
                path=path,
                api_endpoint=api_endpoint,
                response_channel=response_channel,
                region=region,
                details={"error": str(e)},
            )
        except Exception as send_error:
            # If we can't send the error event, just log it
            logger.error(
                "Failed to send error event for unexpected error",
                extra={"send_error": str(send_error)},
            )

    finally:
        # Always clean up the reservation when the request completes, regardless of success or failure
        if reservation_id:
            success = token_limiter.remove_reservation(sub, reservation_id)
            if success:
                logger.info(
                    "Cleaned up token reservation in lambda handler",
                    extra={
                        "user_id": sub,
                        "reservation_id": reservation_id,
                    },
                )
            else:
                logger.warning(
                    "Failed to clean up token reservation in lambda handler",
                    extra={
                        "user_id": sub,
                        "reservation_id": reservation_id,
                    },
                )


def process_message(
    converse_messages: ConverseMessages,
    path: str,
    api_endpoint: str,
    response_channel: str,
    default_model_id: str,
    region: str,
    token_usage: Dict[str, int],
    reservation_id: str = None,
    request_id: str = None,
):
    """
    Process a message from the AppSync Events API

    Args:
        converse_messages: The ConverseMessages object
        path: The path for the response channel
        api_endpoint: The AppSync API endpoint
        response_channel: The response channel name
        default_model_id: The default model ID to use
        region: The AWS region
        token_usage: Token usage information
        reservation_id: Token reservation ID
        request_id: Lambda request ID for error correlation

    Returns:
        None
    """
    # Start timing for latency measurement
    start_time = time.time()
    # Extract messages from the ConverseMessages model
    messages = converse_messages.model_dump()

    # Use the model ID from the request or fall back to the default
    model_id = messages.get("modelId") or default_model_id

    # Get guardrail info for logging
    guardrail_info = guardrails_integration.get_guardrail_info()

    logger.info(
        "Model selected for conversation",
        extra={"model_id": model_id, **guardrail_info},
    )

    # Extract conversation ID
    conversation_id = messages.get("conversationId")
    logger.info(
        "Processing conversation",
        extra={"conversation_id": conversation_id or "unknown", **guardrail_info},
    )

    # Extract user ID from path
    path_segments = path.split("/")
    if not path_segments or not path_segments[0]:
        logger.error("Invalid path format", extra={"path": path})
        return
    user_id = path_segments[0]

    # Extract the most recent user message
    user_messages = [
        msg for msg in messages.get("messages", []) if msg.get("role") == "user"
    ]
    most_recent_user_message = ""
    if user_messages:
        # Get the content from the most recent user message
        content = user_messages[-1].get("content", [])
        if content and isinstance(content, list):
            most_recent_user_message = " ".join(
                [item.get("text", "") for item in content]
            )

    # Check for error simulation trigger
    if ":::simulate-errors:::" in most_recent_user_message:
        logger.info(
            "Simulating error for testing purposes",
            extra={
                "user_id": user_id,
                "conversation_id": conversation_id,
                "request_id": request_id,
            },
        )
        raise Exception("Simulated error for testing error handling system")

    # Check if we have a cached response for this exact prompt
    cached_response = None
    if most_recent_user_message:
        try:
            cached_response, prompt_hash = response_cache.get_cached_response(
                most_recent_user_message
            )
            if cached_response:
                logger.info(
                    "Using cached response for prompt",
                    extra={"prompt": most_recent_user_message[:50]},
                )

                # Create a simple content block delta event with the cached response
                content_event = {
                    "contentBlockDelta": {"delta": {"text": cached_response}}
                }

                # Add conversation ID to the event if available
                if conversation_id:
                    content_event["conversationId"] = conversation_id

                # Publish the cached response
                payload = {
                    "channel": f"/{response_channel}/{path}",
                    "events": [json.dumps(content_event)],
                }

                logger.info("Found cache for prompt")
                publish_to_channel(payload, api_endpoint, region)

                # Send a messageStop event to signal completion
                message_stop_event = {"messageStop": True}

                # Add conversation ID to the event if available
                if conversation_id:
                    message_stop_event["conversationId"] = conversation_id

                # Publish the messageStop event
                payload = {
                    "channel": f"/{response_channel}/{path}",
                    "events": [json.dumps(message_stop_event)],
                }

                logger.info("Sending completion event for cached response")
                publish_to_channel(payload, api_endpoint, region)

                # Calculate latency for cached response
                latency_ms = (time.time() - start_time) * 1000

                # Publish metrics for cached response
                # For cached responses, we don't have token counts, so we use estimates
                # based on the length of the response and prompt
                estimated_input_tokens = len(most_recent_user_message.split()) // 3
                estimated_output_tokens = len(cached_response.split()) // 3

                publish_token_metrics(
                    model_id=model_id,
                    input_tokens=estimated_input_tokens,
                    output_tokens=estimated_output_tokens,
                    latency=latency_ms,
                    is_cached=True,
                )

                # Clean up reservation for cached response
                if reservation_id:
                    success = token_limiter.remove_reservation(user_id, reservation_id)
                    if success:
                        logger.info(
                            "Cleaned up token reservation for cached response",
                            extra={
                                "user_id": user_id,
                                "reservation_id": reservation_id,
                            },
                        )

                # Return early since we've handled the response
                return
            else:
                logger.info(
                    "No cached response found for prompt",
                    extra={
                        "prompt_hash": prompt_hash,
                    },
                )
        except Exception as e:
            logger.error(f"Error checking response cache: {str(e)}")
            # Continue with normal processing if cache check fails
            cached_response = None

    try:
        # Create message tracker
        tracker = MessageTracker(
            user_id=user_id,
            conversation_id=conversation_id or "unknown",
            user_message=most_recent_user_message,
            model_id=model_id,
        )

        # Prepare request parameters for Bedrock
        request_params = {
            "modelId": model_id,
            "messages": messages.get("messages"),
            "inferenceConfig": {"maxTokens": 512, "temperature": 0.5, "topP": 0.9},
        }

        # Apply guardrails configuration if enabled
        request_params = guardrails_integration.apply_guardrails_to_converse_request(
            request_params
        )

        # Call Bedrock with guardrails applied
        response = bedrock.converse_stream(**request_params)

        logger.info(
            "Publishing to channel", extra={"channel": f"/{response_channel}/{path}"}
        )

        for stream_event in response.get("stream", []):
            # Let the tracker process the event and update its state
            is_metadata = tracker.process_stream_event(stream_event)

            # If this was a metadata event, update token usage in the database
            if is_metadata:
                token_limiter.update_usage(
                    user_id, tracker.input_tokens, tracker.output_tokens
                )

                # Calculate latency for the response
                latency_ms = (time.time() - start_time) * 1000

                # Publish metrics to CloudWatch
                publish_token_metrics(
                    model_id=model_id,
                    input_tokens=tracker.input_tokens,
                    output_tokens=tracker.output_tokens,
                    latency=latency_ms,
                    is_cached=False,
                )

            # Add conversation ID to the stream event if available
            if conversation_id:
                stream_event["conversationId"] = conversation_id

            # Add token limit and usage data to metadata events
            if "metadata" in stream_event and "usage" in stream_event["metadata"]:
                # Get token limit from environment variable or use default
                token_limit = int(os.environ.get("TOKEN_LIMIT", 8000))

                # Get current usage from the event
                current_usage = stream_event["metadata"]["usage"]
                input_tokens = current_usage.get("inputTokens", 0)
                output_tokens = current_usage.get("outputTokens", 0)

                # Get meter limits from the token limiter
                meter_limits = token_limiter.get_meter_limits()

                # Combine with the token usage from DynamoDB
                # We add the current usage to the DynamoDB values since they might not be updated yet
                combined_usage = {
                    "tokenLimit": token_limit,
                    "meterLimits": meter_limits,  # Include all meter limits
                    "currentUsage": {
                        "inputTokens": input_tokens,
                        "outputTokens": output_tokens,
                        "totalTokens": input_tokens + output_tokens,
                    },
                    "totalUsage": {
                        "inputTokens": token_usage["input_tokens"] + input_tokens,
                        "outputTokens": token_usage["output_tokens"] + output_tokens,
                        "dailyInputTokens": token_usage["daily_input_tokens"]
                        + input_tokens,
                        "dailyOutputTokens": token_usage["daily_output_tokens"]
                        + output_tokens,
                        "monthlyInputTokens": token_usage["monthly_input_tokens"]
                        + input_tokens,
                        "monthlyOutputTokens": token_usage["monthly_output_tokens"]
                        + output_tokens,
                    },
                }

                # Add the combined usage data to the event
                stream_event["tokenUsage"] = combined_usage

            payload = {
                "channel": f"/{response_channel}/{path}",
                "events": [json.dumps(stream_event)],
            }

            publish_to_channel(payload, api_endpoint, region)

    except Exception as e:
        # Handle Bedrock API errors and other processing errors
        error_message = "Failed to generate response from AI model"
        error_details = {"error": str(e)}

        # Check for specific error types
        if "ValidationException" in str(e):
            error_message = "Invalid request parameters for AI model"
            error_type = "bedrock_validation_error"
        elif "ThrottlingException" in str(e):
            error_message = "AI model is currently busy. Please try again in a moment"
            error_type = "bedrock_throttling_error"
        elif "AccessDeniedException" in str(e):
            error_message = "Access denied to AI model"
            error_type = "bedrock_access_denied"
        elif "ModelNotReadyException" in str(e):
            error_message = "AI model is not ready. Please try again later"
            error_type = "bedrock_model_not_ready"
        else:
            error_type = "bedrock_api_error"

        logger.error(
            "Error in message processing",
            extra={
                "error": str(e),
                "model_id": model_id,
                "user_id": user_id,
                "conversation_id": conversation_id,
                "request_id": request_id,
                "error_message": error_message,
                "error_type": error_type,
            },
        )

        # Send error event to frontend
        send_error_event(
            error_type=error_type,
            message=error_message,
            request_id=request_id or "unknown",
            path=path,
            api_endpoint=api_endpoint,
            response_channel=response_channel,
            region=region,
            conversation_id=conversation_id,
            details=error_details,
        )

    finally:
        # Always clean up the reservation when the request completes
        if reservation_id:
            success = token_limiter.remove_reservation(user_id, reservation_id)
            if success:
                logger.info(
                    "Cleaned up token reservation",
                    extra={
                        "user_id": user_id,
                        "reservation_id": reservation_id,
                    },
                )
            else:
                logger.warning(
                    "Failed to clean up token reservation",
                    extra={
                        "user_id": user_id,
                        "reservation_id": reservation_id,
                    },
                )
