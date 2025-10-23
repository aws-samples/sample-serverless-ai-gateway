/**
 * Copyright 2024 Amazon.com, Inc. and its affiliates. All Rights Reserved.
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
import { Construct } from "constructs";

/* eslint-disable @typescript-eslint/no-empty-interface */
export interface LoggingBucketConstructProps extends cdk.StackProps {
    /**
     * The prefix to use for SSM parameters
     */
    readonly ssmPrefix: string;
}

const defaultProps: Partial<LoggingBucketConstructProps> = {};

/**
 * Deploys a logging bucket for ALB and CloudFront logs
 */
export class LoggingBucketConstruct extends Construct {
    /**
     * The S3 bucket created for storing logs
     */
    public readonly loggingBucket: cdk.aws_s3.Bucket;

    constructor(
        parent: Construct,
        name: string,
        props: LoggingBucketConstructProps,
    ) {
        super(parent, name);

        /* eslint-disable @typescript-eslint/no-unused-vars */
        props = { ...defaultProps, ...props };

        // Create the logging bucket with specified configuration
        this.loggingBucket = new cdk.aws_s3.Bucket(this, "LoggingBucket", {
            objectOwnership: cdk.aws_s3.ObjectOwnership.OBJECT_WRITER,
            encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
            autoDeleteObjects: true,
            blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            enforceSSL: true,
        });

        // Add bucket policy for ALB access logs
        const albLogPolicy = new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            principals: [
                new cdk.aws_iam.ServicePrincipal(
                    "logdelivery.elasticloadbalancing.amazonaws.com",
                ),
            ],
            actions: ["s3:PutObject"],
            resources: [this.loggingBucket.arnForObjects("*")],
            conditions: {
                StringEquals: {
                    "s3:x-amz-acl": "bucket-owner-full-control",
                },
            },
        });

        // Add CloudFront logging permissions
        const cloudfrontLogPolicy = new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            principals: [
                new cdk.aws_iam.ServicePrincipal("delivery.logs.amazonaws.com"),
            ],
            actions: ["s3:PutObject"],
            resources: [this.loggingBucket.arnForObjects("*")],
        });

        // Additional CloudFront permissions for log delivery
        const cloudfrontLogAccessPolicy = new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            principals: [
                new cdk.aws_iam.ServicePrincipal("logs.amazonaws.com"),
            ],
            actions: ["s3:GetBucketAcl", "s3:PutBucketAcl"],
            resources: [this.loggingBucket.bucketArn],
        });

        // Add all policies to the bucket
        this.loggingBucket.addToResourcePolicy(albLogPolicy);
        this.loggingBucket.addToResourcePolicy(cloudfrontLogPolicy);
        this.loggingBucket.addToResourcePolicy(cloudfrontLogAccessPolicy);

        // Create SSM parameter for the logging bucket name
        new cdk.aws_ssm.StringParameter(this, "LoggingBucketSsm", {
            parameterName: `${props.ssmPrefix}/logging/LoggingBucket`,
            stringValue: this.loggingBucket.bucketName,
        });

        // Add NAG suppression for the logging bucket
        NagSuppressions.addResourceSuppressions(
            this.loggingBucket,
            [
                {
                    id: "AwsSolutions-S1",
                    reason: "This is a logging bucket and does not need its own access logs",
                },
            ],
            true,
        );
    }
}
