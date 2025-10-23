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
import { Construct } from "constructs";

/**
 * Properties for the ResponseCacheConstruct
 */
export interface ResponseCacheConstructProps {
    /**
     * Optional properties for customization
     */
}

/**
 * A CDK construct that creates a DynamoDB table for caching responses to user prompts
 */
export class ResponseCacheConstruct extends Construct {
    /**
     * The DynamoDB table for caching responses
     */
    public readonly table: cdk.aws_dynamodb.Table;

    constructor(
        scope: Construct,
        id: string,
        _props: ResponseCacheConstructProps = {},
    ) {
        super(scope, id);

        // Create the DynamoDB table with CDK-generated name
        this.table = new cdk.aws_dynamodb.Table(this, "Table", {
            billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
            partitionKey: {
                name: "prompt_hash",
                type: cdk.aws_dynamodb.AttributeType.STRING,
            },
            timeToLiveAttribute: "cachettl",
            removalPolicy: cdk.RemovalPolicy.DESTROY, // For development; use RETAIN for production
        });
    }
}
