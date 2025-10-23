import { javascript } from "projen";
import { monorepo } from "@aws/pdk";
import { VscodeSettings } from "./.projenrc/vscode";
import {
    PythonProjectOverrides,
    PythonLambdaFunction,
} from "./.projenrc/python";
import { TypeScriptProject } from "projen/lib/typescript";
import { CDKBlueprint } from "./.projenrc/cdk";
import { TypescriptViteShadcnProject } from "./.projenrc/vite-shadcn";

const packageManager = javascript.NodePackageManager.PNPM;
const defaultReleaseBranch = "main";

// use this to define your cdk version
const cdkVersion = "2.189.1";

// use these in your cdk context
const region = "us-east-1";
const stack_name = "appsync-events-ai-gateway";

const pnpmOverrides = {
    "npm-check-updates": ">=18.3.0",
    constructs: ">=10.4.2",
    "@aws/pdk": ">=0.26.14",
    "aws-cdk-lib": ">=2.189.1",
    "@aws-cdk/aws-cognito-identitypool-alpha": ">=2.186.0-alpha.0",
    "cdk-nag": ">=2.34.23",
    "semver@>=7.0.0 <7.5.2": ">=7.5.2",
    "ip@<1.1.9": ">=1.1.9",
    "ip@=2.0.0": ">=2.0.1",
    "follow-redirects@<=1.15.5": ">=1.15.6",
    "tar@<6.2.1": ">=6.2.1",
    "node-fetch@<2.6.7": ">=2.6.7",
    "@zkochan/js-yaml": "npm:js-yaml@4.1.0",
    "@babel/helpers": ">=7.26.10",
    "wrap-ansi": "^7.0.0",
    "fast-xml-parser": ">=4.4.1",
    vite: ">=7.1.5",
    vitest: ">=2.1.9",
    esbuild: ">=0.25.0",
    axios: ">=1.12.0",
    // nanoid: ">=3.3.8",
    // "vue-template-compiler": ">=3.0.0",
    "cross-spawn": ">=7.0.5",
    rollup: ">=4.22.4",
    // latest release is 2.7.16 ???
    // "vue-template-compiler": ">=3.0.0",
    micromatch: ">=4.0.8",
    braces: ">=3.0.3",
    tmp: ">=0.2.4",
};

const prettierOptions = {
    prettier: true,
    prettierOptions: {
        settings: {
            tabWidth: 4,
            singleQuote: false,
        },
    },
};

const project = new monorepo.MonorepoTsProject({
    devDeps: ["@aws/pdk@^0.26.14", "@types/node@^22"],
    name: "anyco-project-name",
    packageManager,
    defaultReleaseBranch,
    projenrcTs: true,
    licensed: true,
    license: "MIT-0",
    copyrightOwner: "Amazon.com, Inc. or its affiliates. All Rights Reserved.",
    licenseOptions: {
        spdx: "MIT-0",
        licenseText: `MIT No Attribution

Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
        `,
        copyrightOwner:
            "Amazon.com, Inc. or its affiliates. All Rights Reserved.",
    },
    eslint: false,
    ...prettierOptions,
});
project.nx.nxIgnore.addPatterns("**/cdk.out");
project.gitignore.addPatterns(
    "**/__pycache__",
    "**/.DS_Store",
    "**/*.wav",
    "**/*.mp3",
    "**/*.aac",
    "**/*.mp4",
);
project.package.file.addOverride("pnpm.overrides", pnpmOverrides);

project.addTask("licenses-report", {
    steps: [
        {
            exec: "pnpm licenses ls --json --long > pnpm-licenses.json",
        },
        {
            exec: "nx run-many -t licensecheck",
        },
        {
            exec: "poetry run python license-report.py --pnpm-license-file pnpm-licenses.json --licensecheck-file licensecheck-output.json --cwd ../../../ > ../../../licenses.md",
            cwd: "packages/aws-pace/prototyping-tools",
        },
        {
            exec: "which pandoc && pandoc licenses.md -o licenses.pdf --pdf-engine=xelatex -V geometry:landscape || echo install pandoc to convert licenses.md to pdf",
        },
    ],
});

const semgrepFileName = "semgrep-scan-results.sarif";
project.addTask("semgrep/code-scan", {
    steps: [
        {
            exec: `rm -f ${semgrepFileName}`,
        },
        {
            exec: `docker run --rm -v "$PWD:/src" semgrep/semgrep semgrep scan --config auto --output ${semgrepFileName} --sarif`,
        },
    ],
});
project.gitignore.addPatterns(semgrepFileName);

new TypeScriptProject({
    parent: project,
    defaultReleaseBranch,
    packageManager,
    name: "@aws-pace/constructs",
    outdir: "packages/aws-pace/constructs",
    deps: [
        "aws-cdk-lib",
        "cdk-nag",
        "aws-lambda",
        "@aws-sdk/client-lambda",
        "constructs",
        "adm-zip",
    ],
    devDeps: ["@types/aws-lambda", "@types/adm-zip"],
    ...prettierOptions,
});

new TypeScriptProject({
    parent: project,
    defaultReleaseBranch,
    packageManager,
    name: "@aws-pace/cdk-utils",
    outdir: "packages/aws-pace/cdk-utils",
    deps: ["aws-cdk-lib", "cdk-nag"],
    ...prettierOptions,
});

const protoTools = new PythonProjectOverrides({
    parent: project,
    moduleName: "prototyping-tools",
    sample: false,
    version: "0.0.1",
    name: "prototyping-tools",
    authorEmail: "XXXXXXXXXXXXXXXXX",
    authorName: "XXXXXXXXXXXXXXXXX",
    deps: [
        "python@^3.12",
        "boto3",
        "requests@^2.31",
        "pandas",
        "tabulate",
        "idna@^3.7",
        "pyarrow",
    ],
    outdir: "packages/aws-pace/prototyping-tools",
    readme: {
        contents: "python tools for prototyping",
    },
});

protoTools.addTask("add-license", {
    exec: "poetry run python add-license.py --path ../../../packages",
});
protoTools.disablePackaging();

project.addDevDeps("@nxlv/python");

// Lambda function project for event handlers
const eventhandlers = new PythonLambdaFunction({
    parent: project,
    moduleName: "eventhandlers",
    sample: false,
    version: "0.0.1",
    name: "eventhandlers",
    authorEmail: "example@example.com",
    authorName: "Example Author",
    deps: [
        "python@^3.12",
        "boto3",
        "aws-lambda-powertools@>=3.20.0",
        "pydantic",
        "requests",
        "urllib3",
    ],
    outdir: "packages/eventhandlers",
    readme: {
        contents: "Lambda functions for handling events",
    },
});

// CDK application for deployment
const deploy = new CDKBlueprint({
    parent: project,
    defaultReleaseBranch,
    packageManager,
    cdkVersion,
    deps: ["@aws-pace/constructs@workspace:*"],
    name: "deploy",
    outdir: "packages/deploy",
    ...prettierOptions,
    context: {
        region,
        stack_name,
    },
});

// Shadcn webapp
const webapp = new TypescriptViteShadcnProject({
    parent: project,
    defaultReleaseBranch,
    packageManager,
    name: "webapp",
    outdir: "packages/webapp",
    sampleCode: true,
    deps: [
        "@aws-amplify/ui-react@^6",
        "aws-amplify@^6",
        "react-router-dom",
        "@ai-sdk/react@^1.2.11",
        "@radix-ui/react-avatar@^1.1.7",
        "@radix-ui/react-collapsible@^1.1.8",
        "@radix-ui/react-select@^2.2.2",
        "@radix-ui/react-progress@^1.1.7",
        "@radix-ui/react-tabs@^1.1.13",
        "framer-motion@11",
        "next-themes@^0.4.6",
        "react-markdown@10",
        "remark-gfm@4",
        "remeda@2",
        "shiki@1",
        "sonner@^2.0.3",
        "uuid@^11.1.0",
    ],
    ...prettierOptions,
});

// Set up dependencies between projects
project.addImplicitDependency(deploy, eventhandlers);
project.addImplicitDependency(deploy, webapp);

new VscodeSettings(project);
project.synth();
