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

import boto3
import json
import datetime
from typing import Dict, List, Literal

from aws_lambda_powertools import Logger

import os
from pydantic import BaseModel, Field

logger = Logger(service="messages")
firehose = boto3.client("firehose")


class MessageTracker:
    """
    Tracks message state during processing to provide enhanced logging.
    Handles event type detection and processing internally.
    """

    def __init__(
        self, user_id: str, conversation_id: str, user_message: str, model_id: str
    ):
        self.user_id = user_id
        self.conversation_id = conversation_id
        self.user_message = user_message
        self.assistant_response = ""
        self.input_tokens = 0
        self.output_tokens = 0
        self.metadata_processed = False
        self.model_id = model_id

    def process_stream_event(self, stream_event: Dict) -> bool:
        """
        Process a stream event, updating internal state as needed.
        Returns True if this was a metadata event that was processed.
        """
        # Check if this is a metadata event with token usage
        if (
            "metadata" in stream_event
            and "usage" in stream_event["metadata"]
            and not self.metadata_processed
        ):
            self.metadata_processed = True
            usage = stream_event["metadata"]["usage"]
            self.input_tokens = usage.get("inputTokens", 0)
            self.output_tokens = usage.get("outputTokens", 0)

            # Log completion since metadata is the last meaningful event
            self.log_completion()
            return True

        # Track assistant response from content block deltas
        if "contentBlockDelta" in stream_event:
            delta = stream_event["contentBlockDelta"].get("delta", {})
            if "text" in delta:
                self.assistant_response += delta["text"]

        return False

    def log_completion(self):
        """Log complete information about the conversation turn"""
        # Get current timestamp
        now = datetime.datetime.now()

        # Prepare log data
        log_data = {
            "user_id": self.user_id,
            "conversation_id": self.conversation_id,
            "model_id": self.model_id,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "user_message": self.user_message[:100]
            + ("..." if len(self.user_message) > 100 else ""),
            "assistant_response_length": len(self.assistant_response),
            "assistant_response_preview": self.assistant_response[:100]
            + ("..." if len(self.assistant_response) > 100 else ""),
            "timestamp": now.strftime("%Y-%m-%d %H:%M:%S"),
            "year": now.strftime("%Y"),
            "month": now.strftime("%m"),
            "day": now.strftime("%d"),
        }

        # Log to CloudWatch
        logger.info("Message complete", extra=log_data)

        # Send to Firehose if configured
        firehose_stream = os.environ.get("FIREHOSE_DELIVERY_STREAM")
        if firehose_stream:
            try:
                firehose.put_record(
                    DeliveryStreamName=firehose_stream,
                    Record={"Data": json.dumps(log_data) + "\n"},
                )
                logger.debug(
                    f"Successfully sent data to Firehose stream: {firehose_stream}"
                )
            except Exception as e:
                logger.error(f"Failed to send data to Firehose: {str(e)}")


# Pydantic models for Bedrock Converse Message format
class ContentItem(BaseModel):
    """Represents a single text item in a message."""

    text: str


class Message(BaseModel):
    """Represents a message in the conversation."""

    role: Literal["user", "assistant"]
    content: List[ContentItem]


class ConverseMessages(BaseModel):
    """Represents a list of messages in a conversation."""

    messages: List[Message] = Field(default_factory=list)
    modelId: str = None
    conversationId: str = None
