# Gettings Started for PACE

Use this guide to start your new customer project. We will cover the following:

- Cloning the foundations2025 repository for a new project
- Configuring the Cline VS Code extension
- Troubleshooting
- Common prompts

Note: This guide is intended for PACE. The `README.md` is intended for customers receiving your project.

## Cloning

To start your new repository, begin by cloning the repository:

```
git clone -o foundations git@ssh.gitlab.aws.dev:awsi-pace/internal/foundations2025.git MYCUSTOMERPROJECT
```

Replace MYCUSTOMERPROJECT with the name of your project. For example, anycompany-excellent-prototype.

This is a change from the way we used to use foundations. Before, foundations was a bag of files and developers pulled files as needed. Foundations2025 is intended to be a starting point for your customer project repository.

What's the intended benefit?

By cloning foundations2025 with the `foundations` origin, I hope to remove some friction from backporting changes from customer projects to foundations. If you've made a great construct or security fix, everyone wants that. This will maintain the references in git to the foundations repo and enable to you to make pull requests from your customer project back to foundations.

- When making a change you intend to merge back to foundations, take care to make that change in a single commit without changes to any customer files.
- Create a branch from the `foundations` tag you created when you cloned, for example `git checkout -b myhandle/fix/shortdesc foundations/main`.
- Use `git cherry-pick` to bring your commit to your new branch.
- Push the new branch back to foundations (not your customer repo), `git push foundations myhandle/fix/shortdesc`.
- Make a merge request in Gitlab.

## Configuring Cline

### Create a console role for Cline

- Go to Isengard and select the account you wish to use with Cline.
- Select the Console Roles option from the dropdown.
- Press _Add_ to create a new console role.
- Enter _Cline_ as the name of the role.
- Add your user to the access list.
- In the _Attached Policies_, select the _ViewOnlyAccess_ role, there isn't a Bedrock access policy yet here so we will update the role next.
- Log into the account and go to the roles list in the IAM console.
- Locate your _Cline_ role and press _Add permissions_, and _Attach policies_.
- Select the _AmazonBedrockLimitedAccess_ policy.
- Remove _ViewOnlyAccess_ from the role.

This enables Cline to run in a least privilege role. Possibly it can run in even less privileges than the limited access policy. Let us now!

### Add a profile to your AWS config

- In your terminal, run `isengardcli add-profile`.
- Follow the interactive menues to select the _Cline_ role from the account you used in the last step.
- Open your `~/.aws/config` file and note the name of the newly created profile.

### Set up Cline in VS Code

Install the Cline extension from the marketplace.

In the Cline settings:

- Select _Amazon Bedrock_ as your model provider.
- Select _AWS Profile_ as the authentication mechanism.
- Provide the name of your new profile from the last step in the _AWS Profile Name_ step.
- Select your desired _AWS Region_.
- Check _Use cross-region inference_.
- Check _Use prompt caching_.
- Select `anthropic.claude-3-7-sonnet-20250219-v1:0` in the _Model_ field or your desired model.
- Press _Done_ to save the config.

I've had better success without extended thinking due to token consumption/limits in our accounts.

In Cline's Auto-approve Settings (expandable panel above the prompt box by clicking the caret ^), these are the settings I like to use:

- Read project files
- Use MCP servers
- leave other unchecked

Basically, I want to approve any commands it wants to run and to see the edits to files one at a time. I like to update my mental model of what is changing as it happens. I don't want to trust someone else's definition of _safe_ commands so I leave that unselected also.

## Common Cline Prompts to Get Started

Your new project comes with a `.clinerules` folder with instructions on hwo to use the available Projen blueprints. This means with minimal prompting you can get started with relatively small prompts.

> Use projen to create a CDK project called infra, a python module called backend, and a serverless v2 webapp called webapp.

It's important to provide your own naming or your LLM will provide its own naming!

If you like to use Jupyter Lab we have a blueprint for that also!

> Add a jupyter project called notebooks and make it depend on the backend project

With a dependency on your `backend` project, you can use and update your deployable python code in a notebook. Skip copying and pasting code from your notebook to your deployable code.

See `.clinerules/01-basics.md` for a complete list of the available blueprints.

## Troubleshooting

If you experience problems, please let the Foundations team know! We want to help.

### Cline times out on new terminals and can't see the terminal output

Cline has a timeout to start new terminals. Some PACErs have reported that with Q-cli, their terminal in VS code opens too slowly for Cline's default settings. You can adjust this timeout in the Cline settings as well as provide a shell rc file that disables slow environment settings you may use outside of VS Code.

If this doesn't help you, see https://docs.cline.bot/troubleshooting/terminal-integration-guide for more options.
