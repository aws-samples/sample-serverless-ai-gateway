import path from "path";
import { JsonFile, SampleDir, SampleFile, TomlFile } from "projen";
import { PythonProject, PythonProjectOptions } from "projen/lib/python";

export class PythonProjectOverrides extends PythonProject {
    constructor(options: PythonProjectOptions) {
        super({
            ...options,
            license: "Apache-2.0",
            poetry: true,
        });

        // this replaces the default which runs poetry update
        // which updates packages far too often
        this.removeTask("install");
        this.addTask("install", {
            steps: [{ exec: "poetry lock" }, { exec: "poetry install" }],
        });
        this.addTask("update", {
            steps: [{ exec: "poetry update" }],
        });

        const licenseCheckFile = "licensecheck-output.json";
        this.addDevDependency("licensecheck");
        this.addTask("licensecheck", {
            steps: [
                {
                    exec: `test -f ${licenseCheckFile} || poetry run licensecheck -o ${licenseCheckFile}`,
                },
            ],
        });
        this.gitignore.addPatterns(licenseCheckFile);

        new JsonFile(this, "licensecheck.json", {
            obj: {
                tool: {
                    licensecheck: {
                        using: "poetry",
                        format: "json",
                    },
                },
            },
        });

        this.addDevDependency("pip-audit");
        this.addTask("pip-audit", {
            steps: [{ exec: "poetry run pip-audit -o pip-audit.txt" }],
        });
        this.gitignore.addPatterns("pip-audit.txt");

        this.addDevDependency(
            'bandit@{extras = ["sarif"], version = "^1.8.3"}',
        );
        new TomlFile(this, ".bandit.toml", {
            obj: {
                tool: {
                    bandit: {
                        exclude_dirs: ["dist"],
                        skips: ["B101"],
                    },
                },
            },
        });
        this.addTask("bandit", {
            steps: [
                {
                    exec: "bandit -c .bandit.toml -r . -f sarif -o bandit.sarif",
                },
            ],
        });
        this.gitignore.addPatterns("bandit.sarif");
    }

    disablePackaging() {
        const pyproject = this.tryFindObjectFile("pyproject.toml");
        pyproject?.addOverride("tool.poetry.package-mode", false);
        this.removeTask("build");
        this.removeTask("package");
    }

    useSrcFolder(): void {
        const pyproject = this.tryFindObjectFile("pyproject.toml");
        // modify the pyproject.toml file
        pyproject?.addOverride("tool.poetry.packages", [
            { include: this.moduleName, from: "src" },
        ]);
    }

    addPackageSource(name: string, url: string, priority: string): void {
        const pyproject = this.tryFindObjectFile("pyproject.toml");
        pyproject?.addOverride("tool.poetry.source", [{ name, url, priority }]);
    }
}

export interface JupyterPythonProjectOptions extends PythonProjectOptions {}

export class JupyterNotebookProject extends PythonProjectOverrides {
    constructor(options: JupyterPythonProjectOptions) {
        super({
            ...options,
            deps: [
                "python@^3.12",
                "jupyterlab@^3.4.4",
                "ipywidgets",
                "jupyterlab-git@^0.32.0",
                "pyzmq@^25",
                "numpy",
                "pandas",
                "ipython-sql",
                ...(options.deps ?? []),
            ],
        });

        this.addTask("jupyter", {
            exec: [
                "poetry",
                "run",
                "jupyter",
                "lab",
                "--ip=0.0.0.0",
                "--port=7710",
                "--no-browser",
                // "--NotebookApp.token=''",
                // "--NotebookApp.password=''",
            ].join(" "),
        });
    }
}

export class PythonFastAPIServerSentEvents extends PythonProjectOverrides {
    constructor(options: PythonProjectOptions) {
        super({
            ...options,
            deps: [
                "python@^3.12",
                "fastapi@^0.105.0",
                'sqlalchemy@{extras = ["asyncio"], version = "^2.0.23"}',
                // "psycopg2", // lgpl
                "asyncpg",
                "alembic",
                "hypercorn@^0.16",
                "boto3@^1.34.1",
                "sse-starlette@^1.8.2",
                "asyncio@^3.4.3",
                "requests@^2.31.0",
                "python-jose@^3.3.0",
                "pandas@^2.1.4",
                "matplotlib@^3.8.2",
                "aiohttp",
                "pgvector",
                "python-multipart@^0.0.9",
                ...(options.deps ?? []),
            ],
            sample: false,
        });

        this.useSrcFolder();

        this.addTask("dev", {
            exec: "./run.sh",
        });
        this.removeTask("build");
        this.addTask("build", {
            description: "Full release build",
            steps: [
                {
                    spawn: "pre-compile",
                },
                {
                    spawn: "compile",
                },
                {
                    spawn: "post-compile",
                },
                {
                    spawn: "test",
                },
                {
                    spawn: "package",
                },
                {
                    name: "docker-build",
                    env: {
                        NAME: this.name,
                        WEBAPP: "../web-app",
                    },
                    exec: "./build-docker.sh",
                },
            ],
        });

        this.gitignore.addPatterns("localhost.crt", "localhost.key");

        new SampleDir(this, "src/" + options.moduleName, {
            sourceDir: path.join(
                __dirname,
                "..",
                "blueprints",
                "python-fastapi-sse-pgsql",
                "src",
                "api",
            ),
        });

        new SampleDir(this, "tests", {
            sourceDir: path.join(
                __dirname,
                "..",
                "blueprints",
                "python-fastapi-sse-pgsql",
                "tests",
            ),
        });

        new SampleDir(this, "db-schema-alembic", {
            sourceDir: path.join(
                __dirname,
                "..",
                "blueprints",
                "python-fastapi-sse-pgsql",
                "db-schema-alembic",
            ),
        });

        for (const file of [
            "alembic.ini",
            "build-docker.sh",
            "Dockerfile",
            "entrypoint.sh",
            "localhost-keygen.sh",
            "README.md",
            "run-alembic.sh",
            "run-docker.sh",
            "run.sh",
        ]) {
            new SampleFile(this, file, {
                sourcePath: path.join(
                    __dirname,
                    "..",
                    "blueprints",
                    "python-fastapi-sse-pgsql",
                    file,
                ),
            });
        }
    }
}

export class PythonLambdaFunction extends PythonProjectOverrides {
    constructor(options: PythonProjectOptions) {
        super({
            ...options,
            deps: [...(options.deps ?? [])],
            sample: false,
        });

        this.addDevDependency("aws-lambda-builders");

        if (options.sample) {
            new SampleFile(this, `${options.moduleName}/handler.py`, {
                sourcePath: path.join(
                    __dirname,
                    "..",
                    "blueprints",
                    "serverless-v2",
                    "api",
                    "example",
                    "example.py",
                ),
            });

            new SampleDir(this, "tests", {
                sourceDir: path.join(
                    __dirname,
                    "..",
                    "blueprints",
                    "python-fastapi-sse-pgsql",
                    "tests",
                ),
            });
        }

        this.tasks
            .tryFind("package")
            ?.exec(
                `rm -rf ./dist/venv && docker run --rm -v $(pwd):/var/task -w /var/task public.ecr.aws/sam/build-python3.12:latest pip install -t ./dist/venv .`,
            );
    }
}
