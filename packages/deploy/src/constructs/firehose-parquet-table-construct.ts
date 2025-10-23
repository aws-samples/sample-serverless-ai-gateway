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
import { StreamEncryption } from "aws-cdk-lib/aws-kinesisfirehose";
import { Construct } from "constructs";
import { S3EventPartitionLambdaConstruct } from "./s3-event-partition-lambda-construct";

export interface FirehoseParquetTableConstructProps extends cdk.StackProps {
    /**
     * Name of the Glue database to create
     * @default "firehose_database"
     */
    readonly databaseName: string;

    /**
     * Name of the Glue table to create
     * @default "firehose_table"
     */
    readonly tableName?: string;

    /**
     * Schema columns for the Glue table
     * @default - A default schema for chatbot logs
     */
    readonly columns?: { name: string; type: string }[];

    /**
     * Partition keys for the Glue table
     * @default - Partitioning by year, month, day
     */
    readonly partitionKeys?: { name: string; type: string }[];
}

const defaultProps: Partial<FirehoseParquetTableConstructProps> = {
    databaseName: "firehose_database",
    tableName: "firehose_table",
    columns: [
        { name: "user_id", type: "string" },
        { name: "conversation_id", type: "string" },
        { name: "model_id", type: "string" },
        { name: "input_tokens", type: "int" },
        { name: "output_tokens", type: "int" },
        { name: "user_message", type: "string" },
        { name: "assistant_response_length", type: "int" },
        { name: "assistant_response_preview", type: "string" },
        { name: "timestamp", type: "timestamp" },
    ],
    partitionKeys: [
        { name: "year", type: "string" },
        { name: "month", type: "string" },
        { name: "day", type: "string" },
    ],
};

/**
 * Deploys the FirehoseParquetTable construct
 */
export class FirehoseParquetTableConstruct extends Construct {
    /**
     * The S3 bucket where the data will be stored
     */
    public readonly bucket: cdk.aws_s3.Bucket;

    /**
     * The Glue database
     */
    public readonly database: cdk.aws_glue.CfnDatabase;

    /**
     * The Glue table
     */
    public readonly table: cdk.aws_glue.CfnTable;

    /**
     * The Firehose delivery stream
     */
    public readonly firehoseDeliveryStream?: cdk.aws_kinesisfirehose.DeliveryStream;

    constructor(
        parent: Construct,
        name: string,
        props: FirehoseParquetTableConstructProps,
    ) {
        super(parent, name);

        /* eslint-disable @typescript-eslint/no-unused-vars */
        props = { ...defaultProps, ...props };

        // Generate the data prefix based on database name and table name
        const dataPrefix = `${props.databaseName}/${props.tableName}/`;

        // Create an S3 bucket for storing the data
        this.bucket = new cdk.aws_s3.Bucket(this, "Bucket", {
            encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
            autoDeleteObjects: true,
            blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            enforceSSL: true,
            serverAccessLogsPrefix: "access-logs/",
        });

        // Create a Glue database
        this.database = new cdk.aws_glue.CfnDatabase(this, "Database", {
            catalogId: cdk.Stack.of(this).account,
            databaseInput: {
                name: props.databaseName,
            },
        });

        // Create a Glue table with the specified schema
        this.table = new cdk.aws_glue.CfnTable(this, "Table", {
            catalogId: cdk.Stack.of(this).account,
            databaseName: props.databaseName,
            tableInput: {
                name: props.tableName,
                tableType: "EXTERNAL_TABLE",
                parameters: {
                    classification: "parquet",
                    "projection.enabled": "true",
                    "projection.year.type": "integer",
                    "projection.year.range": "2020,2030",
                    "projection.month.type": "integer",
                    "projection.month.range": "1,12",
                    "projection.day.type": "integer",
                    "projection.day.range": "1,31",
                    "storage.location.template": `s3://${this.bucket.bucketName}/${dataPrefix}year=\${year}/month=\${month}/day=\${day}`,
                },
                partitionKeys: props.partitionKeys,
                storageDescriptor: {
                    columns: props.columns,
                    inputFormat:
                        "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat",
                    outputFormat:
                        "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat",
                    serdeInfo: {
                        serializationLibrary:
                            "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe",
                        parameters: {
                            "serialization.format": "1",
                        },
                    },
                    location: `s3://${this.bucket.bucketName}/${dataPrefix}`,
                },
            },
        });

        // Create an IAM role for Firehose
        const firehoseRole = new cdk.aws_iam.Role(this, "FirehoseRole", {
            assumedBy: new cdk.aws_iam.ServicePrincipal(
                "firehose.amazonaws.com",
            ),
        });

        // Grant permissions to the Firehose role
        this.bucket.grantReadWrite(firehoseRole);

        // Grant Glue permissions to the Firehose role
        firehoseRole.addToPolicy(
            new cdk.aws_iam.PolicyStatement({
                actions: [
                    "glue:GetTable",
                    "glue:GetTableVersion",
                    "glue:GetTableVersions",
                ],
                resources: [
                    `arn:aws:glue:${cdk.Stack.of(this).region}:${
                        cdk.Stack.of(this).account
                    }:catalog`,
                    `arn:aws:glue:${cdk.Stack.of(this).region}:${
                        cdk.Stack.of(this).account
                    }:database/${props.databaseName}`,
                    `arn:aws:glue:${cdk.Stack.of(this).region}:${
                        cdk.Stack.of(this).account
                    }:table/${props.databaseName}/${props.tableName}`,
                ],
            }),
        );

        // // Create an S3 destination for Firehose
        const s3Destination = new cdk.aws_kinesisfirehose.S3Bucket(
            this.bucket,
            {
                role: firehoseRole,
                bufferingInterval: cdk.Duration.seconds(60),
                bufferingSize: cdk.Size.mebibytes(64),
                dataOutputPrefix: `${dataPrefix}year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/`,
                errorOutputPrefix:
                    "errors/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/!{firehose:error-output-type}/",
                compression: cdk.aws_kinesisfirehose.Compression.UNCOMPRESSED,
            },
        );

        // Create the Firehose delivery stream
        this.firehoseDeliveryStream =
            new cdk.aws_kinesisfirehose.DeliveryStream(this, "Firehose", {
                destination: s3Destination,
                encryption: StreamEncryption.awsOwnedKey(),
            });

        // // Add data format conversion using CloudFormation properties
        const cfnDeliveryStream = this.firehoseDeliveryStream.node
            .defaultChild as cdk.aws_kinesisfirehose.CfnDeliveryStream;

        cfnDeliveryStream.addPropertyOverride(
            "ExtendedS3DestinationConfiguration.DataFormatConversionConfiguration",
            {
                Enabled: true,
                InputFormatConfiguration: {
                    Deserializer: {
                        OpenXJsonSerDe: {},
                    },
                },
                OutputFormatConfiguration: {
                    Serializer: {
                        ParquetSerDe: {
                            Compression: "SNAPPY",
                        },
                    },
                },
                SchemaConfiguration: {
                    DatabaseName: props.databaseName,
                    TableName: props.tableName,
                    RoleARN: firehoseRole.roleArn,
                    Region: cdk.Stack.of(this).region,
                    VersionId: "LATEST",
                },
            },
        );

        const partitionHandler = new S3EventPartitionLambdaConstruct(
            this,
            "PartitionHandler",
            {
                databaseName: props.databaseName,
                sourceBucket: this.bucket,
                tableName: props.tableName!,
                dataPrefix: dataPrefix,
            },
        );

        partitionHandler.node.addDependency(this.table);

        //        Output the Firehose delivery stream name
        new cdk.CfnOutput(this, "FirehoseDeliveryStreamName", {
            value: this.firehoseDeliveryStream.deliveryStreamName,
            description: "The name of the Firehose delivery stream",
        });

        // Output the Glue database and table names
        new cdk.CfnOutput(this, "GlueDatabaseName", {
            value: props.databaseName,
            description: "The name of the Glue database",
        });

        new cdk.CfnOutput(this, "GlueTableName", {
            value: this.table.ref,
            description: "The name of the Glue table",
        });

        // Output the S3 bucket name
        new cdk.CfnOutput(this, "S3BucketName", {
            value: this.bucket.bucketName,
            description: "The name of the S3 bucket where the data is stored",
        });
    }
}
