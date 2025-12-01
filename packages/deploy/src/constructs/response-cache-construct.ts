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
