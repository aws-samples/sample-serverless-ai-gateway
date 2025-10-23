/**
 * Copyright 2024 Amazon.com, Inc. and its affiliates. All Rights Reserved.
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
import { Construct } from "constructs";

export interface VpcConstructProps extends cdk.StackProps {
    /**
     * The CIDR range to use for the VPC, e.g. '10.0.0.0/20'
     * Should be a minimum of /28 and maximum size of /16. The range will be split across all subnets per Availability Zone.
     *
     * @default 10.0.0.0/20 which covers 2 subnets per az up to 6 az's when using 24 as CidrMask
     */
    readonly cidr?: string;

    /**
     * The number of NAT Gateways/Instances to create.
     * Should be equal to or less than maxAzs.  Lower number saves money and EIP's
     *
     * @default 2
     */
    readonly natGateways?: number;

    /**
     * Configure the subnets to build for each AZ.
     *
     * @default 2
     */
    readonly maxAzs?: number;

    /**
     * The number of leading 1 bits in the routing mask for the public subnet.
     *
     * @default 24
     */
    readonly publicCidrMask?: number;

    /**
     * The number of leading 1 bits in the routing mask for the public subnet.
     *
     * @default 24
     */
    readonly privateCidrMask?: number;

    /**
     * Attaches an S3 Gateway endpoint into the VPC.  Set to false if you don't use S3
     *
     * @default true
     */
    readonly hasS3GatewayEndpoint?: boolean;

    /**
     * Attaches a DynamoDB Gateway endpoint into the VPC.  Set to false if you don't use DynamoDB
     *
     * @default true
     */
    readonly hasDynamoDbGatewayEndpoint?: boolean;

    /**
     * Attaches an API gateway execute-api endpoint into the VPC.
     *
     * @default false
     */
    readonly hasApiGwEndpoint?: boolean;

    /**
     * Sets the bucket for VPC flow logging, failure to do so is an audit flag as per:
     * https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-cis-controls.html
     *
     * @default none
     */
    readonly loggingBucket?: cdk.aws_s3.Bucket;
}

const defaultProps: Partial<VpcConstructProps> = {
    cidr: "10.0.0.0/20",
    natGateways: 2,
    maxAzs: 2,
    publicCidrMask: 24,
    privateCidrMask: 24,
    hasS3GatewayEndpoint: true,
    hasDynamoDbGatewayEndpoint: true,
    hasApiGwEndpoint: false,
};

/**
 * Creates a VPC with a public and private shared subnet.
 *
 * The default VPC has a large address range to support additional private subnets for each app deployed into the VPC.
 * App deployments can either deploy into the SharedPublic/SharedPrivate or create separate
 * private subnets for each deployment.  App subnets should be attached in the application stack.
 */
export class VpcConstruct extends Construct {
    public vpc: cdk.aws_ec2.IVpc;
    public apiGwVpcEndpoint?: cdk.aws_ec2.InterfaceVpcEndpoint;

    constructor(parent: Construct, name: string, props: VpcConstructProps) {
        super(parent, name);

        props = { ...defaultProps, ...props };

        // see for transition to IPAMPool allocations. It's a solution for having to define specific blocks for subnets
        // - https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.IpAddresses.html
        // - https://docs.aws.amazon.com/vpc/latest/ipam/allocate-cidrs-ipam.html

        const vpc = new cdk.aws_ec2.Vpc(this, "Vpc", {
            ipAddresses: cdk.aws_ec2.IpAddresses.cidr(props.cidr!),
            natGateways: props.natGateways,
            maxAzs: props.maxAzs,
            subnetConfiguration: [
                {
                    name: "PublicShared",
                    subnetType: cdk.aws_ec2.SubnetType.PUBLIC,
                    cidrMask: props.publicCidrMask,
                },
                {
                    name: "PrivateShared",
                    subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
                    cidrMask: props.privateCidrMask,
                },
            ],
        });

        // add S3 private gateway endpoint
        if (props.hasS3GatewayEndpoint) {
            vpc.addGatewayEndpoint("S3GatewayEndpoint", {
                service: cdk.aws_ec2.GatewayVpcEndpointAwsService.S3,
            });
        }

        // attach dynamodb gateway endpoint
        if (props.hasDynamoDbGatewayEndpoint) {
            vpc.addGatewayEndpoint("DynamoDbGatewayEndpoint", {
                service: cdk.aws_ec2.GatewayVpcEndpointAwsService.DYNAMODB,
            });
        }

        // attach api gateway endpoint
        if (props.hasApiGwEndpoint) {
            this.apiGwVpcEndpoint = vpc.addInterfaceEndpoint(
                "ApiGwGatewayEndpoint",
                {
                    service:
                        cdk.aws_ec2.InterfaceVpcEndpointAwsService.APIGATEWAY,
                },
            );
        }

        // configure VPC flow logs.
        // doing so is optional in this construct, but failing to do so will trigger:
        // https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-cis-controls.html
        if (props.loggingBucket) {
            const vpcFlowLogRole = new cdk.aws_iam.Role(
                this,
                "vpcFlowLogRole",
                {
                    assumedBy: new cdk.aws_iam.ServicePrincipal(
                        "vpc-flow-logs.amazonaws.com",
                    ),
                },
            );
            props.loggingBucket.grantWrite(vpcFlowLogRole, "VpcFlowLogs/*");

            new cdk.aws_ec2.FlowLog(this, "VpcFLowLogs", {
                destination: cdk.aws_ec2.FlowLogDestination.toS3(
                    props.loggingBucket,
                    "VpcFlowLogs/",
                ),
                trafficType: cdk.aws_ec2.FlowLogTrafficType.ALL,
                flowLogName: "VpcFlowLogs",
                resourceType: cdk.aws_ec2.FlowLogResourceType.fromVpc(vpc),
            });
        }

        new cdk.aws_ssm.StringParameter(this, "VpcIdParameter", {
            parameterName: "vpc-id",
            stringValue: vpc.vpcId,
        });

        //Outputs
        new cdk.CfnOutput(this, `Id`, {
            value: vpc.vpcId,
        });

        this.vpc = vpc;
    }
}
