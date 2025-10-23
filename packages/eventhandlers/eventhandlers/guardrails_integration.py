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

import os
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class BedrockGuardrailsIntegration:
    """Integration class for Amazon Bedrock Guardrails"""

    def __init__(
        self,
        guardrail_id: Optional[str] = None,
        guardrail_version: Optional[str] = None,
    ):
        self.guardrail_id = guardrail_id or os.environ.get("BEDROCK_GUARDRAIL_ID")
        self.guardrail_version = guardrail_version or os.environ.get(
            "BEDROCK_GUARDRAIL_VERSION", "1"
        )

        if self.guardrail_id:
            logger.info(
                "Guardrails integration initialized",
                extra={
                    "guardrail_id": self.guardrail_id,
                    "guardrail_version": self.guardrail_version,
                },
            )
        else:
            logger.info("No guardrail configuration found, guardrails disabled")

    def is_enabled(self) -> bool:
        """Check if guardrails are enabled"""
        return bool(self.guardrail_id)

    def apply_guardrails_to_converse_request(
        self, request_params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Apply guardrails configuration to a Bedrock Converse request

        Args:
            request_params: The request parameters dictionary for bedrock.converse_stream()

        Returns:
            Updated request parameters with guardrails configuration
        """
        if not self.is_enabled():
            logger.debug("Guardrails not enabled, skipping configuration")
            return request_params

        # Add guardrails configuration to the request
        request_params["guardrailConfig"] = {
            "guardrailIdentifier": self.guardrail_id,
            "guardrailVersion": self.guardrail_version,
            "streamProcessingMode": "sync",
        }

        logger.info(
            "Applied guardrails to Bedrock request",
            extra={
                "guardrail_id": self.guardrail_id,
                "guardrail_version": self.guardrail_version,
            },
        )

        return request_params

    def get_guardrail_info(self) -> Dict[str, Optional[str]]:
        """
        Get guardrail information for logging

        Returns:
            Dictionary with guardrail ID and version
        """
        return {
            "guardrail_id": self.guardrail_id,
            "guardrail_version": self.guardrail_version,
        }
