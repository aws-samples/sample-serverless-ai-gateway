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

2. **Configure AWS region** (optional, defaults to us-east-1):
    - Edit `packages/deploy/cdk.json`
    - Update the `region` value in the `context` section

3. **Build and deploy:**

    ```bash
    pnpm run deploy
    ```

    This will:
    - Build all TypeScript packages
    - Build the React webapp
    - Bundle Python Lambda functions with Poetry (via Docker)
    - Deploy all CloudFormation stacks to AWS

## Development Workflow

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
