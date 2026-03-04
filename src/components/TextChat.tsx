"use client";

import React, { useState, useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ChatInterface } from "@/components/chat/ChatInterface";

interface Person {
  name: string;
  pattern: string;
  color: string;
}

interface Restaurant {
  id: number;
  name: string;
  visited: boolean;
}

type AggregationStrategy = "LMS" | "ADD" | "APP";

export interface ChatLogEntry {
  role: "user" | "assistant" | "error";
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface TextChatProps {
  people: Person[];
  restaurants: Restaurant[];
  ratings: number[][];
  strategy: AggregationStrategy;
  groupScores: number[];
  recommendedRestaurantIndices: number[];
  onDataUpdate?: (updatedData: {
    ratings: number[][];
    groupScores: number[];
    recommendedRestaurantIndices: number[];
  }) => void;
  originalRestaurants?: Restaurant[];
  onSuggestionClick?: (suggestion: string) => void;
  onQuerySubmit?: (query: string) => void;
  onChatLogEntry?: (entry: ChatLogEntry) => void;
}

// Max content length to avoid DB OOM (Neon has limited memory per request)
const MAX_CONTENT_LENGTH = 32 * 1024; // 32KB - enough for explanations, prevents huge payloads
const MAX_USER_MESSAGES = 15;
const CONVERSATION_CLOSED_MESSAGE =
  "This conversation is now closed after 15 questions.";

// Build minimal metadata for logging - never include full tool results (ratings matrices, etc.)
function sanitizeMetadata(
  messageId: string | undefined,
  toolCalls: string[],
  toolResults: unknown[]
): Record<string, unknown> {
  const meta: Record<string, unknown> = {
    ...(messageId && { messageId }),
    ...(toolCalls.length > 0 && { toolCalls }),
  };
  if (toolResults.length > 0) {
    meta.toolResultsSummary = toolResults.map((r) => {
      if (r && typeof r === "object" && "success" in r) {
        return { success: (r as { success?: boolean }).success, message: (r as { message?: string }).message };
      }
      return { success: false };
    });
  }
  return meta;
}

// Starter suggestions for users
const suggestions = [
  "Why was this restaurant recommended?",
  "How to make Rest 1 the top choice?",
  "What would need to change for Rest 3 to be preferred?",
  "Explain the current recommendation strategy",
  "Show me the individual ratings for the recommended restaurant",
  "Which person's rating has the most impact on the recommendation?",
  "What if Alex's rating for Rest 4 increased to 5?",
  "What if Darcy changed their rating for Rest 2 to 5?",
  "Update Alex's rating for Rest 1 to 5",
  "Change Darcy's rating for Rest 3 to 4",
  "Change all Jackie's ratings to 3",
  "Set all of Alex's ratings to be at least 4",
  "What happens if I increase all ratings for Rest 2 by 1?",
];

export default function TextChatWithTools({
  people,
  restaurants,
  ratings,
  strategy,
  groupScores,
  recommendedRestaurantIndices,
  onDataUpdate,
  originalRestaurants,
  onSuggestionClick,
  onQuerySubmit,
  onChatLogEntry,
}: TextChatProps) {
  const [input, setInput] = useState("");
  interface ToolResult {
    success: boolean;
    message?: string;
    updatedData?: {
      personName?: string;
      restaurantName?: string;
      oldRating?: number;
      newRating?: number;
      newRatings?: number[][];
      newGroupScores?: number[];
      newRecommendedRestaurantIndices?: string[];
      updates?: Array<{
        personName: string;
        restaurantName: string;
        oldRating: number;
        newRating: number;
      }>;
    };
    verification?: {
      ok?: boolean;
      mode?: "verify_only" | "prove_minimal";
    };
  }
  const [lastToolResult, setLastToolResult] = useState<ToolResult | null>(null);
  const lastLoggedResponseRef = useRef<string | null>(null);
  const lastLoggedToolCallRef = useRef<string | null>(null);
  const lastLoggedToolResultRef = useRef<string | null>(null);
  const lastLoggedResponseIdRef = useRef<string | null>(null);
  const lastLoggedErrorRef = useRef<{ signature: string; at: number } | null>(
    null
  );
  const onChatLogEntryRef = useRef(onChatLogEntry);
  const prevStatusRef = useRef<string>("ready");

  useEffect(() => {
    onChatLogEntryRef.current = onChatLogEntry;
  }, [onChatLogEntry]);

  // Create context object
  const context = {
    people,
    restaurants,
    ratings,
    strategy,
    groupScores,
    recommendedRestaurantIndices,
  };

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
  });
  const userMessageCount = messages.filter((message) => message.role === "user").length;
  const isConversationClosed = userMessageCount >= MAX_USER_MESSAGES;

  // Log assistant responses when streaming completes (status: streaming/submitted -> ready)
  useEffect(() => {
    const wasActive = prevStatusRef.current !== "ready";
    prevStatusRef.current = status;

    if (wasActive && status === "ready" && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === "assistant" && lastMessage.id !== lastLoggedResponseIdRef.current) {
        lastLoggedResponseIdRef.current = lastMessage.id;

        const responseText = lastMessage.parts
          ?.filter((part) => part.type === "text")
          .map((part) =>
            typeof part.text === "string" ? part.text : String(part.text || "")
          )
          .join("")
          .trim() || "";

        const toolCalls = lastMessage.parts
          ?.filter((part) => part.type === "tool-call")
          .map((part) => ("toolName" in part ? String(part.toolName) : "unknown")) || [];

        const toolResults = lastMessage.parts
          ?.filter(
            (part) =>
              part.type === "tool-result" ||
              (typeof part.type === "string" &&
                part.type.startsWith("tool-") &&
                part.type !== "tool-call")
          )
          .map((part) => {
            const result = "result" in part ? part.result : "output" in part ? part.output : null;
            return result;
          }) || [];

        const truncatedContent =
          responseText.length > MAX_CONTENT_LENGTH
            ? responseText.slice(0, MAX_CONTENT_LENGTH) + "\n[...truncated]"
            : responseText;
        const hasToolActivity = toolCalls.length > 0 || toolResults.length > 0;
        const contentForLog =
          truncatedContent.length > 0
            ? truncatedContent
            : hasToolActivity
              ? "(tool action)"
              : "";

        if (!contentForLog) {
          return;
        }

        onChatLogEntry?.({
          role: "assistant",
          content: contentForLog,
          timestamp: new Date().toISOString(),
          metadata: sanitizeMetadata(lastMessage.id, toolCalls, toolResults),
        });
      }
    }
  }, [status, messages, onChatLogEntry]);

  // Log chat errors
  useEffect(() => {
    if (!error) return;
    const content = error.message || "Unknown chat error";
    const signature = `${error.name}:${content}`;
    const now = Date.now();
    if (
      lastLoggedErrorRef.current &&
      lastLoggedErrorRef.current.signature === signature &&
      now - lastLoggedErrorRef.current.at < 5000
    ) {
      return;
    }
    lastLoggedErrorRef.current = { signature, at: now };
    onChatLogEntryRef.current?.({
      role: "error",
      content,
      timestamp: new Date().toISOString(),
      metadata: { errorName: error.name },
    });
  }, [error]);

  // Handle tool results and update parent component
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];

      if (lastMessage.role === "assistant" && lastMessage.parts) {
        const toolCallPart = lastMessage.parts.find(
          (part) => part.type === "tool-call"
        );
        const toolCallName =
          toolCallPart && "toolName" in toolCallPart
            ? String(toolCallPart.toolName)
            : null;
        if (toolCallName && toolCallName !== lastLoggedToolCallRef.current) {
          console.log("🧰 Tool call:", toolCallName);
          lastLoggedToolCallRef.current = toolCallName;
        }

        // Look for tool-result or tool-{toolName} parts
        const toolResult = lastMessage.parts.find(
          (part) =>
            part.type === "tool-result" ||
            (typeof part.type === "string" &&
              part.type.startsWith("tool-") &&
              part.type !== "tool-call")
        );

        const toolCallInProgress = lastMessage.parts?.find(
          (part) =>
            typeof part.type === "string" &&
            part.type.startsWith("tool-") &&
            part.type !== "tool-result"
        );

        if (toolResult && ("result" in toolResult || "output" in toolResult)) {
          // Handle both tool-result and tool-{toolName} formats
          const result = (
            "result" in toolResult
              ? toolResult.result
              : "output" in toolResult
              ? toolResult.output
              : toolResult
          ) as ToolResult;
          // Check if result is valid before trying to access properties
          if (
            result &&
            typeof result === "object" &&
            (result.success !== undefined || result.message)
          ) {
            const toolResultSignature = JSON.stringify({
              success: result.success,
              message: result.message,
              verification: result.verification
                ? {
                    ok: result.verification.ok,
                    mode: result.verification.mode,
                  }
                : undefined,
            });
            if (toolResultSignature !== lastLoggedToolResultRef.current) {
              console.log("✅ Tool result:", JSON.parse(toolResultSignature));
              lastLoggedToolResultRef.current = toolResultSignature;
            }

            if (result.success && result.updatedData && onDataUpdate) {
              // The tool result contains data based on original indices
              // We need to convert restaurant names back to original indices for recommended restaurants
              const restaurantList = originalRestaurants || restaurants;

              const updatedRecommendedIndices = (
                result.updatedData.newRecommendedRestaurantIndices || []
              )
                .map((name: string) => {
                  const index = restaurantList.findIndex(
                    (r) => r.name === name
                  );
                  return index;
                })
                .filter((index: number) => index !== -1);

              if (
                !result.updatedData.newRatings ||
                !result.updatedData.newGroupScores
              ) {
                console.error("Missing required data in updatedData");
                return;
              }

              const updateData = {
                ratings: result.updatedData.newRatings,
                groupScores: result.updatedData.newGroupScores,
                recommendedRestaurantIndices: updatedRecommendedIndices,
              };

              // Update the parent component with new data
              // The tool result already contains the correct ratings in original index format
              onDataUpdate(updateData);
              setLastToolResult(result);
            }
          }
        }

        const responseText = lastMessage.parts
          .filter((part) => part.type === "text")
          .map((part) =>
            typeof part.text === "string" ? part.text : String(part.text || "")
          )
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        // Verification details are logged server-side in the API route.
        if (
          responseText &&
          !toolCallInProgress &&
          responseText !== lastLoggedResponseRef.current
        ) {
          console.log("🤖 Assistant response:", responseText);
          lastLoggedResponseRef.current = responseText;
        }
      }
    }
  }, [messages, onDataUpdate, people, restaurants, originalRestaurants]);

  interface MessageInput {
    text?: string;
    files?: unknown[];
  }
  const handleFormSubmit = (message: MessageInput, event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim()) return;
    if (isConversationClosed) return;

    const submittedQuery = input.trim();
    console.log("📤 Sending message:", {
      text: submittedQuery,
      context: {
        peopleCount: context.people.length,
        restaurantsCount: context.restaurants.length,
        ratingsShape: `${context.ratings.length}x${context.ratings[0]?.length}`,
        strategy: context.strategy,
      },
    });

    sendMessage({ text: submittedQuery, metadata: { context } });
    onQuerySubmit?.(submittedQuery);
    onChatLogEntry?.({
      role: "user",
      content: submittedQuery,
      timestamp: new Date().toISOString(),
      metadata: { source: "typed_query" },
    });
    setInput("");
  };

  const handleInputChangeWrapper = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setInput(e.target.value);
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (isConversationClosed) return;
    console.log("💡 Suggestion clicked:", suggestion);
    setInput(suggestion);
    sendMessage({ text: suggestion, metadata: { context } });
    setInput("");
    onSuggestionClick?.(suggestion);
    onChatLogEntry?.({
      role: "user",
      content: suggestion,
      timestamp: new Date().toISOString(),
      metadata: { source: "suggestion" },
    });
  };

  const excludedSuggestionRestaurants = [
    ...restaurants.filter((restaurant) => restaurant.visited).map((r) => r.name),
    ...recommendedRestaurantIndices.map((index) => restaurants[index]?.name),
  ].filter((name): name is string => Boolean(name));

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">
          Recommended restaurant
          {recommendedRestaurantIndices.length > 1 ? "s" : ""}:{" "}
          {recommendedRestaurantIndices
            .map((i) => restaurants[i].name)
            .join(", ")}
        </h3>
      </div>

      <ChatInterface
        messages={messages}
        status={status}
        input={input}
        onInputChange={handleInputChangeWrapper}
        onSubmit={handleFormSubmit}
        suggestions={suggestions}
        onSuggestionClick={handleSuggestionClick}
        excludedSuggestionRestaurants={excludedSuggestionRestaurants}
        conversationClassName="h-72 border rounded-lg"
        dataOnboardingConversation="chat-interface"
        dataOnboardingPresets="presets"
        dataOnboardingInput="chat-input"
        isConversationClosed={isConversationClosed}
        conversationClosedMessage={CONVERSATION_CLOSED_MESSAGE}
      />
    </div>
  );
}
