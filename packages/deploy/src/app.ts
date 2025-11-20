/**
 * Copyright 2025 Amazon.com, Inc. and its affiliates. All Rights Reserved.
 *
 * Licensed under the Amazon Software License (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 *   http://aws.amazon.com/asl/
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

import { suppressCdkNagRules } from "@aws-pace/cdk-utils";
import * as cdk from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
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
