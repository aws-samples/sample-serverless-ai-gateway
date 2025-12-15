import { suppressCdkNagRules } from "@aws-pace/cdk-utils";
import * as cdk from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import { execSync } from "child_process";
import { AppStack } from "./app-stack";
import { CfWafStack } from "./cf-waf-stack";

const app = new cdk.App();

const stackName = app.node.tryGetContext("stack_name") || "prototype";
const account =
    app.node.tryGetContext("account") ||
    process.env.CDK_DEPLOY_ACCOUNT ||
    process.env.CDK_DEFAULT_ACCOUNT;
const region =
    app.node.tryGetContext("region") ||
    process.env.CDK_DEPLOY_REGION ||
    process.env.CDK_DEFAULT_REGION;

// Deploy Waf for CloudFront in us-east-1
const cfWafStackName = stackName + "-waf";

(async () => {
    // Check if Docker is running before deployment
    try {
        execSync("docker info", { stdio: "pipe" });
        console.log("✅ Docker is running");
    } catch (error) {
        console.error(
            "❌ Docker is not running. Please start Docker and try again.",
        );
        console.error(
            "Docker is required for Lambda function bundling during deployment.",
        );
        process.exit(1);
    }

    const cfWafStack = new CfWafStack(app, cfWafStackName, {
        env: {
            account: account,
            region: "us-east-1",
        },
        stackName: cfWafStackName,
    });

    // Deploy App Stack
    const appStack = new AppStack(app, stackName, {
        env: {
            account: account,
            region: region,
        },
        stackName: stackName,
        ssmWafArnParameterName: cfWafStack.ssmWafArnParameterName,
        ssmWafArnParameterRegion: cfWafStack.region,
    });

    appStack.addDependency(cfWafStack);

    // Add Aws Solutions Checks and suppress rules
    cdk.Aspects.of(app).add(new AwsSolutionsChecks({ logIgnores: true }));
    suppressCdkNagRules(cfWafStack);
    suppressCdkNagRules(appStack);

    app.synth();
})().catch((err) => console.log("error in app.ts", err));
