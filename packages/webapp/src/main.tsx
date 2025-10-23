/**
 * Copyright 2025 Amazon.com, Inc. and its affiliates. All Rights Reserved.
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
