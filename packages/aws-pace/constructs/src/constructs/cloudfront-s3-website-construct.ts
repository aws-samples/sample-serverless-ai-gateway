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

export interface CloudFrontS3WebSiteConstructProps extends cdk.StackProps {
    /**
     * The path to the build directory of the web site, relative to the project root
     * ex: "./app/dist"
     * If provided, the bucket deployment will be created automatically in the constructor
     */
    readonly webSiteBuildPath?: string;

    /**
     * The Arn of the WafV2 WebAcl.
     */
    readonly webAclArn?: string;

    readonly loggingBucket: cdk.aws_s3.IBucket;
    readonly loggingPrefix: string;

    /**
     * Additional sources to include in the bucket deployment
     * Only used if webSiteBuildPath is provided
     */
    additionalSources?: cdk.aws_s3_deployment.ISource[];

    /**
     * Memory limit for the bucket deployment Lambda function
     * Only used if webSiteBuildPath is provided
     * @default 1024
     */
    readonly bucketDeploymentMemoryLimit?: number;
}

const defaultProps: Partial<CloudFrontS3WebSiteConstructProps> = {};

/**
 * Deploys a CloudFront Distribution pointing to an S3 bucket containing the deployed web application {webSiteBuildPath}.
 * Creates:
 * - S3 bucket
 * - CloudFrontDistribution
 * - OriginAccessIdentity
 *
 * On redeployment, will automatically invalidate the CloudFront distribution cache
 */
export class CloudFrontS3WebSiteConstruct extends Construct {
    /**
     * The cloud front distribution to attach additional behaviors like `/api`
     */
    public cloudFrontDistribution: cdk.aws_cloudfront.Distribution;

    /**
     * The bucket where the frontend assets are stored
     */
    public siteBucket: cdk.aws_s3.Bucket;

    /**
     * The bucket deployment that deploys the website content to the S3 bucket
     * This will be undefined if no deployment has been created yet
     */
    public bucketDeployment?: cdk.aws_s3_deployment.BucketDeployment;

    constructor(
        parent: Construct,
        name: string,
        props: CloudFrontS3WebSiteConstructProps,
    ) {
        super(parent, name);

        props = { ...defaultProps, ...props };

        // When using Distribution, do not set the s3 bucket website documents
        // if these are set then the distribution origin is configured for HTTP communication with the
        // s3 bucket and won't configure the cloudformation correctly.
        this.siteBucket = new cdk.aws_s3.Bucket(this, "WebApp", {
            encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
            autoDeleteObjects: true,
            blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            enforceSSL: true,
            serverAccessLogsBucket: props.loggingBucket,
            serverAccessLogsPrefix: props.loggingPrefix + "/bucket",
        });

        // https://docs.aws.amazon.com/AmazonS3/latest/userguide/enable-server-access-logging.html
        const s3LoggingBucketPolicy = new cdk.aws_iam.PolicyStatement({
            effect: cdk.aws_iam.Effect.ALLOW,
            principals: [
                new cdk.aws_iam.ServicePrincipal("logging.s3.amazonaws.com"),
            ],
            actions: ["s3:PutObject"],
            resources: [`${props.loggingBucket.bucketArn}/*`],
            conditions: {
                StringEquals: {
                    "s3:x-amz-acl": "bucket-owner-full-control",
                    "aws:SourceAccount": cdk.Stack.of(this).account,
                },
                ArnLike: {
                    "aws:SourceArn": this.siteBucket.bucketArn,
                },
            },
        });
        props.loggingBucket.addToResourcePolicy(s3LoggingBucketPolicy);

        this.siteBucket.addToResourcePolicy(
            new cdk.aws_iam.PolicyStatement({
                sid: "EnforceTLS",
                effect: cdk.aws_iam.Effect.DENY,
                principals: [new cdk.aws_iam.AnyPrincipal()],
                actions: ["s3:*"],
                resources: [
                    this.siteBucket.bucketArn,
                    this.siteBucket.bucketArn + "/*",
                ],
                conditions: { Bool: { "aws:SecureTransport": "false" } },
            }),
        );

        const s3origin =
            cdk.aws_cloudfront_origins.S3BucketOrigin.withOriginAccessControl(
                this.siteBucket,
                {
                    originAccessLevels: [cdk.aws_cloudfront.AccessLevel.READ],
                },
            );

        let logFilePrefix = props.loggingPrefix + "/cloudfront";
        if (logFilePrefix.startsWith("/")) {
            logFilePrefix = logFilePrefix.substring(1);
        }
        const cloudFrontDistribution = new cdk.aws_cloudfront.Distribution(
            this,
            "WebAppDistribution",
            {
                defaultBehavior: {
                    origin: s3origin,
                    cachePolicy: new cdk.aws_cloudfront.CachePolicy(
                        this,
                        "CachePolicy",
                        {
                            defaultTtl: cdk.Duration.hours(1),
                        },
                    ),
                    allowedMethods: cdk.aws_cloudfront.AllowedMethods.ALLOW_ALL,
                    viewerProtocolPolicy:
                        cdk.aws_cloudfront.ViewerProtocolPolicy
                            .REDIRECT_TO_HTTPS,
                },
                errorResponses: [
                    {
                        httpStatus: 404,
                        ttl: cdk.Duration.hours(0),
                        responseHttpStatus: 200,
                        responsePagePath: "/index.html",
                    },
                ],
                logBucket: props.loggingBucket,
                logIncludesCookies: false,
                logFilePrefix,
                defaultRootObject: "index.html",
                webAclId: props.webAclArn,
                minimumProtocolVersion:
                    cdk.aws_cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021, // Required by security
            },
        );

        // export any cf outputs
        new cdk.CfnOutput(this, "SiteBucket", {
            value: this.siteBucket.bucketName,
        });
        new cdk.CfnOutput(this, "CloudFrontDistributionId", {
            value: cloudFrontDistribution.distributionId,
        });
        new cdk.CfnOutput(this, "CloudFrontDistributionDomainName", {
            value: cloudFrontDistribution.distributionDomainName,
        });
        new cdk.CfnOutput(this, "CloudFrontDistributionUrl", {
            value: `https://${cloudFrontDistribution.distributionDomainName}`,
        });

        // assign public properties
        this.cloudFrontDistribution = cloudFrontDistribution;

        // If webSiteBuildPath is provided, create the bucket deployment automatically
        if (props.webSiteBuildPath) {
            this.deployWebsite(
                props.webSiteBuildPath,
                props.additionalSources,
                props.bucketDeploymentMemoryLimit,
            );
        }
    }

    /**
     * Deploys website content to the S3 bucket and sets up CloudFront invalidation
     * @param webSiteBuildPath The path to the build directory of the web site, relative to the project root
     * @param additionalSources Additional sources to include in the bucket deployment
     * @param memoryLimitMiB Memory limit for the bucket deployment Lambda function (default: 1024)
     * @returns The created bucket deployment
     */
    public deployWebsite(
        webSiteBuildPath: string,
        additionalSources?: cdk.aws_s3_deployment.ISource[],
        memoryLimitMiB: number = 1024,
    ): cdk.aws_s3_deployment.BucketDeployment {
        const stack = cdk.Stack.of(this);

        // Create the bucket deployment
        const bucketDeployment = new cdk.aws_s3_deployment.BucketDeployment(
            this,
            "DeployWithInvalidation",
            {
                sources: [
                    cdk.aws_s3_deployment.Source.asset(webSiteBuildPath),
                    ...(additionalSources ?? []),
                ], // from root directory
                destinationBucket: this.siteBucket,
                distribution: this.cloudFrontDistribution, // this assignment, on redeploy, will automatically invalidate the cloudfront cache
                distributionPaths: ["/*"],
                // default of 128 isn't large enough for larger website deployments. More memory doesn't improve the performance.
                // You want just enough memory to guarantee deployment
                memoryLimit: memoryLimitMiB,
            },
        );

        // Add the necessary suppressions for CDK-NAG
        NagSuppressions.addResourceSuppressionsByPath(
            stack,
            // This looks brittle but it's not––the long ID (869...56C) is part of the CDK source code
            `/${stack.node.id}/Custom::CDKBucketDeployment8693BB64968944B69AAFB0CC9EB8756C${memoryLimitMiB}MiB/ServiceRole/DefaultPolicy/Resource`,
            [
                {
                    id: "AwsSolutions-IAM5",
                    reason: "Bucket Deployment uses several IAM wildcards that are necessary",
                },
            ],
        );

        // Store the bucket deployment in the class property
        this.bucketDeployment = bucketDeployment;

        return bucketDeployment;
    }
}
