import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { Amplify, ResourcesConfig } from "aws-amplify";
import { fetchAuthSession } from "aws-amplify/auth";
import "@aws-amplify/ui-react/styles.css";

const renderApp = () =>
    createRoot(document.getElementById("root")!).render(
        <StrictMode>
            <BrowserRouter>
                <App />
            </BrowserRouter>
        </StrictMode>,
    );

const addAuthorizationHeader = async () => ({
    Authorization: `Bearer ${(await fetchAuthSession()).tokens?.idToken?.toString()}`,
});

fetch("/config.json")
    .then(async (response) => {
        const amplifyConfig = (await response.json()) as ResourcesConfig;
        console.log("amplify configuration", amplifyConfig);
        Amplify.configure(amplifyConfig, {
            API: {
                REST: {
                    headers: addAuthorizationHeader,
                },
            },
        });
    })
    .catch((error) => {
        console.error("Error loading Amplify configuration:", error);
        // Fallback configuration or error handling
    })
    .finally(renderApp);
