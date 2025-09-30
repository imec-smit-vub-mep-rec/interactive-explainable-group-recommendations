"use client";

import React, { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageAvatar,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputSubmit,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { Response } from "@/components/ai-elements/response";

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

interface TextChatProps {
  people: Person[];
  restaurants: Restaurant[];
  ratings: number[][];
  strategy: AggregationStrategy;
  groupScores: number[];
  recommendedRestaurantIndices: number[];
}

// Starter suggestions for users
const suggestions = [
  "Why was this restaurant recommended?",
  "What if Alex's rating for Rest 4 increased to 5?",
  "What should change so that Rest 1 becomes the top choice?",
  "What if Darcy changed their rating for Rest 2 to 5?",
  "Explain the current recommendation strategy",
  "Show me the individual ratings for the recommended restaurant",
];

export default function TextChat({
  people,
  restaurants,
  ratings,
  strategy,
  groupScores,
  recommendedRestaurantIndices,
}: TextChatProps) {
  const [input, setInput] = useState("");

  // Create context object
  const context = {
    people,
    restaurants,
    ratings,
    strategy,
    groupScores,
    recommendedRestaurantIndices,
  };

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: {
        context,
      },
    }),
  });

  const handleFormSubmit = (message: any, event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput("");
  };

  const handleInputChangeWrapper = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setInput(e.target.value);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    sendMessage({ text: suggestion });
    setInput("");
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">
          Ask about the recommendation
        </h3>
      </div>

      {/* Show suggestions when there are no messages */}
      {messages.length === 0 && (
        <div className="mb-4">
          <Suggestions>
            {suggestions.map((suggestion) => (
              <Suggestion
                key={suggestion}
                suggestion={suggestion}
                onClick={handleSuggestionClick}
              />
            ))}
          </Suggestions>
        </div>
      )}

      <Conversation className="h-96 border rounded-lg">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="No messages yet"
              description="Click on a suggestion above or type your own question to get started"
            />
          ) : (
            messages.map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageAvatar
                  src={
                    message.role === "user"
                      ? "/user-avatar.png"
                      : "/assistant-avatar.png"
                  }
                  name={message.role === "user" ? "U" : "A"}
                />
                <MessageContent>
                  {message.parts?.map((part: any, i: number) => (
                    <div key={i}>
                      {part.type === "text" ? (
                        <Response key={i}>{part.text}</Response>
                      ) : null}
                      {part.type === "tool-call" ? (
                        <div className="text-sm text-gray-600">
                          Calling tool: {part.toolName}
                        </div>
                      ) : null}
                      {part.type === "tool-result" ? (
                        <div className="text-sm text-gray-600">
                          Tool result: {part.result}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </MessageContent>
              </Message>
            ))
          )}
        </ConversationContent>
      </Conversation>

      <div className="mt-4">
        <PromptInput onSubmit={handleFormSubmit}>
          <PromptInputBody>
            <PromptInputTextarea
              value={input}
              onChange={handleInputChangeWrapper}
              placeholder="Ask about the restaurant recommendation..."
              disabled={status !== "ready"}
            />
            <PromptInputToolbar className="border-t">
              <PromptInputTools></PromptInputTools>
              <PromptInputSubmit disabled={status !== "ready"} />
            </PromptInputToolbar>
          </PromptInputBody>
        </PromptInput>
      </div>
    </div>
  );
}
