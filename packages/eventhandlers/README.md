# Event Handlers

Lambda functions for handling events in the AI Gateway application.

## Overview

This package contains Lambda functions that handle various events in the AI Gateway, including:

- Processing chat messages
- Token usage tracking and rate limiting
- Response caching
- Authentication and authorization

## CloudWatch Metrics

The event handlers now publish CloudWatch metrics to track token usage and performance. These metrics can be used to monitor:

- Input and output token usage by model
- Response latency
- Cache hit rates

For detailed information about the available metrics, dimensions, and implementation details, see the [METRICS.md](./METRICS.md) file.

## Usage

The event handlers are deployed as part of the AI Gateway application. They are triggered by events from the AppSync Events API and interact with various AWS services, including:

- Amazon Bedrock for AI model inference
- DynamoDB for token usage tracking
- CloudWatch for metrics and logging
- Firehose for data streaming (optional)
