# Bedrock Guardrails Integration

This project includes integrated Amazon Bedrock Guardrails for content moderation and PII protection in the AI Gateway chat functionality.

## Overview

The guardrails integration provides:

- **Content filtering** for harmful, offensive, or inappropriate content
- **PII detection and anonymization** for personally identifiable information
- **Prompt attack prevention** to block attempts to manipulate model behavior
- **Compliance support** for regulatory and organizational standards

## Architecture

The guardrails are implemented using:

- **CDK Infrastructure**: `BedrockGuardrailsConstruct` for creating and managing guardrails
- **Python Integration**: `BedrockGuardrailsIntegration` class for applying guardrails to requests
- **Transparent Application**: Guardrails are applied automatically to all Bedrock requests

## Configuration

### Enabling/Disabling Guardrails

Guardrails are **enabled by default**. To disable them:

```typescript
// In your app-stack.ts when creating ChatLambdaFunctionsConstruct
const chatLambdas = new ChatLambdaFunctionsConstruct(this, "ChatLambdas", {
    // ... other props
    enableGuardrails: false, // Disable guardrails
});
```

### Default Guardrail Configuration

The default configuration includes:

#### Content Filters (MEDIUM strength)

- Sexual content
- Violence
- Hate speech
- Insults
- Misconduct
- Prompt attacks (input only)

#### PII Protection (ANONYMIZE action)

- Email addresses
- Phone numbers
- Social Security Numbers
- Credit card numbers
- AWS access keys
- AWS secret keys
- Passwords

### Custom Guardrail Configuration

You can customize the guardrail configuration:

```typescript
const chatLambdas = new ChatLambdaFunctionsConstruct(this, "ChatLambdas", {
    // ... other props
    enableGuardrails: true,
});

// Access the guardrails construct for customization
if (chatLambdas.guardrails) {
    // The guardrails are created with sensible defaults
    // For custom configurations, modify the BedrockGuardrailsConstruct
}
```

## Environment Variables

The following environment variables are automatically configured:

- `BEDROCK_GUARDRAIL_ID`: The ID of the created guardrail
- `BEDROCK_GUARDRAIL_VERSION`: The version of the guardrail (default: "1")

## Logging

Guardrail information is automatically included in existing log messages:

```json
{
    "level": "INFO",
    "message": "Model selected for conversation",
    "model_id": "anthropic.claude-3-5-sonnet-20240620-v1:0",
    "guardrail_id": "abc123def456",
    "guardrail_version": "1"
}
```

## How It Works

1. **Dynamic Versioning**: When guardrail configuration changes, a new version is automatically created using a custom resource
2. **Request Processing**: When a chat request is received, the guardrails integration automatically adds guardrail configuration to the Bedrock request using the latest version
3. **Content Filtering**: Bedrock applies the configured content filters and PII detection
4. **Response Handling**: If content is blocked, Bedrock returns appropriate error responses
5. **Transparent Operation**: The integration works seamlessly with existing token limiting, caching, and streaming functionality

## Dynamic Version Management

The guardrails implementation uses a custom resource to automatically manage versions:

- **Configuration Hash**: A hash is created from the guardrail configuration (content filters, PII settings, messages)
- **Automatic Updates**: When the configuration changes, a new version is automatically created
- **Latest Version**: Lambda functions always use the most recent guardrail version
- **Deployment Safety**: Proper rollback handling during failed deployments

## Testing

Run the guardrails integration tests:

```bash
cd packages/eventhandlers
python -m pytest tests/test_guardrails_integration.py -v
```

## Monitoring

Monitor guardrails effectiveness through:

- **CloudWatch Logs**: Search for `guardrail_id` to filter guardrails-related logs
- **CloudWatch Metrics**: Bedrock automatically publishes guardrails metrics
- **Request Tracing**: Each request includes guardrail information in structured logs

## Troubleshooting

### Guardrails Not Applied

- Check that `enableGuardrails` is not set to `false`
- Verify environment variables `BEDROCK_GUARDRAIL_ID` and `BEDROCK_GUARDRAIL_VERSION` are set
- Check CloudWatch logs for guardrails initialization messages

### Content Unexpectedly Blocked

- Review guardrail configuration and filter strength settings
- Check CloudWatch logs for specific blocking reasons
- Consider adjusting filter sensitivity levels

### Performance Impact

- Guardrails add minimal latency using synchronous processing
- Monitor request latency metrics in CloudWatch
- Consider regional deployment for optimal performance

## Security Considerations

- Guardrails provide defense-in-depth but should not be the only content moderation mechanism
- Regularly review and update guardrail configurations based on usage patterns
- Monitor for attempts to bypass guardrails and adjust configurations accordingly
- Ensure proper IAM permissions are configured for guardrails access

## Compliance

The guardrails integration supports compliance requirements by:

- Maintaining audit trails of all content filtering decisions
- Providing configurable PII detection and handling
- Enabling consistent content moderation policies across the application
- Supporting regulatory requirements for AI content filtering
