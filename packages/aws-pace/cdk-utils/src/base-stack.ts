import { CfnElement, Stack } from "aws-cdk-lib";
import { CommonEnvironmentConfig } from "./environment-config";

export class BaseStack extends Stack {
    public allocateLogicalId(element: CfnElement) {
        const environments = this.node.tryGetContext("environments");

        if (!environments) {
            return super.allocateLogicalId(element);
        }

        const commonEnvironmentConfig =
            environments.common as CommonEnvironmentConfig;

        const orig = super.allocateLogicalId(element);
        const prefix = commonEnvironmentConfig.resourcePrefix;
        return prefix ? prefix + orig : orig;
    }
}
