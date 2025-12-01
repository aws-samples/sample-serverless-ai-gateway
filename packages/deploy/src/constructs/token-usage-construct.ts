import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

/**
 * Properties for the TokenUsageConstruct
 */
export interface TokenUsageConstructProps {
    /**
     * The name of the DynamoDB table
     * @default "UserTokenUsage"
     */
    readonly tableName?: string;
}

/**
 * A CDK construct that creates a DynamoDB table for tracking token usage
 */
export class TokenUsageConstruct extends Construct {
    /**
     * The DynamoDB table for tracking token usage
     */
    public readonly table: cdk.aws_dynamodb.Table;

    constructor(
        scope: Construct,
        id: string,
        props: TokenUsageConstructProps = {},
    ) {
        super(scope, id);

        // Create the DynamoDB table
        this.table = new cdk.aws_dynamodb.Table(this, "Table", {
            tableName: props.tableName || "UserTokenUsage",
            billingMode: cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST,
            partitionKey: {
                name: "user_id",
                type: cdk.aws_dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: "period_id",
                type: cdk.aws_dynamodb.AttributeType.STRING,
            },
            timeToLiveAttribute: "ttl",
            removalPolicy: cdk.RemovalPolicy.DESTROY, // For development; use RETAIN for production
        });
    }
}
