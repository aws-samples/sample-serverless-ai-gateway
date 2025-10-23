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

import * as crypto from "crypto";
import * as bedrock from "aws-cdk-lib/aws-bedrock";
import { Effect, IGrantable, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { GuardrailVersionCustomResource } from "./guardrail-version-custom-resource";

export interface ContentFilterConfig {
    readonly type: string;
    readonly inputStrength: string;
    readonly outputStrength: string;
}

export interface PiiEntityConfig {
    readonly type: string;
    readonly action: string;
}

export interface BedrockGuardrailsProps {
    readonly guardrailName: string;
    readonly description?: string;
    readonly kmsKeyArn?: string;
    readonly contentFilters?: ContentFilterConfig[];
    readonly piiEntityConfigs?: PiiEntityConfig[];
    readonly blockedInputMessaging?: string;
    readonly blockedOutputMessaging?: string;
}

/**
 * A CDK construct that creates Amazon Bedrock Guardrails for content filtering and PII protection
 */
export class BedrockGuardrails extends Construct {
    public readonly guardrailArn: string;
    public readonly guardrailId: string;
    public readonly guardrailVersionId: string;

    constructor(scope: Construct, id: string, props: BedrockGuardrailsProps) {
        super(scope, id);

        // Default content filters with MEDIUM strength
        const defaultContentFilters: ContentFilterConfig[] = [
            {
                type: "SEXUAL",
                inputStrength: "MEDIUM",
                outputStrength: "MEDIUM",
            },
            {
                type: "VIOLENCE",
                inputStrength: "MEDIUM",
                outputStrength: "MEDIUM",
            },
            {
                type: "HATE",
                inputStrength: "MEDIUM",
                outputStrength: "MEDIUM",
            },
            {
                type: "INSULTS",
                inputStrength: "MEDIUM",
                outputStrength: "MEDIUM",
            },
            {
                type: "MISCONDUCT",
                inputStrength: "MEDIUM",
                outputStrength: "MEDIUM",
            },
            {
                type: "PROMPT_ATTACK",
                inputStrength: "MEDIUM",
                outputStrength: "NONE",
            },
        ];

        // Default PII entities for anonymization
        const defaultPiiEntities: PiiEntityConfig[] = [
            "EMAIL",
            "PHONE",
            // "US_SOCIAL_SECURITY_NUMBER",
            "CREDIT_DEBIT_CARD_NUMBER",
            "AWS_ACCESS_KEY",
            "AWS_SECRET_KEY",
            "PASSWORD",
        ].map((type) => ({
            type: type,
            action: "ANONYMIZE",
        }));

        // Create the guardrail
        const guardrail = new bedrock.CfnGuardrail(this, "Guardrail", {
            name: props.guardrailName,
            description:
                props.description || `Guardrail for ${props.guardrailName}`,
            contentPolicyConfig: {
                filtersConfig: (
                    props.contentFilters || defaultContentFilters
                ).map((filter) => ({
                    type: filter.type,
                    inputStrength: filter.inputStrength,
                    outputStrength: filter.outputStrength,
                })),
            },
            sensitiveInformationPolicyConfig: {
                piiEntitiesConfig: (
                    props.piiEntityConfigs || defaultPiiEntities
                ).map((config) => ({
                    type: config.type,
                    action: config.action,
                })),
            },
            blockedInputMessaging:
                props.blockedInputMessaging ||
                "I'm not able to respond to that right now.",
            blockedOutputsMessaging:
                props.blockedOutputMessaging ||
                "I'm not able to provide this information right now.",
            ...(props.kmsKeyArn && { kmsKeyArn: props.kmsKeyArn }),
        });

        this.guardrailArn = guardrail.attrGuardrailArn;
        this.guardrailId = guardrail.attrGuardrailId;

        // Create a configuration hash to trigger version updates when config changes
        const configurationHash = this.createConfigurationHash(
            props.contentFilters || defaultContentFilters,
            props.piiEntityConfigs || defaultPiiEntities,
            props.blockedInputMessaging,
            props.blockedOutputMessaging,
        );

        // Create a dynamic guardrail version using custom resource
        const guardrailVersionResource = new GuardrailVersionCustomResource(
            this,
            "GuardrailVersionResource",
            {
                guardrailId: guardrail.attrGuardrailId,
                versionDescription: `Auto-generated version for ${props.guardrailName}`,
                configurationHash: configurationHash,
            },
        );

        // Ensure the version is created after the guardrail
        guardrailVersionResource.node.addDependency(guardrail);

        this.guardrailVersionId = guardrailVersionResource.versionNumber;
    }

    /**
     * Create a configuration hash to detect changes in guardrail configuration
     * @param contentFilters The content filter configuration
     * @param piiEntityConfigs The PII entity configuration
     * @param blockedInputMessaging The blocked input messaging
     * @param blockedOutputMessaging The blocked output messaging
     * @returns A hash string representing the configuration
     */
    private createConfigurationHash(
        contentFilters: ContentFilterConfig[],
        piiEntityConfigs: PiiEntityConfig[],
        blockedInputMessaging?: string,
        blockedOutputMessaging?: string,
    ): string {
        const configData = {
            contentFilters: contentFilters.sort((a, b) =>
                a.type.localeCompare(b.type),
            ),
            piiEntityConfigs: piiEntityConfigs.sort((a, b) =>
                a.type.localeCompare(b.type),
            ),
            blockedInputMessaging: blockedInputMessaging || "",
            blockedOutputMessaging: blockedOutputMessaging || "",
        };

        const configString = JSON.stringify(configData);
        return crypto
            .createHash("sha256")
            .update(configString)
            .digest("hex")
            .substring(0, 16);
    }

    /**
     * Grant permissions to use guardrails
     * @param grantable The grantable resource (e.g., Lambda function, IAM role)
     */
    grant(grantable: IGrantable) {
        grantable.grantPrincipal.addToPrincipalPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    "bedrock:GetGuardrail",
                    "bedrock:ListGuardrails",
                    "bedrock:ApplyGuardrail",
                ],
                resources: [this.guardrailArn],
            }),
        );
    }
}
