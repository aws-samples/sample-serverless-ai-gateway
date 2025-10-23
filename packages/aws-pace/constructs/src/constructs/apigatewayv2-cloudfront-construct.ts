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
import { Construct } from "constructs";

export interface ApiGatewayV2CloudFrontProps extends cdk.StackProps {
    /**
     * The Cognito UserPool to use for the default authorizer
     */
    readonly userPool: cdk.aws_cognito.UserPool;
    /**
     * The Cognito UserPoolClient to use for the default authorizer
     */
    readonly userPoolClient: cdk.aws_cognito.UserPoolClient;
    /**
     * The CloudFront Distribution to attach the `/api/*` behavior
     * If provided, the behavior will be automatically added during construction
     */
    readonly cloudFrontDistribution?: cdk.aws_cloudfront.Distribution;

    /** enable logging on the default stage a log group with the given path */
    readonly logGroupPath?: string;
    readonly logRetention?: cdk.aws_logs.RetentionDays;
}

const defaultProps: Partial<ApiGatewayV2CloudFrontProps> = {};

/**
 * Deploys Api gateway that can be proxied through a CloudFront distribution at route `/api`
 *
 * Any Api's attached to the gateway should be located at `/api/*` so that requests are correctly proxied.
 * Make sure Api's return the header `"Cache-Control" = "no-cache, no-store"` or CloudFront will cache responses
 *
 * CORS: allowed origins for local development:
 * - https://example.com:3000, http://example.com:3000
 *
 * For a more relaxed CORS posture, you can set `allowCredentials: false`, then set `allowOrigins: ["*"]`
 *
 * Creates:
 * - ApiGatewayV2 HttpApi
 */
export class ApiGatewayV2CloudFrontConstruct extends Construct {
    /**
     * Returns the ApiGatewayV2 instance to attach lambdas or other routes
     */
    public apiGatewayV2: cdk.aws_apigatewayv2.HttpApi;

    /**
     * The API URL that can be used to access the API directly or to configure CloudFront
     */
    public apiUrl: string;

    constructor(
        parent: Construct,
        name: string,
        props: ApiGatewayV2CloudFrontProps,
    ) {
        super(parent, name);

        props = { ...defaultProps, ...props };

        // get the parent stack reference for the stackName and the aws region
        const stack = cdk.Stack.of(this);

        // init cognito authorizer
        const cognitoAuth =
            new cdk.aws_apigatewayv2_authorizers.HttpUserPoolAuthorizer(
                "apiAuth",
                props.userPool,
                {
                    userPoolClients: [props.userPoolClient],
                },
            );

        // init api gateway
        const api = new cdk.aws_apigatewayv2.HttpApi(this, "Api", {
            apiName: `${stack.stackName}Api`,
            createDefaultStage: props.logGroupPath === undefined,
            corsPreflight: {
                allowHeaders: [
                    "Authorization",
                    "Content-Type",
                    "Origin",
                    "X-Amz-Date",
                    "X-Api-Key",
                    "X-Amz-Security-Token",
                    "X-Amz-User-Agent",
                ],
                allowMethods: [
                    // remove methods you don't use for tighter security
                    cdk.aws_apigatewayv2.CorsHttpMethod.DELETE,
                    cdk.aws_apigatewayv2.CorsHttpMethod.GET,
                    cdk.aws_apigatewayv2.CorsHttpMethod.HEAD,
                    cdk.aws_apigatewayv2.CorsHttpMethod.OPTIONS,
                    cdk.aws_apigatewayv2.CorsHttpMethod.PATCH,
                    cdk.aws_apigatewayv2.CorsHttpMethod.POST,
                    cdk.aws_apigatewayv2.CorsHttpMethod.PUT,
                ],
                // allow origins for development.  no origin is needed for cloudfront
                allowOrigins: [
                    "https://example.com:3000",
                    "http://example.com:3000",
                ],
                exposeHeaders: ["Access-Control-Allow-Origin"],
                maxAge: cdk.Duration.hours(1),
                allowCredentials: true,
            },
            defaultAuthorizer: cognitoAuth,
        });

        // Add stage with logging if enabled
        if (props.logGroupPath) {
            const logGroup = new cdk.aws_logs.LogGroup(this, "LogGroup", {
                logGroupName: props.logGroupPath,
                retention: props.logRetention,
            });
            new cdk.aws_apigatewayv2.CfnStage(this, "ApiStage", {
                apiId: api.httpApiId,
                stageName: "$default",
                autoDeploy: true,
                accessLogSettings: {
                    destinationArn: logGroup.logGroupArn,
                    format: JSON.stringify({
                        requestId: "$context.requestId",
                        ip: "$context.identity.sourceIp",
                        requestTime: "$context.requestTime",
                        httpMethod: "$context.httpMethod",
                        routeKey: "$context.routeKey",
                        status: "$context.status",
                        responseLength: "$context.responseLength",
                        errorMessage: "$context.error.message",
                        integrationErrorMessage:
                            "$context.integrationErrorMessage",
                        userAgent: "$context.identity.userAgent",
                        authorizerError: "$context.authorizer.error",
                        authorizerLatency: "$context.authorizer.latency",
                        authorizerStatus: "$context.authorizer.status",
                    }),
                },
            });
        }

        this.apiUrl = `${api.httpApiId}.execute-api.${stack.region}.amazonaws.com`;

        // If a CloudFront distribution was provided, add the behavior automatically
        if (props.cloudFrontDistribution) {
            this.addBehaviorToCloudFrontDistribution(
                props.cloudFrontDistribution,
                this.apiUrl,
            );
        }

        // export any cf outputs
        new cdk.CfnOutput(this, "GatewayUrl", {
            value: `https://${this.apiUrl}`,
        });

        // assign public properties
        this.apiGatewayV2 = api;
    }

    /**
     * Adds a proxy route from CloudFront /api to the api gateway url
     * @param cloudFrontDistribution The CloudFront distribution to add the behavior to
     * @param apiUrl The API URL to use as the origin (defaults to this.apiUrl if not provided)
     */
    public addBehaviorToCloudFrontDistribution(
        cloudFrontDistribution: cdk.aws_cloudfront.Distribution,
        apiUrl: string = this.apiUrl,
    ) {
        cloudFrontDistribution.addBehavior(
            "/api/*",
            new cdk.aws_cloudfront_origins.HttpOrigin(apiUrl, {
                originSslProtocols: [
                    cdk.aws_cloudfront.OriginSslPolicy.TLS_V1_2,
                ],
                protocolPolicy:
                    cdk.aws_cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
            }),
            {
                cachePolicy: new cdk.aws_cloudfront.CachePolicy(
                    this,
                    "CachePolicy",
                    {
                        // required or CloudFront will strip the Authorization token from the request.
                        // must be in the cache policy
                        headerBehavior:
                            cdk.aws_cloudfront.CacheHeaderBehavior.allowList(
                                "Authorization",
                            ),
                        // required or CloudFront will strip Cookies from the request.
                        // must be in the cache policy
                        cookieBehavior:
                            cdk.aws_cloudfront.CacheCookieBehavior.all(),
                        enableAcceptEncodingGzip: true,
                        minTtl: cdk.Duration.seconds(0),
                        defaultTtl: cdk.Duration.seconds(0),
                    },
                ),
                originRequestPolicy: new cdk.aws_cloudfront.OriginRequestPolicy(
                    this,
                    "OriginRequestPolicy",
                    {
                        headerBehavior:
                            cdk.aws_cloudfront.OriginRequestHeaderBehavior.allowList(
                                "User-Agent",
                                "Referer",
                            ),
                        // required or CloudFront will strip all query strings off the request
                        queryStringBehavior:
                            cdk.aws_cloudfront.OriginRequestQueryStringBehavior.all(),
                    },
                ),
                allowedMethods: cdk.aws_cloudfront.AllowedMethods.ALLOW_ALL,
                viewerProtocolPolicy:
                    cdk.aws_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            },
        );
    }
}
