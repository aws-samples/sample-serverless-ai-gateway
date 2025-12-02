import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { Amplify } from "aws-amplify";
import "@aws-amplify/ui-react/styles.css"; // Import Amplify UI styles

// Function to render the app
const renderApp = () => {
    createRoot(document.getElementById("root")!).render(
        <StrictMode>
            <App />
        </StrictMode>,
    );
};

// Function to display error message
const displayError = (error: Error) => {
    console.error("Error initializing app:", error);
    document.getElementById("root")!.innerHTML = `
    <div style="padding: 20px; text-align: center;">
      <h2>Configuration Error</h2>
      <p>Failed to load application configuration. Please try again later.</p>
    </div>
  `;
};

// Fetch configuration and initialize app
fetch("/config.json")
    .then((response) => {
        if (!response.ok) {
            throw new Error(
                `Failed to fetch config.json: ${response.status} ${response.statusText}`,
            );
        }
        return response.json();
    })
    .then((config) => {
        // Configure Amplify with the fetched config
        Amplify.configure(config);
        console.log("Amplify configured successfully with config.json", config);
    })
    .catch((error) => {
        displayError(error as Error);
    })
    .finally(() => {
        // Only render the app if no error occurred
        if (!document.getElementById("root")?.innerHTML) {
            renderApp();
        }
    });
