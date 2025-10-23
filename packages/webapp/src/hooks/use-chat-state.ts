import { useReducer } from "react";
import { v4 as uuidv4 } from "uuid";
import { type Message } from "@/components/ui/chat-message";

// Define error interface
export interface ChatError {
    type: string;
    message: string;
    requestId?: string;
    details?: any;
}

// Define the state interface
export interface ChatState {
    selectedModel: string;
    messages: Message[];
    input: string;
    isGenerating: boolean;
    conversationId: string; // Unique identifier for the conversation
    tokenUsage: number; // Current token usage
    tokenLimit: number; // Token limit
    monthlyTokenUsage: number; // Monthly token usage
    monthlyTokenLimit: number; // Monthly token limit
    hourlyTokenUsage: number; // Hourly token usage
    hourlyTokenLimit: number; // Hourly token limit
    error: ChatError | null; // Current error state
    previousInput: string; // Store input for recovery
}

// Define action types
export type ChatAction =
    | { type: "SET_MODEL"; payload: string }
    | { type: "SET_INPUT"; payload: string }
    | { type: "ADD_MESSAGE"; payload: Message }
    | { type: "SET_MESSAGES"; payload: Message[] }
    | { type: "SET_GENERATING"; payload: boolean }
    | { type: "APPEND_ASSISTANT_TEXT"; payload: string }
    | { type: "COMPLETE_ASSISTANT_MESSAGE" }
    | { type: "SET_ERROR"; payload: ChatError | null }
    | { type: "CLEAR_ERROR" }
    | { type: "ROLLBACK_LAST_MESSAGE_TO_INPUT" }
    | { type: "STORE_PREVIOUS_INPUT"; payload: string }
    | {
          type: "UPDATE_TOKEN_USAGE";
          payload: {
              usage: number;
              limit: number;
              monthlyUsage?: number;
              monthlyLimit?: number;
              dailyUsage?: number;
              dailyLimit?: number;
          };
      };

// Create reducer function
function chatReducer(state: ChatState, action: ChatAction): ChatState {
    if (action.type !== "APPEND_ASSISTANT_TEXT" && action.type != "SET_INPUT") {
        console.log("chat reducer state: ", state, action);
    }
    switch (action.type) {
        case "UPDATE_TOKEN_USAGE":
            return {
                ...state,
                tokenUsage: action.payload.usage,
                tokenLimit: action.payload.limit,
                monthlyTokenUsage:
                    action.payload.monthlyUsage || state.monthlyTokenUsage,
                monthlyTokenLimit:
                    action.payload.monthlyLimit || state.monthlyTokenLimit,
                hourlyTokenUsage:
                    action.payload.dailyUsage || state.hourlyTokenUsage,
                hourlyTokenLimit:
                    action.payload.dailyLimit || state.hourlyTokenLimit,
            };
        case "SET_MODEL":
            return { ...state, selectedModel: action.payload };
        case "SET_INPUT":
            return { ...state, input: action.payload };
        case "ADD_MESSAGE":
            return { ...state, messages: [...state.messages, action.payload] };
        case "SET_MESSAGES":
            return { ...state, messages: action.payload };
        case "SET_GENERATING":
            return { ...state, isGenerating: action.payload };
        case "APPEND_ASSISTANT_TEXT": {
            const messages = [...state.messages];
            const lastMessage =
                messages.length > 0 ? messages[messages.length - 1] : null;

            // If last message is not from assistant, create a new one
            if (!lastMessage || lastMessage.role !== "assistant") {
                const newAssistantMessage: Message = {
                    id: uuidv4(),
                    role: "assistant",
                    content: [{ text: action.payload }],
                    createdAt: new Date(),
                };
                return {
                    ...state,
                    messages: [...messages, newAssistantMessage],
                    isGenerating: true, // Set to true when we start receiving assistant message
                };
            }

            // Otherwise append to existing assistant message
            const updatedLastMessage = { ...lastMessage };
            if (typeof updatedLastMessage.content === "string") {
                updatedLastMessage.content =
                    updatedLastMessage.content + action.payload;
            } else {
                // If it's an array of ContentItems
                if (
                    updatedLastMessage.content &&
                    updatedLastMessage.content.length > 0
                ) {
                    updatedLastMessage.content = [
                        {
                            text:
                                updatedLastMessage.content[0].text +
                                action.payload,
                        },
                    ];
                } else {
                    updatedLastMessage.content = [{ text: action.payload }];
                }
            }

            messages[messages.length - 1] = updatedLastMessage;
            return { ...state, messages, isGenerating: true };
        }
        case "COMPLETE_ASSISTANT_MESSAGE": {
            return { ...state, isGenerating: false };
        }
        case "SET_ERROR": {
            return { ...state, error: action.payload };
        }
        case "CLEAR_ERROR": {
            return { ...state, error: null };
        }
        case "ROLLBACK_LAST_MESSAGE_TO_INPUT": {
            const messages = [...state.messages];
            if (messages.length > 0) {
                const lastMessage = messages[messages.length - 1];
                // Only rollback if the last message is from user
                if (lastMessage.role === "user") {
                    // Extract text content from the last message
                    let messageText = "";
                    if (typeof lastMessage.content === "string") {
                        messageText = lastMessage.content;
                    } else if (
                        Array.isArray(lastMessage.content) &&
                        lastMessage.content.length > 0
                    ) {
                        messageText = lastMessage.content
                            .map((item) => item.text)
                            .join("");
                    }

                    // Remove the last message and restore it to input
                    messages.pop();
                    return {
                        ...state,
                        messages,
                        input: messageText,
                        isGenerating: false,
                    };
                }
            }
            // If no rollback needed, just reset generating state
            return { ...state, isGenerating: false };
        }
        case "STORE_PREVIOUS_INPUT": {
            return { ...state, previousInput: action.payload };
        }
        default:
            return state;
    }
}

export function useChatState(initialModel: string) {
    // Initialize state with useReducer
    const initialState: ChatState = {
        selectedModel: initialModel,
        messages: [],
        input: "",
        isGenerating: false,
        conversationId: uuidv4(), // Generate a unique ID for the conversation
        tokenUsage: 0,
        tokenLimit: 0,
        monthlyTokenUsage: 0,
        monthlyTokenLimit: 0,
        hourlyTokenUsage: 0,
        hourlyTokenLimit: 0,
        error: null,
        previousInput: "",
    };

    return useReducer(chatReducer, initialState);
}
