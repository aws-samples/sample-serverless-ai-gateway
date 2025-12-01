import * as cdk from "aws-cdk-lib";
// import { NagSuppressions } from "cdk-nag";

/**
 * General cdk nag suppressions to allow infrastructure that is acceptable for a prototype
 */
export const suppressCdkNagRules = (_stack: cdk.Stack) => {
    // General nag suppressions were moved to packages/aws-pace/cdk-utils/src/cdk-nag-suppressions.ts
    // Use this file for project specific suppressions.
};
