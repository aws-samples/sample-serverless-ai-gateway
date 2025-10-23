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

// import * as lambdaPython from "@aws-cdk/aws-lambda-python-alpha";

import {
    ApiGatewayV2CloudFrontConstruct,
    CognitoWebNativeConstruct,
    SsmParameterReaderConstruct,
    LoggingBucketConstruct,
    CloudFrontS3WebSiteConstruct,
    Wafv2BasicConstruct,
    WafV2Scope,
} from "@aws-pace/constructs";
import * as cdk from "aws-cdk-lib";
import { HttpOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { Construct } from "constructs";

import { AppSyncEventsApiConstruct } from "./constructs/appsync-events-api-construct";
import { ChatLambdaFunctionsConstruct } from "./constructs/chat-lambda-functions-construct";
import { FirehoseParquetTableConstruct } from "./constructs/firehose-parquet-table-construct";
import { ResponseCacheConstruct } from "./constructs/response-cache-construct";
import { TokenUsageConstruct } from "./constructs/token-usage-construct";
import {
    generateModelsConfig,
    generateFrontendModelData,
} from "./models-config";

export interface AppStackProps extends cdk.StackProps {
    readonly ssmWafArnParameterName: string;
    readonly ssmWafArnParameterRegion: string;
}

/**
 * AppStack for an S3 website and api gatewayv2 proxied through a CloudFront distribution
 *
 * copy this file and its dependencies into your project, then change the name of this file to a better name.
 * The only thing that needs to be configured is the webAppBuildPath
 *
 * see s3-website-cloudfront-apigatewayv2-appstack.png for architecture diagram
 */
export class AppStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: AppStackProps) {
        super(scope, id, props);

        const webAppBuildPath = "../webapp/dist";

        const cognito = new CognitoWebNativeConstruct(this, "Cognito", props);

        const cfWafWebAcl = new SsmParameterReaderConstruct(
            this,
            "SsmWafParameter",
            {
                ssmParameterName: props.ssmWafArnParameterName,
                ssmParameterRegion: props.ssmWafArnParameterRegion,
            },
        ).getValue();

        const regionalWaf = new Wafv2BasicConstruct(this, "Wafv2CF", {
            wafScope: WafV2Scope.REGIONAL,
            rules: [
                {
                    name: "CRSRule",
                    overrideAction: {
                        none: {},
                    },
                    priority: 1,
                    statement: {
                        managedRuleGroupStatement: {
                            name: "AWSManagedRulesCommonRuleSet",
                            vendorName: "AWS",
                        },
                    },
                    visibilityConfig: {
                        cloudWatchMetricsEnabled: true,
                        sampledRequestsEnabled: true,
                        metricName: "CfWebACLMetric-CRS",
                    },
                },
            ],
        });

        // Add logging bucket for S3 and CloudFront logs
        const loggingBucket = new LoggingBucketConstruct(
            this,
            "LoggingBucket",
            {
                ssmPrefix: `/${this.stackName}`,
            },
        );

        // This is an example of how to add a function to api gateway.  Should be placed into another construct
        const api = new ApiGatewayV2CloudFrontConstruct(this, "Api", {
            userPool: cognito.userPool,
            userPoolClient: cognito.webClientUserPool,
        });

        const website = new CloudFrontS3WebSiteConstruct(this, "WebApp", {
            webAclArn: cfWafWebAcl,
            loggingBucket: loggingBucket.loggingBucket,
            loggingPrefix: "webapp",
        });

        api.addBehaviorToCloudFrontDistribution(website.cloudFrontDistribution);

        // Create the Token Usage tracking
        const tokenUsage = new TokenUsageConstruct(this, "TokenUsage");

        // Create the Response Cache table
        const responseCache = new ResponseCacheConstruct(this, "ResponseCache");

        // Create the Chat Lambda Functions
        const chatLambdas = new ChatLambdaFunctionsConstruct(
            this,
            "ChatLambdas",
            {
                tokenUsageTable: tokenUsage.table,
                responseCacheTable: responseCache.table,
                responseChannel: "Outbound-Messages",
                dailyInputLimit: 10000,
                dailyOutputLimit: 20000,
                monthlyInputLimit: 100000,
                monthlyOutputLimit: 200000,
                defaultModelId: "us.anthropic.claude-opus-4-1-20250805-v1:0",
            },
        );

        // Create the Firehose delivery stream for chatbot logs
        const chatbotLogs = new FirehoseParquetTableConstruct(
            this,
            "ChatbotLogs",
            {
                databaseName: "chatbot_logs",
                tableName: "message_completions",
            },
        );

        // Grant the chatbot Lambda permission to write to Firehose
        chatbotLogs.firehoseDeliveryStream?.grantPutRecords(
            chatLambdas.chatbotHandler,
        );

        // // Add the Firehose delivery stream name to the chatbot Lambda environment variables
        if (chatbotLogs.firehoseDeliveryStream?.deliveryStreamName) {
            chatLambdas.chatbotHandler.addEnvironment(
                "FIREHOSE_DELIVERY_STREAM",
                chatbotLogs.firehoseDeliveryStream.deliveryStreamName,
            );
        }

        // Create the AppSync Events API
        const eventsApi = new AppSyncEventsApiConstruct(this, "EventsApi", {
            userPool: cognito.userPool,
            userPoolClient: cognito.webClientUserPool,
            chatbotHandler: chatLambdas.chatbotHandler,
            subscribeHandler: chatLambdas.subscribeHandler,
            webAclArn: regionalWaf.webacl.attrArn,
        });

        website.cloudFrontDistribution.addBehavior(
            "/event*",
            new HttpOrigin(eventsApi.api.httpDns),
            {
                allowedMethods: cdk.aws_cloudfront.AllowedMethods.ALLOW_ALL,
                cachePolicy: cdk.aws_cloudfront.CachePolicy.CACHING_DISABLED,
                originRequestPolicy:
                    cdk.aws_cloudfront.OriginRequestPolicy
                        .ALL_VIEWER_EXCEPT_HOST_HEADER,
                viewerProtocolPolicy:
                    cdk.aws_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                compress: false,
            },
        );

        // Update the chatbot handler environment variables with AppSync endpoint
        chatLambdas.chatbotHandler.addEnvironment(
            "APPSYNC_ENDPOINT_URL",
            eventsApi.api.httpDns,
        );

        // Grant specific AppSync permissions with channel-level scoping
        chatLambdas.grantAppSyncEventConnect(eventsApi.api);
        chatLambdas.grantAppSyncEventPublish(eventsApi.api, [
            "Outbound-Messages",
        ]);
        chatLambdas.grantAppSyncEventSubscribe(eventsApi.api, [
            "Inbound-Messages",
        ]);

        // Generate models data for frontend
        const modelsConfig = generateModelsConfig();
        const frontendModelData = generateFrontendModelData(modelsConfig);

        website.deployWebsite(webAppBuildPath, [
            cdk.aws_s3_deployment.Source.jsonData("config.json", {
                Auth: {
                    Cognito: {
                        allowGuestAccess: false,
                        region: this.region,
                        userPoolId: cognito.userPool.userPoolId,
                        userPoolClientId: cognito.webClientId,
                        identityPoolId: cognito.identityPoolId,
                    },
                },
                API: {
                    REST: {
                        api: {
                            endpoint: `https://${website.cloudFrontDistribution.distributionDomainName}/api`,
                            region: this.region,
                        },
                    },
                    Events: {
                        endpoint: `https://${eventsApi.api.httpDns}/event`,
                        // endpoint: `https://${website.cloudFrontDistribution.distributionDomainName}/event`,
                        region: this.region,
                        defaultAuthMode: "userPool",
                    },
                },
                // Add Storage configuration if needed
                // Storage: {
                //     region: this.region,
                //     bucket: "your-storage-bucket-name",
                //     identityPoolId: cognito.identityPoolId,
                // },
            }),
            // Deploy models configuration for frontend consumption
            cdk.aws_s3_deployment.Source.jsonData(
                "models.json",
                frontendModelData,
            ),
        ]);

        /*

        const exampleFn = new lambdaPython.PythonFunction(this, "ExampleLambdaFn", {
            runtime: cdk.aws_lambda.Runtime.PYTHON_3_8,
            handler: "lambda_handler",
            index: "example.py",
            entry: "../api/example",
            timeout: cdk.Duration.minutes(5),
            environment: {},
        });

        new ApiGatewayV2LambdaConstruct(this, "ExampleLambdaApiGateway", {
            lambdaFn: exampleFn,
            routePath: "/api/example",
            methods: [cdk.aws_apigatewayv2.HttpMethod.GET],
            api: api.apiGatewayV2,
        });
        */
    }
}
