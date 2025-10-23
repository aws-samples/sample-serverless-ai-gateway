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
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";

export interface S3EventPartitionLambdaConstructProps extends cdk.StackProps {
    /**
     * The S3 bucket where the data is stored
     */
    readonly sourceBucket: s3.IBucket;

    /**
     * Name of the Glue database
     */
    readonly databaseName: string;

    /**
     * Name of the Glue table
     */
    readonly tableName: string;

    /**
     * S3 prefix for the data files
     */
    readonly dataPrefix: string;

    /**
     * File extension to filter for (default: .parquet)
     */
    readonly fileExtension?: string;
}

const defaultProps: Partial<S3EventPartitionLambdaConstructProps> = {
    fileExtension: ".parquet",
};

/**
 * Deploys the S3EventPartitionLambda construct
 *
 * This construct creates a Lambda function that is triggered by S3 events
 * when new files are added to the specified S3 bucket and prefix.
 * The Lambda function registers new partitions in the Glue catalog.
 */
export class S3EventPartitionLambdaConstruct extends Construct {
    /**
     * The Lambda function that processes S3 events
     */
    public readonly lambdaFunction: lambda.Function;

    constructor(
        parent: Construct,
        name: string,
        props: S3EventPartitionLambdaConstructProps,
    ) {
        super(parent, name);

        /* eslint-disable @typescript-eslint/no-unused-vars */
        props = { ...defaultProps, ...props };

        // Create an IAM role for the Lambda function
        const lambdaRole = new iam.Role(this, "LambdaRole", {
            assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
        });

        // Grant permissions to the Lambda role
        props.sourceBucket.grantRead(lambdaRole);

        // Grant Glue permissions to the Lambda role
        lambdaRole.addToPolicy(
            new iam.PolicyStatement({
                actions: [
                    "glue:GetDatabase",
                    "glue:GetTable",
                    "glue:BatchCreatePartition",
                    "glue:GetPartition",
                    "glue:GetPartitions",
                    "glue:BatchGetPartition",
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

        // Grant CloudWatch Logs permissions
        lambdaRole.addToPolicy(
            new iam.PolicyStatement({
                actions: [
                    "logs:CreateLogGroup",
                    "logs:CreateLogStream",
                    "logs:PutLogEvents",
                ],
                resources: ["*"],
            }),
        );

        // Add NAG suppressions
        NagSuppressions.addResourceSuppressions(
            lambdaRole,
            [
                {
                    id: "AwsSolutions-IAM5",
                    reason: "Resource::* necessary for CloudWatch Logs.",
                    appliesTo: [
                        {
                            regex: "/^Resource::.*/g",
                        },
                    ],
                },
            ],
            true,
        );

        // Create the Lambda function
        this.lambdaFunction = new lambda.Function(this, "PartitionHandler", {
            runtime: lambda.Runtime.PYTHON_3_9,
            handler: "index.handler",
            code: lambda.Code.fromInline(this.generateLambdaCode()),
            role: lambdaRole,
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            environment: {
                DATABASE_NAME: props.databaseName,
                TABLE_NAME: props.tableName,
                DATA_PREFIX: props.dataPrefix,
            },
            description: "Processes S3 events and registers Glue partitions",
        });

        // Add S3 event notification
        props.sourceBucket.addEventNotification(
            s3.EventType.OBJECT_CREATED,
            new s3n.LambdaDestination(this.lambdaFunction),
            {
                prefix: props.dataPrefix,
                suffix: props.fileExtension,
            },
        );
    }

    /**
     * Generates the Lambda function code
     */
    private generateLambdaCode(): string {
        return `
import json
import os
import re
import boto3
import urllib.parse
from datetime import datetime

# Initialize AWS clients
glue_client = boto3.client('glue')

# Get environment variables
DATABASE_NAME = os.environ['DATABASE_NAME']
TABLE_NAME = os.environ['TABLE_NAME']
DATA_PREFIX = os.environ['DATA_PREFIX']

def handler(event, context):
    """
    Lambda function handler that processes S3 events and registers Glue partitions.
    
    Args:
        event: The S3 event
        context: The Lambda context
        
    Returns:
        A dictionary with the result of the operation
    """
    print(f"Received event: {json.dumps(event)}")
    
    # Process each record in the event
    for record in event.get('Records', []):
        # Check if this is an S3 event
        if record.get('eventSource') != 'aws:s3':
            continue
            
        # Get the S3 bucket and key
        bucket = record['s3']['bucket']['name']
        key = urllib.parse.unquote_plus(record['s3']['object']['key'])
        
        print(f"Processing S3 object: s3://{bucket}/{key}")
        
        # Extract partition values from the key
        partition_values = extract_partition_values(key)
        if not partition_values:
            print(f"Could not extract partition values from key: {key}")
            continue
            
        # Register the partition
        register_partition(bucket, key, partition_values)
    
    return {
        'statusCode': 200,
        'body': json.dumps('Partition registration complete')
    }

def extract_partition_values(key):
    """
    Extracts partition values from an S3 key.
    
    The key is expected to contain year=YYYY/month=MM/day=DD in the path.
    
    Args:
        key: The S3 object key
        
    Returns:
        A dictionary with the partition values, or None if no match
    """
    # Define regex pattern for partition values
    pattern = r'year=([0-9]{4})/month=([0-9]{1,2})/day=([0-9]{1,2})/'
    
    # Search for the pattern in the key
    match = re.search(pattern, key)
    if not match:
        return None
        
    # Extract the partition values
    year = match.group(1)
    month = match.group(2)
    day = match.group(3)
    
    # Ensure month and day are two digits
    month = month.zfill(2)
    day = day.zfill(2)
    
    return {
        'year': year,
        'month': month,
        'day': day
    }

def register_partition(bucket, key, partition_values):
    """
    Registers a partition in the Glue catalog with proper column schema.
    
    Args:
        bucket: The S3 bucket name
        key: The S3 object key
        partition_values: A dictionary with the partition values
    """
    try:
        # Check if the partition already exists
        try:
            glue_client.get_partition(
                DatabaseName=DATABASE_NAME,
                TableName=TABLE_NAME,
                PartitionValues=[
                    partition_values['year'],
                    partition_values['month'],
                    partition_values['day']
                ]
            )
            print(f"Partition already exists: {partition_values}")
            return
        except glue_client.exceptions.EntityNotFoundException:
            # Partition doesn't exist, continue with creation
            pass
        
        # Get table schema to inherit columns
        table_response = glue_client.get_table(
            DatabaseName=DATABASE_NAME,
            Name=TABLE_NAME
        )
        table_storage_descriptor = table_response['Table']['StorageDescriptor']
        
        print(f"Registering partition: {partition_values} with storage descriptor {table_storage_descriptor}")
        # Extract the partition path
        partition_path = f"year={partition_values['year']}/month={partition_values['month']}/day={partition_values['day']}"
        
        # Create the partition with inherited schema
        response = glue_client.batch_create_partition(
            DatabaseName=DATABASE_NAME,
            TableName=TABLE_NAME,
            PartitionInputList=[
                {
                    'Values': [
                        partition_values['year'],
                        partition_values['month'],
                        partition_values['day']
                    ],
                    'StorageDescriptor': {
                        'Columns': table_storage_descriptor['Columns'],
                        'Location': f"s3://{bucket}/{DATA_PREFIX}{partition_path}/",
                        'InputFormat': table_storage_descriptor['InputFormat'],
                        'OutputFormat': table_storage_descriptor['OutputFormat'],
                        'SerdeInfo': table_storage_descriptor['SerdeInfo']
                    }
                }
            ]
        )
        
        print(f"Successfully registered partition: {partition_values}")
        print(f"Response: {response}")
        
    except Exception as e:
        print(f"Error registering partition: {str(e)}")
        raise
`;
    }
}
