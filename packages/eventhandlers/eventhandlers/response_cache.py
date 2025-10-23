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

import hashlib
import json
import time
import boto3
import os
from typing import Dict, List, Optional, Any

from aws_lambda_powertools import Logger

# Configure structured logging with Powertools
logger = Logger(service="eventhandlers")


class ResponseCache:
    """
    A class for caching and retrieving responses to user prompts using DynamoDB.
    """

    def __init__(self, dynamodb_client=None, table_name: Optional[str] = None):
        """
        Initialize the ResponseCache with a DynamoDB client and table name.

        Args:
            dynamodb_client: Optional boto3 DynamoDB client
            table_name: Optional DynamoDB table name (defaults to env var RESPONSE_CACHE_TABLE)
        """
        self.dynamodb = dynamodb_client or boto3.client("dynamodb")
        self.table_name = table_name or os.environ.get("RESPONSE_CACHE_TABLE")
        if not self.table_name:
            raise ValueError("RESPONSE_CACHE_TABLE environment variable must be set")
        self.ttl_days = 30  # Cache responses for 30 days by default

    def _hash_prompt(self, prompt: str) -> str:
        """
        Create a hash of the prompt to use as the partition key.

        Args:
            prompt: The user prompt to hash

        Returns:
            A SHA-256 hash of the prompt as a hexadecimal string
        """
        return hashlib.sha256(prompt.encode("utf-8")).hexdigest()

    def get_cached_response(self, prompt: str) -> Optional[str]:
        """
        Check if a response exists in the cache for this prompt.

        Args:
            prompt: The user prompt to check

        Returns:
            The cached response as a string, or None if not found
        """
        prompt_hash = self._hash_prompt(prompt)

        try:
            response = self.dynamodb.get_item(
                TableName=self.table_name, Key={"prompt_hash": {"S": prompt_hash}}
            )

            item = response.get("Item")
            if not item:
                return None, prompt_hash

            # Verify the prompt text matches exactly (in case of hash collision)
            stored_prompt = item.get("prompt_text", {}).get("S")

            if stored_prompt == prompt:
                # Return the cached response as a string
                return item.get("response", {}).get("S"), prompt_hash

            return None, prompt_hash
        except Exception as e:
            logger.error(
                "Error retrieving cached response",
                extra={"error": str(e), "prompt_hash": prompt_hash},
            )
            return None, prompt_hash

    def cache_response(self, prompt: str, response: str) -> bool:
        """
        Cache a response for a prompt.

        Args:
            prompt: The user prompt
            response: The response as a string

        Returns:
            True if the response was cached successfully, False otherwise
        """
        prompt_hash = self._hash_prompt(prompt)

        try:
            # Calculate TTL (30 days from now)
            ttl = int(time.time()) + (self.ttl_days * 24 * 60 * 60)

            self.dynamodb.put_item(
                TableName=self.table_name,
                Item={
                    "prompt_hash": {"S": prompt_hash},
                    "prompt_text": {"S": prompt},
                    "response": {"S": response},
                    "ttl": {"N": str(ttl)},
                },
            )
            return True
        except Exception as e:
            logger.error(
                "Error caching response",
                extra={"error": str(e), "prompt_hash": prompt_hash},
            )
            return False

    def scan_cache(self, limit=100) -> List[Dict]:
        """Scan the cache table and return all entries."""
        try:
            response = self.dynamodb.scan(TableName=self.table_name, Limit=limit)

            items = response.get("Items", [])
            result = []

            for item in items:
                result.append(
                    {
                        "prompt_hash": item.get("prompt_hash", {}).get("S", ""),
                        "prompt_text": item.get("prompt_text", {}).get("S", ""),
                        "response": item.get("response", {}).get("S", ""),
                        "ttl": item.get("ttl", {}).get("N", ""),
                    }
                )

            return result
        except Exception as e:
            print(f"Error scanning cache: {str(e)}")
            return []
