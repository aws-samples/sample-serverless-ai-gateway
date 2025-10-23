import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default ({ mode }: { mode: string }) => {
    process.env = { ...process.env, ...loadEnv(mode, process.cwd()) };

    return defineConfig({
        plugins: [react(), tailwindcss()],
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "./src"),
                "./runtimeConfig": "./runtimeConfig.browser", // ensures browser compatible version of AWS JS SDK is used
            },
        },
        server: {
            proxy: {
                "/config.json": {
                    target: process.env.VITE_CLOUDFRONT_URL,
                    changeOrigin: true,
                    secure: false,
                },
                "/api": {
                    target: process.env.VITE_CLOUDFRONT_URL,
                    changeOrigin: true,
                    secure: false,
                },
            },
        },
    });
};
