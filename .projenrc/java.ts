/**
 * Copyright (c) 2024 Amazon.com, Inc. and its affiliates.
 * All Rights Reserved.
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

import { JavaProject, JavaProjectOptions } from "projen/lib/java";

export class JavaProjectBase extends JavaProject {
    constructor(options: JavaProjectOptions) {
        super({
            ...options,
        });

        this.addTask("java-audit", {
            exec: "mvn dependency-check:check",
        });
    }

    setProperties(properties: Record<string, string>) {
        this.tryFindObjectFile("pom.xml")?.addOverride(
            "project.properties",
            properties,
        );
    }

    addAwsSdkDependencyManagement() {
        this.tryFindObjectFile("pom.xml")?.addToArray(
            "project.dependencyManagement.dependencies.dependency",
            {
                groupId: "software.amazon.awssdk",
                artifactId: "bom",
                version: "${aws.java.sdk.version}",
                type: "pom",
                scope: "import",
            },
        );
    }

    setCompilerVersion() {
        this.tryFindObjectFile("pom.xml")?.addOverride(
            "project.build.plugins.plugin.0.configuration",
            {
                source: "${maven.compiler.source}",
                target: "${maven.compiler.target}",
            },
        );
    }

    addBuildPlugin(plugin: any) {
        this.tryFindObjectFile("pom.xml")?.addToArray(
            "project.build.plugins.plugin",
            plugin,
        );
    }

    addDependencyCheckPlugin() {
        this.addBuildPlugin({
            groupId: "org.owasp",
            artifactId: "dependency-check-maven",
            version: "10.0.4",
            executions: [
                {
                    execution: {
                        goals: [{ goal: "check" }],
                    },
                },
            ],
        });
    }

    addLambdaPowerToolsPlugin(javaCompilerVersion: "17" | "23" = "17") {
        this.addBuildPlugin({
            groupId: "dev.aspectj",
            artifactId: "aspectj-maven-plugin",
            version: "1.13.1",
            configuration: {
                source: javaCompilerVersion,
                target: javaCompilerVersion,
                complianceLevel: javaCompilerVersion,
                aspectLibraries: {
                    aspectLibrary: [
                        {
                            groupId: "software.amazon.lambda",
                            artifactId: "powertools-logging",
                        },
                        {
                            groupId: "software.amazon.lambda",
                            artifactId: "powertools-tracing",
                        },
                        {
                            groupId: "software.amazon.lambda",
                            artifactId: "powertools-metrics",
                        },
                    ],
                },
            },
            executions: {
                execution: {
                    goals: { goal: "compile" },
                },
            },
        });

        this.tryFindObjectFile("pom.xml")?.addToArray(
            "project.dependencyManagement.dependencies.dependency",
            {
                groupId: "software.amazon.awssdk",
                artifactId: "bom",
                version: "${aws.java.sdk.version}",
                type: "pom",
                scope: "import",
            },
        );
    }

    addLambdaLayerCopyDependenciesBuildPlugin() {
        this.addBuildPlugin({
            groupId: "org.apache.maven.plugins",
            artifactId: "maven-dependency-plugin",
            version: "3.5.0",
            executions: [
                {
                    execution: {
                        phase: "package",
                        goals: [{ goal: "copy-dependencies" }],
                        configuration: {
                            outputDirectory:
                                "${project.build.directory}/layer/java/lib",
                            overWriteReleases: false,
                            overWriteSnapshots: false,
                            overWriteIfNewer: true,
                            includeScope: "runtime",
                        },
                    },
                },
            ],
        });
    }

    addShadeBuildPlugin() {
        this.addBuildPlugin({
            groupId: "org.apache.maven.plugins",
            artifactId: "maven-shade-plugin",
            version: "3.2.2",
            configuration: {
                createDependencyReducedPom: "false",
            },
            executions: {
                execution: {
                    phase: "package",
                    goals: {
                        goal: "shade",
                    },
                    configuration: {
                        finalName:
                            "${project.artifactId}-${project.version}-shade", // .jar included by default
                        transformers: {
                            "@": {
                                transformer:
                                    "com.github.edwgiz.maven_shade_plugin.log4j2_cache_transformer.PluginsCacheFileTransformer",
                            },
                        },
                    },
                },
            },
            dependencies: {
                dependency: [
                    {
                        groupId: "com.github.edwgiz",
                        artifactId:
                            "maven-shade-plugin.log4j2-cachefile-transformer",
                        version: "2.13.0",
                    },
                ],
            },
        });
    }

    addAssemblyPluginJarWithDependencies(mainClass: string) {
        this.addBuildPlugin({
            groupId: "org.apache.maven.plugins",
            artifactId: "maven-assembly-plugin",
            executions: [
                {
                    execution: {
                        phase: "package",
                        goals: {
                            goal: "single",
                        },
                        configuration: {
                            archive: {
                                manifest: {
                                    mainClass,
                                },
                            },
                        },
                    },
                },
            ],
            configuration: {
                descriptorRefs: {
                    descriptorRef: "jar-with-dependencies",
                },
            },
        });
    }
}
