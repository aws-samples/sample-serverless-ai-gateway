import { useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { events, EventsChannel } from "aws-amplify/data";
import { type Message } from "@/components/ui/chat-message";
import { type ChatAction } from "./use-chat-state";

interface UseChatEventsProps {
    dispatch: React.Dispatch<ChatAction>;
    input: string;
    userid?: string;
    selectedModel?: string;
    messages: Message[];
    conversationId: string; // Add conversation ID
}

export function useChatEvents({
    dispatch,
    input,
    userid = "someone",
    selectedModel,
    messages,
    conversationId,
}: UseChatEventsProps) {
    const sub = useRef<ReturnType<EventsChannel["subscribe"]>>(null);

    // Set up event subscription
    useEffect(() => {
        let channel: EventsChannel;
        let assistantContentReceived = false;

        const connectAndSubscribe = async () => {
            const channelName = `Outbound-Messages/${userid}`;
            channel = await events.connect(channelName);

            if (!sub.current) {
                console.log(`subscribing to ${channelName}`);
                sub.current = channel.subscribe({
                    next: (data) => {
                        // Handle content block delta (streaming text)
                        if (data.event.contentBlockDelta) {
                            assistantContentReceived = true;
                            const { delta } = data.event.contentBlockDelta;
                            if (delta.text) {
                                dispatch({
                                    type: "APPEND_ASSISTANT_TEXT",
                                    payload: delta.text,
                                });
                            }
                        }

                        // Handle error events
                        if (data.event.error) {
                            const errorData = data.event.error;
                            console.error("Received error event:", errorData);

                            if (assistantContentReceived) {
                                // Scenario 2: Keep messages, clear input, show error
                                dispatch({
                                    type: "SET_ERROR",
                                    payload: {
                                        type: errorData.type,
                                        message: errorData.message,
                                        requestId: errorData.requestId,
                                        details: errorData.details,
                                    },
                                });
                                dispatch({ type: "SET_INPUT", payload: "" });
                                dispatch({
                                    type: "SET_GENERATING",
                                    payload: false,
                                });
                            } else {
                                // Scenario 1: Roll back last message to input
                                dispatch({
                                    type: "SET_ERROR",
                                    payload: {
                                        type: errorData.type,
                                        message: errorData.message,
                                        requestId: errorData.requestId,
                                        details: errorData.details,
                                    },
                                });
                                dispatch({
                                    type: "ROLLBACK_LAST_MESSAGE_TO_INPUT",
                                });
                            }

                            // Reset the flag for next request
                            assistantContentReceived = false;
                            return;
                        }

                        // Handle token usage metadata
                        if (data.event.metadata && data.event.metadata.usage) {
                            // Check if we have the enhanced token usage data
                            if (data.event.tokenUsage) {
                                const tokenUsage = data.event.tokenUsage;
                                const totalTokens =
                                    tokenUsage.totalUsage.inputTokens +
                                    tokenUsage.totalUsage.outputTokens;
                                const tokenLimit = tokenUsage.tokenLimit;

                                // Extract monthly and hourly token usage
                                const monthlyInputTokens =
                                    tokenUsage.totalUsage.monthlyInputTokens ||
                                    0;
                                const monthlyOutputTokens =
                                    tokenUsage.totalUsage.monthlyOutputTokens ||
                                    0;
                                const monthlyTokens =
                                    monthlyInputTokens + monthlyOutputTokens;

                                const hourlyInputTokens =
                                    tokenUsage.totalUsage.dailyInputTokens || 0;
                                const hourlyOutputTokens =
                                    tokenUsage.totalUsage.dailyOutputTokens ||
                                    0;
                                const hourlyTokens =
                                    hourlyInputTokens + hourlyOutputTokens;

                                // Extract meter limits from the response
                                const meterLimits =
                                    tokenUsage.meterLimits || {};
                                const monthlyTokenLimit =
                                    meterLimits["monthly"];
                                const dailyTokenLimit = meterLimits["10min"]; // The daily meter is named "10min"

                                console.log(
                                    "Enhanced token usage:",
                                    totalTokens,
                                    "Limit:",
                                    tokenLimit,
                                    "Monthly:",
                                    monthlyTokens,
                                    "Monthly Limit:",
                                    monthlyTokenLimit,
                                    "Daily:",
                                    hourlyTokens,
                                    "Daily Limit:",
                                    dailyTokenLimit,
                                    "Details:",
                                    tokenUsage,
                                );

                                dispatch({
                                    type: "UPDATE_TOKEN_USAGE",
                                    payload: {
                                        usage: totalTokens,
                                        limit: tokenLimit,
                                        monthlyUsage: monthlyTokens,
                                        monthlyLimit: monthlyTokenLimit,
                                        dailyUsage: hourlyTokens,
                                        dailyLimit: dailyTokenLimit,
                                    },
                                });
                            }
                        }

                        // Handle message completion
                        if (data.event.messageStop) {
                            dispatch({ type: "COMPLETE_ASSISTANT_MESSAGE" });
                            // Reset the flag for next request
                            assistantContentReceived = false;
                        }
                    },
                    error: (err) => {
                        console.error("WebSocket error:", err);
                        // Handle websocket connection errors
                        dispatch({
                            type: "SET_ERROR",
                            payload: {
                                type: "websocket_error",
                                message:
                                    "Connection error occurred. Please try again.",
                                details: { error: err.toString() },
                            },
                        });
                        dispatch({ type: "SET_GENERATING", payload: false });
                    },
                });
            }
        };

        connectAndSubscribe();

        return () => {
            sub.current?.unsubscribe();
            sub.current = null;
            return channel?.close();
        };
    }, [userid, dispatch]);

    // Handle form submission
    const handleSubmit = async (event?: { preventDefault?: () => void }) => {
        event?.preventDefault?.();

        if (!input.trim()) return;

        // Clear any existing errors when submitting a new message
        dispatch({ type: "CLEAR_ERROR" });

        // Create a new user message
        const userMessage: Message = {
            id: uuidv4(),
            role: "user",
            content: input,
            createdAt: new Date(),
        };

        // Add the message to the state
        dispatch({ type: "ADD_MESSAGE", payload: userMessage });

        // Clear the input
        dispatch({ type: "SET_INPUT", payload: "" });

        // Set generating state to true
        dispatch({ type: "SET_GENERATING", payload: true });

        try {
            // Format all messages for the Bedrock API
            const formattedMessages = messages.map((message) => {
                // Format the content based on its type
                let formattedContent;
                if (typeof message.content === "string") {
                    formattedContent = [{ text: message.content }];
                } else if (
                    Array.isArray(message.content) &&
                    message.content.length > 0
                ) {
                    // If it's already in the right format, use it directly
                    formattedContent = message.content;
                } else {
                    // Fallback for any other format
                    formattedContent = [{ text: String(message.content) }];
                }

                return {
                    role: message.role,
                    content: formattedContent,
                };
            });

            // Add the new user message
            formattedMessages.push({
                role: "user",
                content: [{ text: input }],
            });

            // Create the message payload with all messages and conversation ID
            const messagePayload = JSON.stringify({
                messages: formattedMessages,
                modelId: selectedModel,
                conversationId: conversationId,
            });

            // Publish the message to the backend
            await events.post(`Inbound-Messages/${userid}`, messagePayload);
        } catch (error) {
            console.error("Error sending message:", error);
            // Only set to false on error, otherwise let the message completion event handle it
            dispatch({ type: "SET_GENERATING", payload: false });
        }
    };

    // Append a message
    const appendMessage = (message: { role: "user"; content: string }) => {
        // Clear any existing errors when submitting a new message
        dispatch({ type: "CLEAR_ERROR" });

        const newMessage: Message = {
            id: uuidv4(),
            ...message,
            createdAt: new Date(),
        };

        dispatch({ type: "ADD_MESSAGE", payload: newMessage });
        dispatch({ type: "SET_INPUT", payload: "" });

        try {
            // Format all messages for the Bedrock API
            const formattedMessages = [...messages, newMessage].map((msg) => {
                // Format the content based on its type
                let formattedContent;
                if (typeof msg.content === "string") {
                    formattedContent = [{ text: msg.content }];
                } else if (
                    Array.isArray(msg.content) &&
                    msg.content.length > 0
                ) {
                    // If it's already in the right format, use it directly
                    formattedContent = msg.content;
                } else {
                    // Fallback for any other format
                    formattedContent = [{ text: String(msg.content) }];
                }

                return {
                    role: msg.role,
                    content: formattedContent,
                };
            });

            // Create the message payload with all messages and conversation ID
            const messagePayload = JSON.stringify({
                messages: formattedMessages,
                modelId: selectedModel,
                conversationId: conversationId,
            });

            // Publish the message to the backend
            events
                .post(`Inbound-Messages/${userid}`, messagePayload)
                .catch((error) =>
                    console.error("Error sending message:", error),
                );
        } catch (error) {
            console.error("Error formatting or sending message:", error);
        }
    };

    return {
        handleSubmit,
        appendMessage,
    };
}
