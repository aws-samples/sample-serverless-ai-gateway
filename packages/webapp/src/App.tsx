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

import { type UseChatOptions } from "@ai-sdk/react";
import {
    withAuthenticator,
    WithAuthenticatorProps,
} from "@aws-amplify/ui-react";

import { cn } from "@/lib/utils";
import { Chat } from "@/components/ui/chat";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "./components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "./components/ui/sidebar";
import { AppSidebar } from "./components/app-sidebar";

import { useChatState } from "@/hooks/use-chat-state";
import { useChatEvents } from "@/hooks/use-chat-events";
import { useEffect, useState } from "react";
import { fetchUserAttributes, UserAttributeKey } from "aws-amplify/auth";
import {
    loadModelsData,
    groupModelsByProvider,
    Model,
    ModelGroup,
} from "@/lib/models";

type ChatDemoProps = {
    initialMessages?: UseChatOptions["initialMessages"];
} & WithAuthenticatorProps;

function AppComponent({ signOut, user }: ChatDemoProps) {
    // State for models data
    const [models, setModels] = useState<Model[]>([]);
    const [modelGroups, setModelGroups] = useState<ModelGroup[]>([]);
    const [defaultModelId, setDefaultModelId] = useState<string>(
        "us.anthropic.claude-sonnet-4-20250514-v1:0",
    );
    const [modelsLoading, setModelsLoading] = useState(true);

    const [state, dispatch] = useChatState(defaultModelId);
    const {
        selectedModel,
        messages,
        input,
        isGenerating,
        conversationId,
        error,
    } = state;

    const { handleSubmit, appendMessage } = useChatEvents({
        dispatch,
        input,
        userid: user?.userId || "guest", // Use authenticated username
        selectedModel,
        messages,
        conversationId,
    });

    const [attrs, setAttrs] = useState<
        Partial<Record<UserAttributeKey, string>> | undefined
    >();

    // Load models data on component mount
    useEffect(() => {
        loadModelsData()
            .then((modelsData) => {
                setModels(modelsData.models);
                setModelGroups(groupModelsByProvider(modelsData.models));
                setDefaultModelId(modelsData.defaultModelId);
                setModelsLoading(false);

                // Update the selected model if it's still the default
                if (
                    selectedModel ===
                    "us.anthropic.claude-sonnet-4-20250514-v1:0"
                ) {
                    dispatch({
                        type: "SET_MODEL",
                        payload: modelsData.defaultModelId,
                    });
                }
            })
            .catch((error) => {
                console.error("Failed to load models data:", error);
                setModelsLoading(false);
            });
    }, [selectedModel, dispatch]);

    useEffect(() => {
        if (attrs) return;
        fetchUserAttributes().then((attributes) => {
            setAttrs(attributes);
            console.log("attributes", attributes);
        });
    }, [attrs]);
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        dispatch({ type: "SET_INPUT", payload: e.target.value });
    };

    // Show loading state while models are being loaded
    if (modelsLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                    <p>Loading models...</p>
                </div>
            </div>
        );
    }

    return (
        <SidebarProvider>
            <AppSidebar
                user={{
                    name: attrs?.name || user?.username,
                    email: attrs?.email || user?.username,
                    // No avatar provided by Cognito, could add a default one if needed
                }}
                signOut={signOut}
                models={models}
                modelGroups={modelGroups}
                selectedModel={selectedModel}
                onModelChange={(value) =>
                    dispatch({ type: "SET_MODEL", payload: value })
                }
                onClearChat={() =>
                    dispatch({ type: "SET_MESSAGES", payload: [] })
                }
                hasMessages={messages.length > 0}
                monthlyTokenUsage={state.monthlyTokenUsage}
                monthlyTokenLimit={state.monthlyTokenLimit}
                dailyTokenUsage={state.hourlyTokenUsage}
                dailyTokenLimit={state.hourlyTokenLimit}
            />
            <SidebarInset>
                <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 sticky top-0 z-20 bg-background border-b">
                    <div className="flex items-center gap-2 px-4">
                        <SidebarTrigger className="-ml-1" />
                        <Separator
                            orientation="vertical"
                            className="mr-2 h-4"
                        />
                        <Breadcrumb>
                            <BreadcrumbList>
                                <BreadcrumbItem className="hidden md:block">
                                    <BreadcrumbPage>Chat</BreadcrumbPage>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden md:block" />
                                <BreadcrumbItem>
                                    <BreadcrumbPage>
                                        Conversation ID{" "}
                                        {conversationId.substring(0, 8)}
                                    </BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                </header>

                {/* Token usage and Clear Chat button removed - now in sidebar */}

                <div
                    className={cn(
                        "flex",
                        "flex-col",
                        "h-[calc(100vh-4rem)]" /* 4rem for header only, button row removed */,
                        "w-auto",
                        "mx-4",
                        "mb-4",
                        "mt-4",
                    )}
                >
                    <Chat
                        className="grow"
                        messages={messages}
                        handleSubmit={handleSubmit}
                        input={input}
                        handleInputChange={handleInputChange}
                        isGenerating={isGenerating}
                        append={appendMessage}
                        setMessages={(newMessages) =>
                            dispatch({
                                type: "SET_MESSAGES",
                                payload: newMessages,
                            })
                        }
                        error={error}
                        suggestions={[
                            "What is the weather in San Francisco?",
                            "Explain step-by-step how to solve this math problem: If x² + 6x + 9 = 25, what is x?",
                            "Design a simple algorithm to find the longest palindrome in a string.",
                        ]}
                    />
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}

// Export the wrapped component with authentication
export default withAuthenticator(AppComponent);
