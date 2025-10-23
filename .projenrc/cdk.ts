import path from "path";
import { SampleDir } from "projen";
import {
    AwsCdkTypeScriptApp,
    AwsCdkTypeScriptAppOptions,
} from "projen/lib/awscdk";

export interface CDKBlueprintOptions extends AwsCdkTypeScriptAppOptions {}
export class CDKBlueprint extends AwsCdkTypeScriptApp {
    constructor(options: CDKBlueprintOptions) {
        const deps = Object.entries({
            "@aws/pdk": "",
            "@aws-pace/cdk-utils": "workspace:*",
            "@aws-pace/constructs": "workspace:*",
            "@aws-cdk/aws-lambda-python-alpha": "^2.114.1-alpha.0",
            "aws-sdk": "^2.1518.0",
            "cdk-nag": "^2.27.216",
            constructs: "^10.3.0",
            "source-map-support": "^0.5.16",
            "ts-node": "^10.9.2",
        }).map(([name, version]) => `${name}@${version}`);

        const devDeps = Object.entries({
            "@types/jest": "^29.5.11",
            "@types/node": "20.10.4",
        }).map(([name, version]) => `${name}@${version}`);

        super({
            ...options,
            appEntrypoint: "app.ts",
            sampleCode: false,
            deps: [...deps, ...(options.deps ?? [])],
            devDeps: [...devDeps, ...(options.devDeps ?? [])],
            context: {
                // https://aws.amazon.com/blogs/devops/secure-cdk-deployments-with-iam-permission-boundaries/
                // "@aws-cdk/core:permissionsBoundary": {
                //     name: permissionsBoundary.permsBoundaryPolicyName,
                // },
                // "@aws-cdk/core:bootstrapQualifier": permissionsBoundary.cdkQualifier,
                "@aws-cdk/aws-apigateway:usagePlanKeyOrderInsensitiveId": true,
                "@aws-cdk/core:stackRelativeExports": true,
                "@aws-cdk/aws-rds:lowercaseDbIdentifier": true,
                "@aws-cdk/aws-lambda:recognizeVersionProps": true,
                "@aws-cdk/aws-cloudfront:defaultSecurityPolicyTLSv1.2_2021":
                    true,
                "@aws-cdk/aws-lambda:recognizeLayerVersion": true,
                "@aws-cdk/core:checkSecretUsage": true,
                "@aws-cdk/core:target-partitions": ["aws", "aws-cn"],
                "@aws-cdk-containers/ecs-service-extensions:enableDefaultLogDriver":
                    true,
                "@aws-cdk/aws-ec2:uniqueImdsv2TemplateName": true,
                "@aws-cdk/aws-ecs:arnFormatIncludesClusterName": true,
                "@aws-cdk/aws-iam:minimizePolicies": true,
                "@aws-cdk/core:validateSnapshotRemovalPolicy": true,
                "@aws-cdk/aws-codepipeline:crossAccountKeyAliasStackSafeResourceName":
                    true,
                "@aws-cdk/aws-s3:createDefaultLoggingPolicy": true,
                "@aws-cdk/aws-sns-subscriptions:restrictSqsDescryption": true,
                "@aws-cdk/aws-apigateway:disableCloudWatchRole": true,
                "@aws-cdk/core:enablePartitionLiterals": true,
                "@aws-cdk/aws-events:eventsTargetQueueSameAccount": true,
                "@aws-cdk/aws-iam:standardizedServicePrincipals": true,
                "@aws-cdk/aws-ecs:disableExplicitDeploymentControllerForCircuitBreaker":
                    true,

                ...options.context,
            },
        });

        new SampleDir(this, "src", {
            sourceDir: path.join(
                __dirname,
                "..",
                "blueprints",
                "serverless-v2",
                "deploy",
                "src",
            ),
        });

        this.tryFindObjectFile("package.json")?.addOverride(
            "jest.modulePathIgnorePatterns",
            ["<rootDir>/cdk.out/"],
        );

        this.tsconfig?.addInclude("test/**/*.ts");
    }
}
