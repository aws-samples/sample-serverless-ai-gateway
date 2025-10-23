# CloudWatch Metrics for Token Usage

This document describes the CloudWatch metrics that are published by the AI Gateway to track token usage and performance.

## Metrics Namespace

All metrics are published under the `AIGateway/TokenUsage` namespace.

## Available Metrics

| Metric Name     | Description                                                    | Unit         | Dimensions |
| --------------- | -------------------------------------------------------------- | ------------ | ---------- |
| InputTokens     | Number of input tokens used in a request                       | Count        | ModelId    |
| OutputTokens    | Number of output tokens generated in a response                | Count        | ModelId    |
| TotalTokens     | Total tokens (input + output) used in a request/response cycle | Count        | ModelId    |
| CachedResponses | Count of responses served from cache                           | Count        | ModelId    |
| ResponseLatency | Time taken to process a request and generate a response        | Milliseconds | ModelId    |

## Dimensions

| Dimension | Description                                                                                   |
| --------- | --------------------------------------------------------------------------------------------- |
| ModelId   | The ID of the model used for the request (e.g., "us.anthropic.claude-opus-4-1-20250805-v1:0") |

## Metric Details

### InputTokens

This metric tracks the number of input tokens used in each request. Input tokens are counted based on the user's message and any context provided to the model.

### OutputTokens

This metric tracks the number of output tokens generated in each response. Output tokens are counted based on the model's response.

### TotalTokens

This metric represents the sum of input and output tokens for each request/response cycle.

### CachedResponses

This metric counts the number of responses that were served from the cache instead of making a call to the model. This is useful for tracking cache hit rates and effectiveness.

### ResponseLatency

This metric measures the time taken (in milliseconds) from when a request is received until the response is fully generated. For cached responses, this represents the time to retrieve and serve the cached response.

## Viewing Metrics

You can view these metrics in the CloudWatch console:

1. Open the CloudWatch console
2. Navigate to Metrics
3. Select the "AIGateway/TokenUsage" namespace
4. Choose the metrics you want to view

## Creating Dashboards

You can create dashboards to visualize these metrics. Here are some useful dashboard widgets to consider:

1. **Token Usage by Model**: Line chart showing InputTokens, OutputTokens, and TotalTokens by ModelId
2. **Cache Hit Rate**: Pie chart showing the proportion of cached vs. non-cached responses
3. **Response Latency**: Line chart showing average, p90, and p99 latency by ModelId
4. **Token Usage Over Time**: Stacked area chart showing token usage trends over time

## Setting Alarms

Consider setting up CloudWatch alarms for:

1. **High Token Usage**: Alert when token usage approaches limits
2. **Latency Spikes**: Alert when response latency exceeds thresholds
3. **Low Cache Hit Rate**: Alert when cache effectiveness drops

## Implementation Details

These metrics are implemented in the `chatbot_handler.py` file using the `publish_token_metrics` function. The function is called in two places:

1. When processing metadata events from the model response
2. When serving cached responses

For cached responses, token counts are estimated based on the length of the input and output text.
