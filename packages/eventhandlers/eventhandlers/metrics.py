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
from typing import List, Optional
from aws_lambda_powertools import Logger

# Configure structured logging with Powertools
logger = Logger(service="metrics")

# Initialize CloudWatch client
cloudwatch = boto3.client("cloudwatch")

# Define CloudWatch metric namespace
METRIC_NAMESPACE = "AIGateway/TokenUsage"


def publish_token_metrics(
    model_id: str,
    input_tokens: int,
    output_tokens: int,
    latency: Optional[float] = None,
    is_cached: bool = False,
):
    """
    Publish token usage metrics to CloudWatch

    Args:
        model_id: The model ID used for the request
        input_tokens: Number of input tokens
        output_tokens: Number of output tokens
        latency: Response latency in milliseconds (if available)
        is_cached: Whether the response was from cache
    """
    total_tokens = input_tokens + output_tokens

    # Prepare metric data
    metric_data = [
        {
            "MetricName": "InputTokens",
            "Dimensions": [{"Name": "ModelId", "Value": model_id}],
            "Value": input_tokens,
            "Unit": "Count",
        },
        {
            "MetricName": "OutputTokens",
            "Dimensions": [{"Name": "ModelId", "Value": model_id}],
            "Value": output_tokens,
            "Unit": "Count",
        },
        {
            "MetricName": "TotalTokens",
            "Dimensions": [{"Name": "ModelId", "Value": model_id}],
            "Value": total_tokens,
            "Unit": "Count",
        },
    ]

    # Add cached response metric if applicable
    if is_cached:
        metric_data.append(
            {
                "MetricName": "CachedResponses",
                "Dimensions": [{"Name": "ModelId", "Value": model_id}],
                "Value": 1,
                "Unit": "Count",
            }
        )

    # Add latency metric if provided
    if latency is not None:
        metric_data.append(
            {
                "MetricName": "ResponseLatency",
                "Dimensions": [{"Name": "ModelId", "Value": model_id}],
                "Value": latency,
                "Unit": "Milliseconds",
            }
        )

    try:
        # Publish metrics to CloudWatch
        cloudwatch.put_metric_data(Namespace=METRIC_NAMESPACE, MetricData=metric_data)
        logger.debug(
            "Published token metrics to CloudWatch",
            extra={
                "model_id": model_id,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens,
                "is_cached": is_cached,
                "latency": latency,
            },
        )
    except Exception as e:
        logger.error(
            "Failed to publish token metrics to CloudWatch", extra={"error": str(e)}
        )
