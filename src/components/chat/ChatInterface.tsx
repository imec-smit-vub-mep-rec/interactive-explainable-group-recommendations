"use client";

import React from "react";
import type { ChatStatus } from "ai";
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
import { Loader } from "@/components/ai-elements/loader";
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputSubmit,
  type PromptInputProps,
} from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { Response } from "@/components/ai-elements/response";
import { CheckCircle2, Wrench, XCircle } from "lucide-react";

type ChatMessage = {
  id: string;
  role: "system" | "user" | "assistant";
  parts?: Array<Record<string, unknown>>;
};

export type ChatInterfaceProps = {
  messages: ChatMessage[];
  status: ChatStatus;
  input: string;
  onInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: PromptInputProps["onSubmit"];
  suggestions: string[];
  onSuggestionClick: (suggestion: string) => void;
  excludedSuggestionRestaurants?: string[];
  conversationClassName?: string;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  dataOnboardingConversation?: string;
  dataOnboardingPresets?: string;
  dataOnboardingInput?: string;
};

const normalizeText = (value: string) => value.trim().toLowerCase();
const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const containsRestaurantName = (text: string, restaurantName: string) =>
  new RegExp(`\\b${escapeRegExp(restaurantName)}\\b`, "i").test(text);

const parseSuggestions = (
  text: string,
  excludedRestaurants: string[] = []
): { cleanText: string; suggestions: string[] } => {
  if (!text || typeof text !== "string") {
    return { cleanText: text || "", suggestions: [] };
  }

  const suggestionRegex = /<suggestions\s*>([\s\S]*?)<\/suggestions\s*>/gi;
  let cleanText = text;
  const suggestions: string[] = [];

  const matches = [...text.matchAll(suggestionRegex)];

  if (matches.length > 0) {
    matches.forEach((match) => {
      const suggestionsText = match[1].trim();
      const extracted = suggestionsText
        .split("\n")
        .map((line) => line.replace(/^[-•*]\s*/, "").trim())
        .filter((line) => line.length > 0);
      suggestions.push(...extracted);
    });

    cleanText = text.replace(suggestionRegex, "").trim();
  }

  cleanText = cleanText.replace(/<\/?suggestions\s*>/gi, "").trim();

  const excluded = excludedRestaurants.filter((name) => name.trim().length > 0);
  const filteredSuggestions =
    excluded.length === 0
      ? suggestions
      : suggestions.filter((suggestion) => {
          return !excluded.some((name) =>
            containsRestaurantName(suggestion, name)
          );
        });

  return { cleanText, suggestions: filteredSuggestions };
};

export const ChatInterface = ({
  messages,
  status,
  input,
  onInputChange,
  onSubmit,
  suggestions,
  onSuggestionClick,
  excludedSuggestionRestaurants,
  conversationClassName = "h-72 border rounded-lg",
  emptyStateTitle = "No messages yet",
  emptyStateDescription = "Click on a suggestion above or type your own question to get started",
  dataOnboardingConversation,
  dataOnboardingPresets,
  dataOnboardingInput,
}: ChatInterfaceProps) => {
  const excludedPresets = (excludedSuggestionRestaurants ?? []).filter(
    (name) => name.trim().length > 0
  );
  const filteredPresetSuggestions =
    excludedPresets.length === 0
      ? suggestions
      : suggestions.filter((suggestion) => {
          return !excludedPresets.some((name) =>
            containsRestaurantName(suggestion, name)
          );
        });

  return (
    <>
      <Conversation
        className={conversationClassName}
        data-onboarding={dataOnboardingConversation}
      >
        <ConversationContent>
          {messages.length === 0 ? (
            <div>
              <ConversationEmptyState
                title={emptyStateTitle}
                description={emptyStateDescription}
              />

              <div className="mb-4 pt-2" data-onboarding={dataOnboardingPresets}>
                <Suggestions>
                  {filteredPresetSuggestions.map((suggestion) => (
                    <Suggestion
                      key={suggestion}
                      suggestion={suggestion}
                      onClick={onSuggestionClick}
                    />
                  ))}
                </Suggestions>
              </div>
            </div>
          ) : (
            messages.map((message) => {
              const isAssistant = message.role === "assistant";
              return (
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
                  {message.parts?.map((part, i: number) => {
                    if (part.type === "text") {
                      const textContent =
                        typeof part.text === "string"
                          ? part.text
                          : String(part.text || "");
                      if (!isAssistant) {
                        return (
                          <div key={i}>
                            <Response>{textContent}</Response>
                          </div>
                        );
                      }
                      const { cleanText, suggestions } = parseSuggestions(
                        textContent,
                        excludedSuggestionRestaurants
                      );
                      return (
                        <div key={i}>
                          <Response>{cleanText}</Response>
                          {suggestions.length > 0 && (
                            <div className="mt-3">
                              <Suggestions>
                                {suggestions.map((suggestion, idx) => (
                                  <Suggestion
                                    key={idx}
                                    suggestion={suggestion}
                                    onClick={onSuggestionClick}
                                  />
                                ))}
                              </Suggestions>
                            </div>
                          )}
                        </div>
                      );
                    }
                    if (part.type === "tool-call" && isAssistant) {
                      return (
                        <div
                          key={i}
                          className="text-sm text-blue-700 bg-blue-50 p-2 rounded border border-blue-200 inline-flex items-center gap-2"
                        >
                          <Wrench
                            className="w-4 h-4 text-blue-700"
                            aria-hidden="true"
                          />
                          <span>
                            Calling tool:{" "}
                            {"toolName" in part
                              ? String(part.toolName)
                              : "unknown"}
                          </span>
                          <span className="inline-flex items-center gap-1 text-blue-600">
                            <Loader className="text-blue-600" size={14} />
                            Verifying...
                          </span>
                        </div>
                      );
                    }
                    if (
                      (part.type === "tool-result" && isAssistant) ||
                      (typeof part.type === "string" &&
                        part.type.startsWith("tool-") &&
                        part.type !== "tool-call" &&
                        isAssistant)
                    ) {
                      const result = (
                        "result" in part
                          ? part.result
                          : "output" in part
                          ? part.output
                          : "data" in part
                          ? part.data
                          : part
                      ) as
                        | {
                            success?: boolean;
                            message?: string;
                            updatedData?: {
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
                              computed?: {
                                winners?: string[];
                                targetScore?: number;
                              };
                              minimality?: {
                                proven?: boolean;
                                isMinimal?: boolean;
                                counterexample?: {
                                  updates?: Array<{
                                    personName: string;
                                    restaurantName: string;
                                    newRating: number;
                                  }>;
                                };
                              };
                            };
                          }
                        | null;

                      if (!result) {
                        return null;
                      }

                      return (
                        <div key={i} className="text-sm text-gray-600">
                          {result.success ? (
                            <div className="text-green-600 bg-green-50 p-3 rounded border border-green-200">
                              <div className="flex items-center mb-2">
                                <CheckCircle2
                                  className="w-4 h-4 text-green-700 mr-2"
                                  aria-hidden="true"
                                />
                                <strong>{result.message || "Success"}</strong>
                              </div>
                              {result.updatedData && (
                                <div className="text-sm">
                                  <p className="mb-2">
                                    New recommended restaurants:{" "}
                                    {(
                                      result.updatedData
                                        .newRecommendedRestaurantIndices || []
                                    ).join(", ")}
                                  </p>
                                  {result.updatedData.updates &&
                                    result.updatedData.updates.length > 1 && (
                                      <div>
                                        <p className="font-medium mb-1">
                                          Updated ratings:
                                        </p>
                                        <ul className="list-disc list-inside ml-2 space-y-1">
                                          {result.updatedData.updates.map(
                                            (update, index) => (
                                              <li key={index}>
                                                {update.personName}&apos;s
                                                rating for{" "}
                                                {update.restaurantName}:{" "}
                                                {update.oldRating} →{" "}
                                                {update.newRating}
                                              </li>
                                            )
                                          )}
                                        </ul>
                                      </div>
                                    )}
                                </div>
                              )}
                              {result.verification && (
                                <div className="text-sm mt-3">
                                  <p className="mb-1">
                                    Verification:{" "}
                                    {result.verification.ok
                                      ? "verified"
                                      : "not verified"}
                                  </p>
                                  {result.verification.computed?.winners && (
                                    <p className="mb-1">
                                      Winners:{" "}
                                      {result.verification.computed.winners.join(
                                        ", "
                                      )}
                                    </p>
                                  )}
                                  {typeof result.verification.computed
                                    ?.targetScore === "number" && (
                                    <p className="mb-1">
                                      Target score:{" "}
                                      {result.verification.computed.targetScore}
                                    </p>
                                  )}
                                  {result.verification.minimality && (
                                    <p className="mb-1">
                                      Minimality:{" "}
                                      {result.verification.minimality.proven
                                        ? result.verification.minimality
                                            .isMinimal
                                          ? "proven"
                                          : "not minimal"
                                        : "not proven"}
                                    </p>
                                  )}
                                  {result.verification.minimality?.counterexample
                                    ?.updates &&
                                    result.verification.minimality
                                      .counterexample.updates.length > 0 && (
                                      <div>
                                        <p className="font-medium mb-1">
                                          Smaller change found:
                                        </p>
                                        <ul className="list-disc list-inside ml-2 space-y-1">
                                          {result.verification.minimality.counterexample.updates.map(
                                            (update, index) => (
                                              <li key={index}>
                                                {update.personName}&apos;s
                                                rating for{" "}
                                                {update.restaurantName} →{" "}
                                                {update.newRating}
                                              </li>
                                            )
                                          )}
                                        </ul>
                                      </div>
                                    )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-red-700 bg-red-50 p-2 rounded border border-red-200 inline-flex items-start gap-2">
                              <XCircle
                                className="w-4 h-4 text-red-700 mt-0.5"
                                aria-hidden="true"
                              />
                              <span>
                                Tool error: {result.message || "Unknown error"}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })}
                </MessageContent>
                </Message>
              );
            })
          )}
        </ConversationContent>
      </Conversation>

      <div className="mt-4" data-onboarding={dataOnboardingInput}>
        <PromptInput onSubmit={onSubmit}>
          <PromptInputBody>
            <div className="flex flex-row justify-between items-center">
              <PromptInputTextarea
                value={input}
                onChange={onInputChange}
                placeholder="Ask about the restaurant recommendation or request changes..."
                disabled={status !== "ready"}
              />
              <div className="flex-shrink-0 h-full pr-2">
                <PromptInputSubmit disabled={status !== "ready"} />
              </div>
            </div>
          </PromptInputBody>
        </PromptInput>
      </div>
    </>
  );
};
