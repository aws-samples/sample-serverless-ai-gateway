import json
import os

from aws_lambda_powertools import Logger
from eventhandlers.auth import validate_channel_auth

# Configure structured logging with Powertools
logger = Logger(service="eventhandlers")


def lambda_handler(event, context):
    """
    Lambda function that checks if the first channel segment matches the user's sub.
    Returns None if it matches or an error message otherwise.

    Args:
        event: The Lambda event object
        context: The Lambda context object

    Returns:
        None if the subscription is allowed, or an error message if not
    """
    # Set correlation ID for request tracing
    logger.set_correlation_id(context.aws_request_id)

    # Validate channel authorization
    _, _, _, error_message = validate_channel_auth(event, return_error_message=True)

    # https://docs.aws.amazon.com/appsync/latest/eventapi/writing-event-handlers.html#direct-lambda-integration
    # type LambdaAppSyncEventResponse = {
    #   /** Error message if subscription fails */
    #   error: string
    # } | null

    return error_message
