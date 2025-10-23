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
import * as appsync from "aws-cdk-lib/aws-appsync";
import { Construct } from "constructs";
import { BedrockGuardrails } from "./bedrock-guardrails-construct";
import {
    generateModelsConfig,
    generateBedrockPermissions,
} from "../models-config";

/**
 * Properties for the ChatLambdaFunctionsConstruct
 */
export interface ChatLambdaFunctionsConstructProps {
    /**
     * The DynamoDB table for token usage tracking
     */
    readonly tokenUsageTable: cdk.aws_dynamodb.Table;

    /**
     * The DynamoDB table for response caching
     */
    readonly responseCacheTable?: cdk.aws_dynamodb.Table;

    /**
     * The response channel name
     * @default "Outbound-Messages"
     */
    readonly responseChannel?: string;

    /**
     * The daily input token limit
     * @default 10000
     */
    readonly dailyInputLimit?: number;

    /**
     * The daily output token limit
     * @default 20000
     */
    readonly dailyOutputLimit?: number;

    /**
     * The monthly input token limit
     * @default 100000
     */
    readonly monthlyInputLimit?: number;

    /**
     * The monthly output token limit
     * @default 200000
     */
    readonly monthlyOutputLimit?: number;

    /**
     * The default model ID to use for Bedrock
     * @default "us.anthropic.claude-opus-4-1-20250805-v1:0"
     */
    readonly defaultModelId?: string;

    /**
     * Whether to enable Bedrock Guardrails
     * @default true
     */
    readonly enableGuardrails?: boolean;
}

/**
 * A CDK construct that creates Lambda functions for handling chat events
 */
export class ChatLambdaFunctionsConstruct extends Construct {
    /**
     * The chatbot handler Lambda function
     */
    public readonly chatbotHandler: cdk.aws_lambda.Function;

    /**
     * The subscribe handler Lambda function
     */
    public readonly subscribeHandler: cdk.aws_lambda.Function;

    /**
     * The chatbot handler role
     */
    public readonly chatbotHandlerRole: cdk.aws_iam.Role;

    /**
     * The subscribe handler role
     */
    public readonly subscribeHandlerRole: cdk.aws_iam.Role;

    /**
     * The Bedrock Guardrails construct (if enabled)
     */
    public readonly guardrails?: BedrockGuardrails;

    constructor(
        scope: Construct,
        id: string,
        props: ChatLambdaFunctionsConstructProps,
    ) {
        super(scope, id);

        // Create the chatbot handler Lambda function role
        this.chatbotHandlerRole = new cdk.aws_iam.Role(
            this,
            "ChatbotHandlerRole",
            {
                assumedBy: new cdk.aws_iam.ServicePrincipal(
                    "lambda.amazonaws.com",
                ),
                managedPolicies: [
                    cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName(
                        "service-role/AWSLambdaBasicExecutionRole",
                    ),
                ],
            },
        );

        this.chatbotHandlerRole.addToPolicy(
            new cdk.aws_iam.PolicyStatement({
                actions: ["cloudwatch:PutMetricData"],
                resources: ["*"],
                effect: cdk.aws_iam.Effect.ALLOW,
                conditions: {
                    StringEquals: {
                        "cloudwatch:namespace": "AIGateway/TokenUsage",
                    },
                },
            }),
        );

        // Add permissions for DynamoDB token usage table
        this.chatbotHandlerRole.addToPolicy(
            new cdk.aws_iam.PolicyStatement({
                actions: [
                    "dynamodb:GetItem",
                    "dynamodb:PutItem",
                    "dynamodb:UpdateItem",
                    "dynamodb:DeleteItem",
                    "dynamodb:Query",
                    "dynamodb:BatchWriteItem",
                ],
                resources: [props.tokenUsageTable.tableArn],
                effect: cdk.aws_iam.Effect.ALLOW,
            }),
        );

        // Add permissions for DynamoDB response cache table if provided
        if (props.responseCacheTable) {
            this.chatbotHandlerRole.addToPolicy(
                new cdk.aws_iam.PolicyStatement({
                    actions: [
                        "dynamodb:GetItem",
                        "dynamodb:PutItem",
                        "dynamodb:UpdateItem",
                        "dynamodb:Query",
                    ],
                    resources: [props.responseCacheTable.tableArn],
                    effect: cdk.aws_iam.Effect.ALLOW,
                }),
            );
        }

        // Generate precise Bedrock permissions from models configuration
        const modelsConfig = generateModelsConfig();
        const bedrockResources = generateBedrockPermissions(
            modelsConfig,
            cdk.Stack.of(this).account,
        );

        // Add permissions for Bedrock with precise model access
        this.chatbotHandlerRole.addToPolicy(
            new cdk.aws_iam.PolicyStatement({
                actions: ["bedrock:InvokeModelWithResponseStream"],
                resources: bedrockResources,
                effect: cdk.aws_iam.Effect.ALLOW,
            }),
        );

        // Create Bedrock Guardrails if enabled (default: true)
        const enableGuardrails = props.enableGuardrails !== false;
        if (enableGuardrails) {
            this.guardrails = new BedrockGuardrails(this, "Guardrails", {
                guardrailName: "ChatLambdaGuardrails",
                description:
                    "Content moderation guardrails for chat Lambda functions",
            });

            // Grant guardrails permissions to the chatbot handler role
            this.guardrails.grant(this.chatbotHandlerRole);
        }

        // Create the chatbot handler Lambda function
        this.chatbotHandler = new cdk.aws_lambda.Function(
            this,
            "ChatbotHandler",
            {
                runtime: cdk.aws_lambda.Runtime.PYTHON_3_12,
                handler: "eventhandlers.chatbot_handler.lambda_handler",
                code: cdk.aws_lambda.Code.fromAsset(
                    "../eventhandlers/dist/venv",
                ),
                timeout: cdk.Duration.minutes(5),
                memorySize: 512,
                architecture: cdk.aws_lambda.Architecture.ARM_64,
                environment: {
                    RESPONSE_CHANNEL:
                        props.responseChannel || "Outbound-Messages",
                    TOKEN_USAGE_TABLE: props.tokenUsageTable.tableName,
                    ...(props.responseCacheTable && {
                        RESPONSE_CACHE_TABLE:
                            props.responseCacheTable.tableName,
                    }),
                    DAILY_INPUT_LIMIT: (
                        props.dailyInputLimit || 10000
                    ).toString(),
                    DAILY_OUTPUT_LIMIT: (
                        props.dailyOutputLimit || 20000
                    ).toString(),
                    MONTHLY_INPUT_LIMIT: (
                        props.monthlyInputLimit || 100000
                    ).toString(),
                    MONTHLY_OUTPUT_LIMIT: (
                        props.monthlyOutputLimit || 200000
                    ).toString(),
                    DEFAULT_MODEL_ID:
                        props.defaultModelId ||
                        "us.anthropic.claude-opus-4-1-20250805-v1:0",
                    ...(this.guardrails && {
                        BEDROCK_GUARDRAIL_ID: this.guardrails.guardrailId,
                        BEDROCK_GUARDRAIL_VERSION:
                            this.guardrails.guardrailVersionId,
                    }),
                },
                role: this.chatbotHandlerRole,
            },
        );

        // Create the subscribe handler Lambda function role
        this.subscribeHandlerRole = new cdk.aws_iam.Role(
            this,
            "SubscribeHandlerRole",
            {
                assumedBy: new cdk.aws_iam.ServicePrincipal(
                    "lambda.amazonaws.com",
                ),
                managedPolicies: [
                    cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName(
                        "service-role/AWSLambdaBasicExecutionRole",
                    ),
                ],
            },
        );

        // Create the subscribe handler Lambda function
        this.subscribeHandler = new cdk.aws_lambda.Function(
            this,
            "SubscribeHandler",
            {
                runtime: cdk.aws_lambda.Runtime.PYTHON_3_12,
                handler: "eventhandlers.subscribe_handler.lambda_handler",
                code: cdk.aws_lambda.Code.fromAsset(
                    "../eventhandlers/dist/venv",
                    {},
                ),
                timeout: cdk.Duration.seconds(30),
                memorySize: 512,
                architecture: cdk.aws_lambda.Architecture.ARM_64,
                role: this.subscribeHandlerRole,
            },
        );

        // No AppSync resources are created here anymore
    }

    /**
     * Grants the chatbot handler Lambda function permission to publish events to AppSync API
     * @param api The AppSync Events API to grant access to
     * @param channels Optional array of channel names to scope permissions to
     */
    public grantAppSyncEventPublish(
        api: appsync.EventApi,
        channels?: string[],
    ): void {
        this._grantAppSyncEventAccess(api, ["appsync:EventPublish"], channels);
    }

    /**
     * Grants the chatbot handler Lambda function permission to subscribe to events from AppSync API
     * @param api The AppSync Events API to grant access to
     * @param channels Optional array of channel names to scope permissions to
     */
    public grantAppSyncEventSubscribe(
        api: appsync.EventApi,
        channels?: string[],
    ): void {
        this._grantAppSyncEventAccess(
            api,
            ["appsync:EventSubscribe"],
            channels,
        );
    }

    /**
     * Grants the chatbot handler Lambda function permission to connect to AppSync API
     * @param api The AppSync Events API to grant access to
     */
    public grantAppSyncEventConnect(api: appsync.EventApi): void {
        this._grantAppSyncEventAccess(api, ["appsync:EventConnect"]);
    }

    /**
     * Private helper method to grant specific AppSync permissions
     */
    private _grantAppSyncEventAccess(
        api: appsync.EventApi,
        actions: string[],
        channels?: string[],
    ): void {
        const region = cdk.Stack.of(this).region;
        const account = cdk.Stack.of(this).account;

        let resources: string[];

        if (channels && channels.length > 0) {
            // Scope to specific channel namespaces
            resources = channels.map(
                (channel) =>
                    `arn:aws:appsync:${region}:${account}:apis/${api.apiId}/channelNamespace/${channel}`,
            );
        } else {
            // For EventConnect, we typically need API-level access
            resources = [
                `arn:aws:appsync:${region}:${account}:apis/${api.apiId}/*`,
            ];
        }

        this.chatbotHandlerRole.addToPolicy(
            new cdk.aws_iam.PolicyStatement({
                actions: actions,
                resources: resources,
                effect: cdk.aws_iam.Effect.ALLOW,
            }),
        );
    }
}
