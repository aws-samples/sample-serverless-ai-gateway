# Projen Project Blueprints

This directory contains TypeScript modules that help create new projects using various blueprints.

## Available Blueprints

-   **vite/vite.ts**: Creates projects using the serverless-v2 blueprint
-   **vite-shadcn.ts**: Creates projects using the vite-shadcn blueprint with Shadcn UI components

## Using the Vite-Shadcn Blueprint

The `TypescriptViteShadcnProject` class creates a new TypeScript project with Vite and Shadcn UI components. It sets up all the necessary configuration files and directory structure.

### Example Usage

To create a new project using the vite-shadcn blueprint, add the following to your `.projenrc.ts` file:

```typescript
import { TypescriptViteShadcnProject } from "./.projenrc/vite-shadcn";

// Create a new project with Vite and Shadcn UI
const shadcnApp = new TypescriptViteShadcnProject({
    parent: project, // Your parent monorepo project
    defaultReleaseBranch: "main",
    packageManager: javascript.NodePackageManager.PNPM,
    name: "my-shadcn-app",
    outdir: "packages/my-shadcn-app",
    sampleCode: true, // Set to true to include sample code from the blueprint
});
```

### Features

The Vite-Shadcn blueprint includes:

1. **Modern React Setup**:

    - React 19
    - TypeScript
    - Vite 6 for fast development and building

2. **Shadcn UI Components**:

    - Pre-configured component system
    - Utility-first CSS with Tailwind CSS
    - Customizable component themes

3. **Developer Experience**:

    - Modern ESLint configuration
    - TypeScript configuration optimized for React development
    - Proper directory structure for components, utilities, and assets

4. **Build System**:
    - Optimized build process with Vite
    - TypeScript build integration
    - Development server with hot module replacement

### Project Structure

The generated project will have the following structure:

```
my-shadcn-app/
├── components.json       # Shadcn UI configuration
├── eslint.config.js      # ESLint configuration
├── index.html            # HTML entry point
├── package.json          # Package dependencies
├── tsconfig.json         # TypeScript configuration
├── tsconfig.app.json     # App-specific TypeScript configuration
├── tsconfig.node.json    # Node-specific TypeScript configuration
├── vite.config.ts        # Vite configuration
├── public/               # Static assets
└── src/
    ├── assets/           # Project assets
    ├── components/       # React components
    │   └── ui/           # Shadcn UI components
    ├── lib/              # Utility functions
    ├── App.tsx           # Main application component
    ├── App.css           # Application styles
    ├── index.css         # Global styles
    ├── main.tsx          # Application entry point
    └── vite-env.d.ts     # Vite type definitions
```
