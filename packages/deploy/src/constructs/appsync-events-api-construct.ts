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

import * as appsync from "aws-cdk-lib/aws-appsync";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as wafv2 from "aws-cdk-lib/aws-wafv2";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";

/**
 * Properties for the AppSyncEventsApiConstruct
 */
export interface AppSyncEventsApiConstructProps {
    /**
     * The Cognito User Pool to use for authentication
     */
    readonly userPool: cognito.UserPool;

    /**
     * The Cognito User Pool Client to use for authentication
     */
    readonly userPoolClient: cognito.UserPoolClient;

    /**
     * The chatbot handler Lambda function
     */
    readonly chatbotHandler: lambda.Function;

    /**
     * The subscribe handler Lambda function
     */
    readonly subscribeHandler: lambda.Function;

    /**
     * The ARN of the WAF WebACL to associate with the AppSync API
     * @optional
     */
    readonly webAclArn?: string;
}

/**
 * A CDK construct that creates an AppSync API with Events functionality
 */
export class AppSyncEventsApiConstruct extends Construct {
    /**
     * The AppSync API
     */
    public readonly api: appsync.EventApi;

    /**
     * The inbound channel namespace
     */
    public readonly inboundChannelNamespace: appsync.ChannelNamespace;

    /**
     * The outbound channel namespace
     */
    public readonly outboundChannelNamespace: appsync.ChannelNamespace;

    /**
     * The chatbot handler data source
     */
    public readonly chatbotHandlerDataSource: appsync.AppSyncLambdaDataSource;

    /**
     * The subscribe handler data source
     */
    public readonly subscribeHandlerDataSource: appsync.AppSyncLambdaDataSource;

    constructor(
        scope: Construct,
        id: string,
        props: AppSyncEventsApiConstructProps,
    ) {
        super(scope, id);

        // Define auth providers
        const apiKeyProvider: appsync.AppSyncAuthProvider = {
            authorizationType: appsync.AppSyncAuthorizationType.API_KEY,
        };

        const iamProvider: appsync.AppSyncAuthProvider = {
            authorizationType: appsync.AppSyncAuthorizationType.IAM,
        };

        const cognitoProvider: appsync.AppSyncAuthProvider = {
            authorizationType: appsync.AppSyncAuthorizationType.USER_POOL,
            cognitoConfig: {
                userPool: props.userPool,
                appIdClientRegex: props.userPoolClient.userPoolClientId,
            },
        };

        // Create the AppSync API with Events configuration
        this.api = new appsync.EventApi(this, "Api", {
            apiName: "ChatbotEventsAPI",
            authorizationConfig: {
                authProviders: [apiKeyProvider, iamProvider, cognitoProvider],
                connectionAuthModeTypes: [
                    appsync.AppSyncAuthorizationType.API_KEY,
                    appsync.AppSyncAuthorizationType.IAM,
                    appsync.AppSyncAuthorizationType.USER_POOL,
                ],
                defaultPublishAuthModeTypes: [
                    appsync.AppSyncAuthorizationType.API_KEY,
                ],
                defaultSubscribeAuthModeTypes: [
                    appsync.AppSyncAuthorizationType.API_KEY,
                ],
            },
            logConfig: {
                excludeVerboseContent: true,
                fieldLogLevel: appsync.AppSyncFieldLogLevel.ERROR,
                retention: logs.RetentionDays.ONE_WEEK,
            },
        });

        // Add CDK-nag suppression for the AWS managed policy used by AppSync for CloudWatch logging
        NagSuppressions.addResourceSuppressions(
            this.api,
            [
                {
                    id: "AwsSolutions-IAM4",
                    reason: "AWS AppSync uses the managed policy AWSAppSyncPushToCloudWatchLogs for CloudWatch logging which enables it to create log groups and log streams",
                    appliesTo: [
                        "Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSAppSyncPushToCloudWatchLogs",
                    ],
                },
            ],
            true,
        );

        // Associate WAF WebACL with the AppSync API if provided
        if (props.webAclArn) {
            new wafv2.CfnWebACLAssociation(this, "WafAssociation", {
                resourceArn: this.api.apiArn,
                webAclArn: props.webAclArn,
            });
        }

        // Create the Lambda data sources
        this.chatbotHandlerDataSource = this.api.addLambdaDataSource(
            "ChatbotHandler",
            props.chatbotHandler,
        );

        this.subscribeHandlerDataSource = this.api.addLambdaDataSource(
            "SubscribeHandler",
            props.subscribeHandler,
        );

        // Create the inbound channel namespace
        this.inboundChannelNamespace = this.api.addChannelNamespace(
            "Inbound-Messages",
            {
                authorizationConfig: {
                    publishAuthModeTypes: [
                        appsync.AppSyncAuthorizationType.USER_POOL,
                        appsync.AppSyncAuthorizationType.IAM,
                    ],
                    subscribeAuthModeTypes: [
                        appsync.AppSyncAuthorizationType.IAM,
                    ],
                },
                publishHandlerConfig: {
                    dataSource: this.chatbotHandlerDataSource,
                    direct: true,
                    lambdaInvokeType: appsync.LambdaInvokeType.EVENT,
                },
            },
        );

        // Create the outbound channel namespace
        this.outboundChannelNamespace = this.api.addChannelNamespace(
            "Outbound-Messages",
            {
                authorizationConfig: {
                    publishAuthModeTypes: [
                        appsync.AppSyncAuthorizationType.IAM,
                    ],
                    subscribeAuthModeTypes: [
                        appsync.AppSyncAuthorizationType.USER_POOL,
                        appsync.AppSyncAuthorizationType.IAM,
                    ],
                },
                subscribeHandlerConfig: {
                    dataSource: this.subscribeHandlerDataSource,
                    direct: true,
                    lambdaInvokeType: appsync.LambdaInvokeType.REQUEST_RESPONSE,
                },
            },
        );
    }
}
