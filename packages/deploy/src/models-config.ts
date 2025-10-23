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

/**
 * Model configuration interface
 */
export interface ModelConfig {
    /** The inference profile ID */
    inferenceProfileId: string;
    /** Human-readable name for the model */
    inferenceProfileName: string;
    /** The foundation model ID (without region/account) */
    foundationModelId: string;
    /** Regions where the inference profile is available (load balanced) */
    inferenceProfileRegions: string[];
    /** Regions where the foundation model is available */
    foundationModelRegions: string[];
}

/**
 * Complete models configuration
 */
export interface ModelsConfig {
    models: ModelConfig[];
    defaultModelId: string;
}

/**
 * Generate the models configuration
 */
export function generateModelsConfig(): ModelsConfig {
    const models: ModelConfig[] = [
        {
            inferenceProfileId: "us.anthropic.claude-opus-4-1-20250805-v1:0",
            inferenceProfileName: "US Anthropic Claude Opus 4.1",
            foundationModelId: "anthropic.claude-opus-4-1-20250805-v1:0",
            inferenceProfileRegions: ["us-east-1", "us-east-2", "us-west-2"],
            foundationModelRegions: ["us-east-1", "us-east-2", "us-west-2"],
        },
        {
            inferenceProfileId: "us.amazon.nova-premier-v1:0",
            inferenceProfileName: "US Nova Premier",
            foundationModelId: "amazon.nova-premier-v1:0",
            inferenceProfileRegions: ["us-east-1", "us-east-2", "us-west-2"],
            foundationModelRegions: ["us-east-1", "us-east-2", "us-west-2"],
        },
        {
            inferenceProfileId: "us.amazon.nova-pro-v1:0",
            inferenceProfileName: "US Nova Pro",
            foundationModelId: "amazon.nova-pro-v1:0",
            inferenceProfileRegions: ["us-east-1", "us-east-2", "us-west-2"],
            foundationModelRegions: ["us-east-1", "us-east-2", "us-west-2"],
        },
        {
            inferenceProfileId: "us.amazon.nova-micro-v1:0",
            inferenceProfileName: "US Nova Micro",
            foundationModelId: "amazon.nova-micro-v1:0",
            inferenceProfileRegions: ["us-east-1", "us-east-2", "us-west-2"],
            foundationModelRegions: ["us-east-1", "us-east-2", "us-west-2"],
        },
        {
            inferenceProfileId: "us.amazon.nova-lite-v1:0",
            inferenceProfileName: "US Nova Lite",
            foundationModelId: "amazon.nova-lite-v1:0",
            inferenceProfileRegions: ["us-east-1", "us-east-2", "us-west-2"],
            foundationModelRegions: ["us-east-1", "us-east-2", "us-west-2"],
        },

        {
            inferenceProfileId: "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
            inferenceProfileName: "US Anthropic Claude 3.7 Sonnet",
            foundationModelId: "anthropic.claude-3-7-sonnet-20250219-v1:0",
            inferenceProfileRegions: ["us-east-1", "us-east-2", "us-west-2"],
            foundationModelRegions: ["us-east-1", "us-east-2", "us-west-2"],
        },

        {
            inferenceProfileId: "us.anthropic.claude-sonnet-4-20250514-v1:0",
            inferenceProfileName: "US Anthropic Claude Sonnet 4",
            foundationModelId: "anthropic.claude-sonnet-4-20250514-v1:0",
            inferenceProfileRegions: ["us-east-1", "us-east-2", "us-west-2"],
            foundationModelRegions: ["us-east-1", "us-east-2", "us-west-2"],
        },

        {
            inferenceProfileId: "us.meta.llama3-3-70b-instruct-v1:0",
            inferenceProfileName: "US Meta Llama 3.3 70B Instruct",
            foundationModelId: "meta.llama3-3-70b-instruct-v1:0",
            inferenceProfileRegions: ["us-east-1", "us-east-2", "us-west-2"],
            foundationModelRegions: ["us-east-1", "us-east-2", "us-west-2"],
        },
        {
            inferenceProfileId: "us.meta.llama4-scout-17b-instruct-v1:0",
            inferenceProfileName: "US Meta Llama 4 Scout 17B Instruct",
            foundationModelId: "meta.llama4-scout-17b-instruct-v1:0",
            inferenceProfileRegions: ["us-east-1", "us-east-2", "us-west-2"],
            foundationModelRegions: ["us-east-1", "us-east-2", "us-west-2"],
        },
        {
            inferenceProfileId: "us.meta.llama4-maverick-17b-instruct-v1:0",
            inferenceProfileName: "US Meta Llama 4 Maverick 17B Instruct",
            foundationModelId: "meta.llama4-maverick-17b-instruct-v1:0",
            inferenceProfileRegions: ["us-east-1", "us-east-2", "us-west-2"],
            foundationModelRegions: ["us-east-1", "us-east-2", "us-west-2"],
        },
        {
            inferenceProfileId: "us.deepseek.r1-v1:0",
            inferenceProfileName: "US DeepSeek-R1",
            foundationModelId: "deepseek.r1-v1:0",
            inferenceProfileRegions: ["us-east-1", "us-east-2", "us-west-2"],
            foundationModelRegions: ["us-east-1", "us-east-2", "us-west-2"],
        },
        {
            inferenceProfileId: "us.mistral.pixtral-large-2502-v1:0",
            inferenceProfileName: "US Mistral Pixtral Large 25.02",
            foundationModelId: "mistral.pixtral-large-2502-v1:0",
            inferenceProfileRegions: ["us-east-1", "us-east-2", "us-west-2"],
            foundationModelRegions: ["us-east-1", "us-east-2", "us-west-2"],
        },
    ];

    return {
        models,
        defaultModelId: "us.anthropic.claude-sonnet-4-20250514-v1:0",
    };
}

/**
 * Generate precise Bedrock IAM permissions for the configured models
 */
export function generateBedrockPermissions(
    modelsConfig: ModelsConfig,
    account: string,
): string[] {
    const resources = new Set<string>();

    // Add inference profile ARNs for all regions where they're available
    modelsConfig.models.forEach((model) => {
        model.inferenceProfileRegions.forEach((region) => {
            resources.add(
                `arn:aws:bedrock:${region}:${account}:inference-profile/${model.inferenceProfileId}`,
            );
        });
    });

    // Add foundation model ARNs for all regions where they're available
    modelsConfig.models.forEach((model) => {
        model.foundationModelRegions.forEach((region) => {
            resources.add(
                `arn:aws:bedrock:${region}::foundation-model/${model.foundationModelId}`,
            );
        });
    });

    return Array.from(resources).sort();
}

/**
 * Generate frontend-compatible model data
 */
export function generateFrontendModelData(modelsConfig: ModelsConfig) {
    return {
        models: modelsConfig.models.map((model) => ({
            id: model.inferenceProfileId,
            name: model.inferenceProfileName
                .replace("US ", "")
                .replace(/^[A-Za-z]+ /, ""),
            providerName: extractProviderFromProfileName(
                model.inferenceProfileName,
            ),
            inferenceProfileId: model.inferenceProfileId,
            foundationModelId: model.foundationModelId,
            contextWindow: extractContextWindow(model.inferenceProfileId),
        })),
        defaultModelId: modelsConfig.defaultModelId,
    };
}

/**
 * Extract provider name from inference profile name
 */
function extractProviderFromProfileName(profileName: string): string {
    // Special case for Nova models, which are from Amazon
    if (profileName.includes("Nova")) {
        return "Amazon";
    }

    // Profile names are like "US Anthropic Claude 3.5 Sonnet"
    const parts = profileName.split(" ");
    if (parts.length >= 2) {
        // Skip the "US" prefix and get the provider name
        return parts[1];
    }
    return "Unknown";
}

/**
 * Parse model ID to extract context window information if available
 */
function extractContextWindow(modelId: string): string | undefined {
    // Extract context window from model ID patterns like:
    // - amazon.nova-premier-v1:0:8k
    // - amazon.nova-premier-v1:0:1000k
    // - amazon.nova-premier-v1:0:mm (multimodal)
    const match = modelId.match(/:(\d+k|mm)$/);
    if (match) {
        return match[1];
    }
    return undefined;
}
