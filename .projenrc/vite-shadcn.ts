import {
    SampleFile,
    Project,
    typescript,
    DependencyType,
    SampleDir,
    JsonFile,
} from "projen";
import path from "path";

/**
 * Creates a vite.config.ts file for a Shadcn UI project
 */
export class ViteShadcnConfigTsFile extends SampleFile {
    constructor(scope: Project) {
        super(scope, "vite.config.ts", {
            sourcePath: path.join(
                __dirname,
                "..",
                "blueprints",
                "vite-shadcn",
                "vite.config.ts",
            ),
        });
    }
}

/**
 * Creates a components.json file for a Shadcn UI project
 */
export class ComponentsJsonFile extends SampleFile {
    constructor(scope: Project) {
        super(scope, "components.json", {
            sourcePath: path.join(
                __dirname,
                "..",
                "blueprints",
                "vite-shadcn",
                "components.json",
            ),
        });
    }
}

/**
 * Base class for Vite Shadcn UI projects
 */
class TypescriptViteShadcnProjectBase extends typescript.TypeScriptAppProject {
    constructor(options: typescript.TypeScriptProjectOptions) {
        const implicitDeps = [
            "react@^19.0.0",
            "react-dom@^19.0.0",
            "react-router-dom",
            "@aws-amplify/ui-react@^6",
            "aws-amplify@^6",
            "@radix-ui/react-slot@^1.2.0",
            "@radix-ui/react-label",
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-separator",
            "@radix-ui/react-tooltip",
            "class-variance-authority@^0.7.1",
            "clsx@^2.1.1",
            "lucide-react@^0.488.0",
            "tailwind-merge@^3.2.0",
            "tailwindcss@^4.1.13",
            "tw-animate-css@^1.2.5",
        ];

        const implicitDevDeps = [
            "@eslint/js@^9.22.0",
            "@types/node@^22.14.1",
            "@types/react@^19.0.10",
            "@types/react-dom@^19.0.4",
            "@vitejs/plugin-react@^4.3.4",
            "@tailwindcss/vite@^4.1.13",
            "eslint@^9.22.0",
            "eslint-plugin-react-hooks@^5.2.0",
            "eslint-plugin-react-refresh@^0.4.19",
            "globals@^16.0.0",
            "typescript@~5.7.2",
            "typescript-eslint@^8.26.1",
            "vite@^6.3.1",
        ];

        // Initialize with minimal tsconfig
        super({
            ...options,
            artifactsDirectory: "dist",
            tsconfig: {
                compilerOptions: {
                    baseUrl: ".",
                    paths: {
                        "@/*": ["./src/*"],
                    },
                },
            },
            tsconfigDev: {
                include: ["vite.config.ts"],
            },
            disableTsconfig: false,
            disableTsconfigDev: true,
            jest: false,
        });

        // Create tsconfig.app.json
        new JsonFile(this, "tsconfig.app.json", {
            obj: {
                compilerOptions: {
                    tsBuildInfoFile:
                        "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
                    target: "ES2020",
                    useDefineForClassFields: true,
                    lib: ["ES2020", "DOM", "DOM.Iterable"],
                    module: "ESNext",
                    skipLibCheck: true,
                    moduleResolution: "bundler",
                    allowImportingTsExtensions: true,
                    isolatedModules: true,
                    moduleDetection: "force",
                    noEmit: true,
                    jsx: "react-jsx",
                    strict: true,
                    noUnusedLocals: true,
                    noUnusedParameters: true,
                    noFallthroughCasesInSwitch: true,
                    noUncheckedSideEffectImports: true,
                    baseUrl: ".",
                    paths: {
                        "@/*": ["./src/*"],
                    },
                },
                include: ["src"],
            },
        });

        // Create tsconfig.node.json
        new JsonFile(this, "tsconfig.node.json", {
            obj: {
                compilerOptions: {
                    tsBuildInfoFile:
                        "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
                    target: "ES2022",
                    lib: ["ES2023"],
                    module: "ESNext",
                    skipLibCheck: true,
                    moduleResolution: "bundler",
                    allowImportingTsExtensions: true,
                    isolatedModules: true,
                    moduleDetection: "force",
                    noEmit: true,
                    strict: true,
                    noUnusedLocals: true,
                    noUnusedParameters: true,
                    noFallthroughCasesInSwitch: true,
                    noUncheckedSideEffectImports: true,
                },
                include: ["vite.config.ts"],
            },
        });

        // this let's us redefine tsconfig.json as a new file
        // with no default values present from the superclass
        this.tryRemoveFile("tsconfig.json");

        // Create main tsconfig.json
        new JsonFile(this, "tsconfig.json", {
            obj: {
                files: [],
                references: [
                    { path: "./tsconfig.app.json" },
                    { path: "./tsconfig.node.json" },
                ],
                compilerOptions: {
                    baseUrl: ".",
                    paths: {
                        "@/*": ["./src/*"],
                    },
                },
            },
        });

        const packagejson = this.tryFindObjectFile("package.json");
        if (packagejson) {
            packagejson.addOverride("type", "module");
            packagejson.addOverride("private", true);
        }

        // Add dependencies
        implicitDeps.forEach((d) => {
            if (!this.deps.tryGetDependency(d, DependencyType.RUNTIME))
                this.deps.addDependency(d, DependencyType.RUNTIME);
        });
        implicitDevDeps.forEach((d) => {
            if (!this.deps.tryGetDependency(d, DependencyType.DEVENV))
                this.deps.addDependency(d, DependencyType.DEVENV);
        });

        // Configure tasks
        this.tasks.tryFind("test")?.reset("vitest", {});

        this.addTask("dev", {
            exec: "vite",
        });
        this.addTask("preview", {
            exec: "vite preview",
        });

        this.removeTask("build");
        this.addTask("build", {
            exec: "tsc -b && vite build",
        });
    }
}

/**
 * Creates a TypeScript project with Vite and Shadcn UI
 */
export class TypescriptViteShadcnProject extends TypescriptViteShadcnProjectBase {
    constructor(options: typescript.TypeScriptProjectOptions) {
        super({
            ...options,
            sampleCode: false,
        });

        if (options.sampleCode) {
            // Add configuration files
            new ViteShadcnConfigTsFile(this);
            new ComponentsJsonFile(this);

            // Add index.html
            new SampleFile(this, "index.html", {
                sourcePath: path.join(
                    __dirname,
                    "..",
                    "blueprints",
                    "vite-shadcn",
                    "index.html",
                ),
            });

            // Add source directories
            const sampleDirs = ["public", "src"];
            for (const dir of sampleDirs) {
                new SampleDir(this, dir, {
                    sourceDir: path.join(
                        __dirname,
                        "..",
                        "blueprints",
                        "vite-shadcn",
                        dir,
                    ),
                });
            }

            // Ensure tsconfig files match the blueprint structure
            const tsconfig = this.tryFindObjectFile("tsconfig.json");
            if (tsconfig) {
                tsconfig.addOverride("files", []);
                tsconfig.addOverride("references", [
                    { path: "./tsconfig.app.json" },
                    { path: "./tsconfig.node.json" },
                ]);
                tsconfig.addOverride("compilerOptions", {
                    baseUrl: ".",
                    paths: {
                        "@/*": ["./src/*"],
                    },
                });
            }
        }
    }
}
