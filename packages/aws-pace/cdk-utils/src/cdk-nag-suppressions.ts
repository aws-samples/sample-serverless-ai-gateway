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

import * as cdk from "aws-cdk-lib";
import { NagSuppressions } from "cdk-nag";

/**
 * General cdk nag suppressions to allow infrastructure that is acceptable for a prototype
 */
export const suppressCdkNagRules = (stack: cdk.Stack) => {
    // General
    NagSuppressions.addStackSuppressions(
        stack,
        [
            /*
              Access Logs are required for S3, Cloudfront, and ALB/ELB.
              Use the logging-bucket-construct to create a bucket with log delivery policies.
            */
            {
                id: "AwsSolutions-APIG1",
                reason: "API Gateway access logging not required for prototype",
            },
            {
                id: "AwsSolutions-CFR1",
                reason: "CloudFront geo restrictions not required for prototype",
            },
            {
                id: "AwsSolutions-CFR4",
                reason: "Custom certificate required for enabling this rule.  Not required for prototype",
            },
            {
                id: "AwsSolutions-COG2",
                reason: "Cognito MFA not required for prototype",
            },
            {
                id: "AwsSolutions-COG3",
                reason: "Cognito advanced security mode not required for prototype",
            },
            {
                id: "AwsSolutions-ECS2",
                reason: "Unnecessary rule as variables are dependent on deployment",
            },
            {
                id: "AwsSolutions-EC23",
                reason: "ECS SG is private and should allow all inbound traffic",
            },
            {
                id: "AwsSolutions-IAM4",
                reason: "AWS managed policies allowed for prototype",
                appliesTo: [
                    /**
                     * Add AWS managed policies here that you want to allow in the CDK stack.
                     * These should be AWS managed policies that are not overly permissive,
                     * and are thus reasonable to use in prototype code––such as the ones below.
                     *
                     * DO NOT ADD e.g. AmazonSageMakerFullAccess, AmazonS3FullAccess, AWSGlueServiceRole
                     */
                    "Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
                    "Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole",
                    "Policy::arn:<AWS::Partition>:iam::aws:policy/AmazonSSMManagedInstanceCore",
                ],
            },
            {
                id: "AwsSolutions-IAM5",
                reason: "IAM wildcard allowed",
                appliesTo: [
                    "Action::s3:Abort*",
                    "Action::s3:DeleteObject*",
                    "Action::s3:GetObject*",
                    "Action::s3:GetBucket*",
                    "Action::s3:Get*",
                    "Action::s3:List*",
                    "Action::s3:Put*",
                    "Action::s3:PutObject*",
                    {
                        regex: "/^Resource::arn:aws:s3:*\\*$/",
                    },
                    {
                        regex: "/^Resource::<.*Bucket.+Arn>.*/\\*$/",
                    },
                    {
                        regex: "/^Resource::<.*Table.+Arn>/index/\\*$/",
                    },
                    {
                        regex: "/^Resource::*.+\\*$/",
                    },
                ],
            },
            {
                id: "AwsSolutions-L1",
                reason: "Latest runtime not required for prototype",
            },
            {
                id: "AwsSolutions-S1",
                reason: "S3 server access logs not required for prototype",
            },
            {
                id: "AwsSolutions-RDS10",
                reason: "Disabled deletion protection for Prototype so that stack can be deleted",
            },
        ],
        true,
    );

    // guards against https://semgrep.dev/r?q=javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
    const regex = new RegExp("^[a-zA-Z0-9-]+$");
    if (!regex.test(stack.stackName)) {
        throw new Error("Stack name must only contain a-z, A-Z, 0-9, and -");
    }

    stack.node.findAll().forEach(({ node }: { node: any }) => {
        // Use string pattern matching instead of RegExp to avoid ReDoS vulnerabilities
        const cdkBucketDeploymentPrefix = `${stack.stackName}/Custom::CDKBucketDeployment`;
        const isResource =
            node.path.startsWith(cdkBucketDeploymentPrefix) &&
            node.path.includes("/Resource");
        const isServiceRolePolicy =
            node.path.startsWith(cdkBucketDeploymentPrefix) &&
            node.path.includes("/ServiceRole/DefaultPolicy/Resource");

        if (isResource || isServiceRolePolicy) {
            NagSuppressions.addResourceSuppressionsByPath(stack, node.path, [
                {
                    id: "AwsSolutions-IAM5",
                    reason: "DeploymentBucket adds * to custom resources and default policy",
                    appliesTo: [
                        {
                            regex: "/^Resource::*/g",
                        },
                    ],
                },
            ]);
        }
    });
};
