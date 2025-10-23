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
import * as cr from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";

export interface GuardrailVersionCustomResourceProps {
    /**
     * The guardrail ID to create versions for
     */
    readonly guardrailId: string;

    /**
     * Description for the version
     * @default "Auto-generated version"
     */
    readonly versionDescription?: string;

    /**
     * Configuration hash to trigger version updates when guardrail config changes
     */
    readonly configurationHash: string;
}

/**
 * Custom resource that creates and manages guardrail versions dynamically
 */
export class GuardrailVersionCustomResource extends Construct {
    /**
     * The latest guardrail version number
     */
    public readonly versionNumber: string;

    /**
     * The custom resource provider
     */
    public readonly provider: cr.Provider;

    constructor(
        scope: Construct,
        id: string,
        props: GuardrailVersionCustomResourceProps,
    ) {
        super(scope, id);

        // Create the Lambda function that handles the custom resource
        const customResourceFunction = new lambda.Function(
            this,
            "GuardrailVersionHandler",
            {
                runtime: lambda.Runtime.PYTHON_3_12,
                handler: "index.handler",
                code: lambda.Code.fromInline(`
import json
import boto3
import logging
from typing import Dict, Any
import hashlib

logger = logging.getLogger()
logger.setLevel(logging.INFO)

bedrock = boto3.client('bedrock')

def handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """
    Custom resource handler for managing guardrail versions
    """
    try:
        logger.info(f"Received event: {json.dumps(event, default=str)}")
        
        request_type = event['RequestType']
        properties = event['ResourceProperties']
        guardrail_id = properties['GuardrailId']
        version_description = properties.get('VersionDescription', 'Auto-generated version')
        config_hash = properties.get('ConfigurationHash', '')
        
        physical_resource_id = f"guardrail-version-{guardrail_id}-{config_hash[:8]}"
        
        if request_type == 'Create':
            return handle_create(guardrail_id, version_description, physical_resource_id)
        elif request_type == 'Update':
            return handle_update(event, guardrail_id, version_description, physical_resource_id)
        elif request_type == 'Delete':
            return handle_delete(event, physical_resource_id)
        else:
            raise ValueError(f"Unknown request type: {request_type}")
            
    except Exception as e:
        logger.error(f"Error handling request: {str(e)}")
        return {
            'Status': 'FAILED',
            'Reason': str(e),
            'PhysicalResourceId': event.get('PhysicalResourceId', 'failed-resource'),
            'Data': {}
        }

def handle_create(guardrail_id: str, version_description: str, physical_resource_id: str) -> Dict[str, Any]:
    """Handle CREATE requests"""
    logger.info(f"Creating new version for guardrail {guardrail_id}")
    
    try:
        # Create a new version
        response = bedrock.create_guardrail_version(
            guardrailIdentifier=guardrail_id,
            description=version_description
        )
        
        version_number = response['version']
        logger.info(f"Created guardrail version: {version_number}")
        
        return {
            'Status': 'SUCCESS',
            'PhysicalResourceId': physical_resource_id,
            'Data': {
                'VersionNumber': version_number,
                'GuardrailId': guardrail_id
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to create guardrail version: {str(e)}")
        raise

def handle_update(event: Dict[str, Any], guardrail_id: str, version_description: str, physical_resource_id: str) -> Dict[str, Any]:
    """Handle UPDATE requests"""
    old_properties = event.get('OldResourceProperties', {})
    new_properties = event['ResourceProperties']
    
    old_config_hash = old_properties.get('ConfigurationHash', '')
    new_config_hash = new_properties.get('ConfigurationHash', '')
    
    # If configuration hash changed, create a new version
    if old_config_hash != new_config_hash:
        logger.info(f"Configuration changed, creating new version for guardrail {guardrail_id}")
        return handle_create(guardrail_id, version_description, physical_resource_id)
    else:
        # No change needed, return existing version
        logger.info(f"No configuration change detected for guardrail {guardrail_id}")
        
        # Get the latest version number
        try:
            response = bedrock.list_guardrails(
                guardrailIdentifier=guardrail_id
            )
            
            # Find the latest version
            latest_version = "1"  # Default fallback
            if 'guardrails' in response and response['guardrails']:
                guardrail = response['guardrails'][0]
                latest_version = guardrail.get('version', '1')
            
            return {
                'Status': 'SUCCESS',
                'PhysicalResourceId': physical_resource_id,
                'Data': {
                    'VersionNumber': latest_version,
                    'GuardrailId': guardrail_id
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get latest version: {str(e)}")
            # Return a safe default
            return {
                'Status': 'SUCCESS',
                'PhysicalResourceId': physical_resource_id,
                'Data': {
                    'VersionNumber': "1",
                    'GuardrailId': guardrail_id
                }
            }

def handle_delete(event: Dict[str, Any], physical_resource_id: str) -> Dict[str, Any]:
    """Handle DELETE requests"""
    logger.info(f"Handling delete for resource {physical_resource_id}")
    
    # Note: We don't delete guardrail versions as they may be in use
    # and Bedrock manages version lifecycle
    
    return {
        'Status': 'SUCCESS',
        'PhysicalResourceId': physical_resource_id,
        'Data': {}
    }
`),
                timeout: cdk.Duration.minutes(5),
                architecture: lambda.Architecture.ARM_64,
            },
        );

        // Grant permissions to manage guardrails
        customResourceFunction.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    "bedrock:CreateGuardrailVersion",
                    "bedrock:ListGuardrails",
                    "bedrock:GetGuardrail",
                ],
                resources: [
                    `arn:aws:bedrock:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:guardrail/*`,
                ],
            }),
        );

        // Create the custom resource provider
        this.provider = new cr.Provider(this, "GuardrailVersionProvider", {
            onEventHandler: customResourceFunction,
            logRetention: cdk.aws_logs.RetentionDays.ONE_WEEK,
        });

        // Create the custom resource
        const customResource = new cdk.CustomResource(
            this,
            "GuardrailVersionResource",
            {
                serviceToken: this.provider.serviceToken,
                properties: {
                    GuardrailId: props.guardrailId,
                    VersionDescription:
                        props.versionDescription || "Auto-generated version",
                    ConfigurationHash: props.configurationHash,
                },
            },
        );

        // Extract the version number from the custom resource
        this.versionNumber = customResource.getAttString("VersionNumber");
    }
}
