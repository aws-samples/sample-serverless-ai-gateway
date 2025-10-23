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
import pytest
from unittest.mock import patch
from eventhandlers.guardrails_integration import BedrockGuardrailsIntegration


class TestBedrockGuardrailsIntegration:
    """Test cases for Bedrock Guardrails Integration"""

    def test_initialization_with_environment_variables(self):
        """Test initialization with environment variables"""
        with patch.dict(
            os.environ,
            {
                "BEDROCK_GUARDRAIL_ID": "test-guardrail-123",
                "BEDROCK_GUARDRAIL_VERSION": "2",
            },
        ):
            integration = BedrockGuardrailsIntegration()
            assert integration.guardrail_id == "test-guardrail-123"
            assert integration.guardrail_version == "2"
            assert integration.is_enabled() is True

    def test_initialization_without_environment_variables(self):
        """Test initialization without environment variables"""
        with patch.dict(os.environ, {}, clear=True):
            integration = BedrockGuardrailsIntegration()
            assert integration.guardrail_id is None
            assert integration.guardrail_version == "1"  # default
            assert integration.is_enabled() is False

    def test_initialization_with_explicit_parameters(self):
        """Test initialization with explicit parameters"""
        integration = BedrockGuardrailsIntegration(
            guardrail_id="explicit-guardrail-456", guardrail_version="3"
        )
        assert integration.guardrail_id == "explicit-guardrail-456"
        assert integration.guardrail_version == "3"
        assert integration.is_enabled() is True

    def test_apply_guardrails_when_enabled(self):
        """Test applying guardrails when enabled"""
        integration = BedrockGuardrailsIntegration(
            guardrail_id="test-guardrail-123", guardrail_version="2"
        )

        request_params = {
            "modelId": "anthropic.claude-3-5-sonnet-20240620-v1:0",
            "messages": [{"role": "user", "content": [{"text": "Hello"}]}],
            "inferenceConfig": {"maxTokens": 512},
        }

        result = integration.apply_guardrails_to_converse_request(request_params)

        # Check that guardrails config was added
        assert "guardrailConfig" in result
        assert result["guardrailConfig"]["guardrailIdentifier"] == "test-guardrail-123"
        assert result["guardrailConfig"]["guardrailVersion"] == "2"
        assert result["guardrailConfig"]["streamProcessingMode"] == "sync"

        # Check that original params are preserved
        assert result["modelId"] == "anthropic.claude-3-5-sonnet-20240620-v1:0"
        assert result["messages"] == [{"role": "user", "content": [{"text": "Hello"}]}]
        assert result["inferenceConfig"]["maxTokens"] == 512

    def test_apply_guardrails_when_disabled(self):
        """Test applying guardrails when disabled"""
        integration = BedrockGuardrailsIntegration()  # No guardrail ID

        request_params = {
            "modelId": "anthropic.claude-3-5-sonnet-20240620-v1:0",
            "messages": [{"role": "user", "content": [{"text": "Hello"}]}],
            "inferenceConfig": {"maxTokens": 512},
        }

        result = integration.apply_guardrails_to_converse_request(request_params)

        # Check that no guardrails config was added
        assert "guardrailConfig" not in result

        # Check that original params are unchanged
        assert result == request_params

    def test_get_guardrail_info_when_enabled(self):
        """Test getting guardrail info when enabled"""
        integration = BedrockGuardrailsIntegration(
            guardrail_id="test-guardrail-123", guardrail_version="2"
        )

        info = integration.get_guardrail_info()

        assert info["guardrail_id"] == "test-guardrail-123"
        assert info["guardrail_version"] == "2"

    def test_get_guardrail_info_when_disabled(self):
        """Test getting guardrail info when disabled"""
        integration = BedrockGuardrailsIntegration()  # No guardrail ID

        info = integration.get_guardrail_info()

        assert info["guardrail_id"] is None
        assert info["guardrail_version"] == "1"  # default

    def test_is_enabled_logic(self):
        """Test the is_enabled logic"""
        # Enabled with guardrail ID
        integration_enabled = BedrockGuardrailsIntegration(
            guardrail_id="test-guardrail-123"
        )
        assert integration_enabled.is_enabled() is True

        # Disabled without guardrail ID
        integration_disabled = BedrockGuardrailsIntegration(guardrail_id=None)
        assert integration_disabled.is_enabled() is False

        # Disabled with empty string
        integration_empty = BedrockGuardrailsIntegration(guardrail_id="")
        assert integration_empty.is_enabled() is False
