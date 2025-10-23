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

from typing import Dict, Any, Tuple, Optional, Union
from aws_lambda_powertools import Logger

# Configure structured logging with Powertools
logger = Logger(service="eventhandlers")


def validate_channel_auth(
    event: Dict[str, Any], return_error_message: bool = False
) -> Union[
    Tuple[bool, Optional[str], Optional[str]],
    Tuple[bool, Optional[str], Optional[str], str],
]:
    """
    Validates that the user is authorized to access the channel.

    Args:
        event: The Lambda event object
        return_error_message: Whether to return an error message for AppSync subscription handlers

    Returns:
        If return_error_message is False:
            Tuple of (is_authorized, sub, path)
            - is_authorized: True if the user is authorized, False otherwise
            - sub: The user's sub, or None if not available
            - path: The channel path, or None if not available

        If return_error_message is True:
            Tuple of (is_authorized, sub, path, error_message)
            - is_authorized: True if the user is authorized, False otherwise
            - sub: The user's sub, or None if not available
            - path: The channel path, or None if not available
            - error_message: Error message for AppSync subscription handlers, or None if authorized
    """
    # Extract segments and sub from the event
    segments = event.get("info", {}).get("channel", {}).get("segments")
    sub = event.get("identity", {}).get("sub", None)

    # Check if segments exist and have at least 2 elements
    if not segments or len(segments) < 2:
        logger.error("No segments found in event", extra={"event_type": "auth_error"})
        if return_error_message:
            return False, sub, None, "No segments found in channel path"
        return False, sub, None

    # Check if the sub matches the first segment
    if sub != segments[1]:
        logger.warning(
            "Unauthorized access attempt",
            extra={"sub": sub, "path_segment": segments[1], "reason": "sub_mismatch"},
        )
        if return_error_message:
            return False, sub, None, "Unauthorized"
        return False, sub, None

    # User is authorized
    path = "/".join(segments[1:])
    logger.info(
        "User authorized", extra={"sub": sub, "path_segment": segments[1], "path": path}
    )

    if return_error_message:
        return True, sub, path, None
    return True, sub, path
