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
import { Wafv2BasicConstruct, WafV2Scope } from "@aws-pace/constructs";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export class CfWafStack extends cdk.Stack {
    /**
     * Name of the WafArn SSM parameter
     */
    public ssmWafArnParameterName: string;

    constructor(scope: Construct, id: string, props: cdk.StackProps) {
        super(scope, id, props);

        // ssm parameter name must be unique in a region
        this.ssmWafArnParameterName = "waf_acl_arn_" + this.stackName;

        // requires us-east-1 for deployment to work due to limitations with the service.
        // for deployments outside of us-east-1 deploy waf separately
        const wafv2CF = new Wafv2BasicConstruct(this, "Wafv2CF", {
            wafScope: WafV2Scope.CLOUDFRONT,
            rules: [
                {
                    name: "CRSRule",
                    overrideAction: {
                        none: {},
                    },
                    priority: 1,
                    statement: {
                        managedRuleGroupStatement: {
                            name: "AWSManagedRulesCommonRuleSet",
                            vendorName: "AWS",
                        },
                    },
                    visibilityConfig: {
                        cloudWatchMetricsEnabled: true,
                        sampledRequestsEnabled: true,
                        metricName: "CfWebACLMetric-CRS",
                    },
                },
            ],
        });

        new cdk.aws_ssm.StringParameter(this, "waf_acl_arn", {
            parameterName: this.ssmWafArnParameterName,
            description: "WAF ACL ARN",
            stringValue: wafv2CF.webacl.attrArn,
        });
    }
}
