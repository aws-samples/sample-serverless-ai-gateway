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
 * Common configuration across all environments (found in the cdk.context.json)
 */
export interface CommonEnvironmentConfig {
    /**
     * Name of the project (e.g. Taurus) [REQUIRED]
     */
    projectName: string;

    /**
     * The primary owner for the project/resources [REQUIRED]
     */
    primaryOwner: string;

    /**
     * The stack name prefix
     */
    stackPrefix: string;

    resourcePrefix: string;
}

/**
 * Per environment configuration (found in the cdk.context.json)
 */
export interface EnvironmentConfig {
    /**
     * Certificate arn for elb to use for HTTPS
     */
    webAppCertificateArn: string;

    /**
     * Private Subnets to use for deployment
     */
    vpcPrivateSubnets: string;

    vpcId: string;
    permissionsBoundary: string;

    cpuArchitecture: "ARM64" | "X86";
}
