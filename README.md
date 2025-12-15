# Sample Serverless AI Chat Gateway

Sample Serverless AI chat gateway built on AWS AppSync Events API and Amazon Bedrock. Features real-time streaming chat with multiple AI models, user authentication, token usage tracking, response caching, and content safety guardrails. Includes React frontend, Python Lambda backend, and CDK infrastructure. Designed for secure, scalable AI interactions with built-in rate limiting and comprehensive monitoring.

## Tasks

### Prerequisites

- **Node.js 22.8.0** (use [nvm](https://github.com/nvm-sh/nvm) - run `nvm install` to use the version specified in `.nvmrc`)
- **pnpm 10.20.0+** - Install with `npm install -g pnpm@latest`
- **Docker** - Required for Lambda function bundling during deployment
- **AWS CLI** - Configured with credentials for your target AWS account
- **Python 3.11+** and **Poetry** - For local Python development (optional, Docker handles Lambda bundling)

### Getting Started

1. **Install Node.js dependencies:**

    ```bash
    pnpm install --frozen-lockfile
    ```

    **Note:** You may see a warning about ignored build scripts (`aws-sdk`, `esbuild`, `unrs-resolver`). This is expected and can be safely ignored. These packages will build automatically when needed during the deployment process.

2. **Verify Docker is running:**

    Ensure Docker is running on your system, as it's required for Lambda function bundling:

    ```bash
    docker info
    ```

    If Docker is not running, you'll see an error. Start Docker Desktop or the Docker daemon before proceeding.

3. **Configure AWS credentials:**

    Ensure you have AWS credentials configured. The CDK will automatically use your default AWS profile and region. You can configure credentials using:

    ```bash
    aws configure
    ```

    Or use environment variables:
    - `AWS_REGION` - AWS region (defaults to us-east-1 if not set)
    - `AWS_PROFILE` - AWS profile name
    - `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` - AWS credentials
    - `AWS_SESSION_TOKEN` - For temporary credentials

    Alternatively, you can specify a profile when deploying:

    ```bash
    pnpm run deploy -- --profile your-profile-name
    ```

4. **Build and deploy:**

    ```bash
    pnpm run deploy
    ```

    This will:
    - Automatically check that Docker is running (required for Lambda bundling)
    - Build all TypeScript packages
    - Build the React webapp
    - Bundle Python Lambda functions with Poetry (via Docker)
    - Deploy all CloudFormation stacks to AWS

    **Note:** If Docker is not running, the deployment will fail early with a clear error message.

    **Note:** After deployment completes, save the `CognitoUserPoolId` and `CloudFrontDistributionDomainName` from the stack outputs - you'll need them for user creation and local development.

5. **Configure environment variables (for local development):**

    Update the environment file with your deployment outputs:

    **Webapp `.env` file** (`packages/webapp/.env`):

    ```bash
    export VITE_CLOUDFRONT_URL=https://YOUR_CLOUDFRONT_DOMAIN.cloudfront.net/
    ```

    Replace `YOUR_CLOUDFRONT_DOMAIN` with the `CloudFrontDistributionDomainName` from your deployment outputs.

6. **Create a user:**

    Self-registration is disabled in this sample. To sign into the application, you need to create users in the Cognito console or using the AWS CLI. Use the `CognitoUserPoolId` from the deployment outputs:

    ```bash
    # Create a new user (replace USER_POOL_ID, USERNAME, and EMAIL)
    aws cognito-idp admin-create-user \
        --user-pool-id USER_POOL_ID \
        --username USERNAME \
        --user-attributes Name=email,Value=EMAIL Name=email_verified,Value=true \
        --message-action SUPPRESS

    # Set a permanent password for the user
    aws cognito-idp admin-set-user-password \
        --user-pool-id USER_POOL_ID \
        --username USERNAME \
        --password YOUR_PASSWORD \
        --permanent
    ```

    Replace:
    - `USER_POOL_ID` - The Cognito User Pool ID from stack outputs (e.g., `us-east-1_aBcDeFgHi`)
    - `USERNAME` - The username for the new user (e.g., `john.doe`)
    - `EMAIL` - The user's email address
    - `YOUR_PASSWORD` - A secure password (must meet Cognito password requirements)

    You can now sign in to the web application using these credentials.

## Development Workflow

### Local Development

Start the webapp development server:

```bash
pnpm run dev
```

This starts the Vite development server for the React webapp. Make sure you've configured the `.env` files as described above.

### Building

Build all TypeScript packages:

```bash
pnpm run build
```

Build the webapp:

```bash
pnpm run build:webapp
```

### Synthesizing CloudFormation

Generate CloudFormation templates (includes building packages and webapp):

```bash
pnpm run synth
```

### Deploying

Deploy all stacks to AWS (includes building packages and webapp):

```bash
pnpm run deploy
```

### Other Commands

Start development server:

```bash
pnpm run dev
```

View CloudFormation diff:

```bash
pnpm run diff
```

Destroy all stacks:

```bash
pnpm run destroy
```

Clean build artifacts:

```bash
pnpm run clean
```

Run tests:

```bash
pnpm run test
```

### Individual Package Commands

Build a specific package:

```bash
pnpm --filter @aws-pace/cdk-utils build
pnpm --filter @aws-pace/constructs build
pnpm --filter deploy build
```

Deploy without building:

```bash
pnpm --filter deploy cdk:deploy
```

### Updating Dependencies

To update dependencies:

1. Update version numbers in the relevant `package.json` files
2. Run `pnpm install` (without `--frozen-lockfile`) to update the lock file
3. Test the changes with `pnpm run build && pnpm run synth`

For security updates, run `pnpm audit` and update the `pnpm.overrides` section in the root `package.json` as needed.

**Note:** Use `pnpm install --frozen-lockfile` for regular development and deployment to ensure reproducible builds. Only use `pnpm install` without the flag when intentionally updating dependencies.

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.
