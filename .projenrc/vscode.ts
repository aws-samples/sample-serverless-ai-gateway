import path from "path";
import { Component, JsonFile, Project } from "projen";

export class VscodeSettings extends Component {
    constructor(rootProject: Project) {
        super(rootProject);

        new JsonFile(rootProject, ".vscode/settings.json", {
            obj: {
                "eslint.workingDirectories": rootProject.subprojects.map(
                    (project) => ({
                        pattern: path.relative(
                            rootProject.outdir,
                            project.outdir,
                        ),
                    }),
                ),
                "editor.defaultFormatter": "esbenp.prettier-vscode",
                "editor.formatOnSave": true,
                "files.autosave": "onFocusChange",
                "editor.formatOnPaste": false,
                "[python]": {
                    "editor.defaultFormatter": "ms-python.black-formatter",
                },
                "python.formatting.provider": "none",
            },
        });
    }
}
