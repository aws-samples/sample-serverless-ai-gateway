# Sample Serverless AI Chat Gateway 

Sample Serverless AI chat gateway built on AWS AppSync Events API and Amazon Bedrock. Features real-time streaming chat with multiple AI models, user authentication, token usage tracking, response caching, and content safety guardrails. Includes React frontend, Python Lambda backend, and CDK infrastructure. Designed for secure, scalable AI interactions with built-in rate limiting and comprehensive monitoring.

## Tasks

### Prerequisites

1. Install pyenv to manage python versions: https://github.com/pyenv/pyenv
1. Install nvm to manage nodejs versions: https://github.com/nvm-sh/nvm

### Getting started

1. Run `pyenv install` (reads the python version from .python-version). Note that if you already have the version of python installed, you must run `pyenv local` to update your shell to use that python.
1. Run `nvm install` (reads the nodejs version from .nvmrc)
1. Install pnpm: `npm install -g pnpm`
1. Run `pip install poetry setuptools`
1. Run `pnpm install` to install dependencies (this will install npm dependencies and python dependencies via poetry install from the submodules)
1. To update the region
    - Open `.projenrc.ts` with your text editor
    - Update the region constant near the top of the file, `const region = "us-east-1";`
    - Run `pnpm projen` to update the configuration across the repository
1. Define the `ARCH` variable in your shell: `export ARCH=$(arch)`. The value should be either `aarch64` or `x86_64` and should match your system architecture so that the lambda functions are deployed to an architecture matching your build environment.
1. To build the packages: `npx nx run deploy:build` - this must precede the next step
1. To deploy to your own account, run `ARCH=$(arch) npx nx run deploy:deploy --require-approval never --all`

### List Projects

```
% npx nx show projects
```

### Deploy the project

This build all the projects according to their dependency structure

```
npx nx run deploy:build
```

To deploy, first deploy the base env stack. This includes all the resources that are slow to deploy and not likely to change in development iterations: application load balancer, relational database, cognito.

```
npx nx run deploy:deploy --require-approval=never --all
```

### View application graph

```
npx nx graph
```

### Update dependencies

Modify `.projenrc.ts` with the dependencies you wish to use and then run `npx pdk` to update project files.

### pnpm audit

To run an audit and remediate CVEs, first...

- Run `pnpm audit`.
- Select one package to update
- Update the `pnpmOverrides` in `.projenrc.ts`
- Run `pnpm projen` to update dependencies and install the change.
- Then repeat these steps.

Note, when updating aws-cdk-lib, update the cdkVersion variable also.

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.
