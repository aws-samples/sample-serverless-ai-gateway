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
