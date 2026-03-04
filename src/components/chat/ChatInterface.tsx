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
const FALLBACK_ASSISTANT_MESSAGE = "I'm sorry, I could not answer that question.";

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
  isConversationClosed?: boolean;
  conversationClosedMessage?: string;
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const containsRestaurantName = (text: string, restaurantName: string) =>
  new RegExp(`\\b${escapeRegExp(restaurantName)}\\b`, "i").test(text);

const parseSuggestions = (
  text: string,
  excludedRestaurants: string[] = []
): string[] => {
  if (!text || typeof text !== "string") return [];
  const match = text.match(/<suggestions\b[^>]*>([\s\S]*?)(?:<\/suggestions\s*>|$)/i);
  if (!match) return [];
  const suggestions = match[1]
    .split("\n")
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 2);
  if (suggestions.length !== 2) {
    return [];
  }

  const excluded = excludedRestaurants.filter((name) => name.trim().length > 0);
  return (
    excluded.length === 0
      ? suggestions
      : suggestions.filter((suggestion) => {
        return !excluded.some((name) =>
          containsRestaurantName(suggestion, name)
        );
      })
  );
};

const extractMessageText = (message: ChatMessage): string => {
  if (!Array.isArray(message.parts)) return "";
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) =>
      typeof part.text === "string" ? part.text : String(part.text || "")
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
};

const isLikelyCounterfactualQuery = (query: string): boolean => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return false;
  return (
    /(^| )what if( |$)/.test(normalized) ||
    /(^| )how to make( |$)/.test(normalized) ||
    /(^| )would need to change( |$)/.test(normalized) ||
    /(^| )needs? to change( |$)/.test(normalized) ||
    /(^| )update( |$)/.test(normalized) ||
    /(^| )change( |$)/.test(normalized) ||
    /(^| )set( |$)/.test(normalized) ||
    /(^| )increase( |$)/.test(normalized) ||
    /(^| )decrease( |$)/.test(normalized)
  );
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
  isConversationClosed = false,
  conversationClosedMessage = "This conversation is now closed after 15 questions.",
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
  const lastMessage = messages[messages.length - 1];
  const showCounterfactualFallback =
    status === "ready" &&
    !isConversationClosed &&
    lastMessage?.role === "user" &&
    isLikelyCounterfactualQuery(extractMessageText(lastMessage));

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
                      disabled={isConversationClosed}
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
                        const suggestions = isAssistant
                          ? parseSuggestions(
                              textContent,
                              excludedSuggestionRestaurants
                            )
                          : [];
                        const cleanText = isAssistant
                          ? textContent
                              .replace(
                                /<suggestions\b[^>]*>[\s\S]*?(?:<\/suggestions\s*>|$)/gi,
                                ""
                              )
                              .trim()
                          : textContent;
                        return (
                          <div key={i}>
                            <Response>
                              {isAssistant && cleanText.length === 0
                                ? FALLBACK_ASSISTANT_MESSAGE
                                : cleanText}
                            </Response>
                            {isAssistant && suggestions.length > 0 && (
                              <div className="mt-3">
                                <Suggestions>
                                  {suggestions.map((suggestion, idx) => (
                                    <Suggestion
                                      key={`${message.id}-follow-up-${idx}`}
                                      suggestion={suggestion}
                                      onClick={onSuggestionClick}
                                      disabled={isConversationClosed}
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
                            found?: boolean;
                            restaurantName?: string;
                            ratingsPerPerson?: Array<{
                              personName: string;
                              rating: number;
                            }>;
                            groupScore?: number;
                            proposedChanges?: Array<{
                              personName: string;
                              restaurantName: string;
                              oldRating: number;
                              newRating: number;
                            }>;
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
                                  <strong>{result.message || "Success"}</strong>
                                </div>
                                {result.proposedChanges &&
                                  result.proposedChanges.length > 0 && (
                                    <div className="text-sm mb-3">
                                      <p className="font-medium mb-1">
                                        Proposed change:
                                      </p>
                                      <ul className="list-disc list-inside ml-2 space-y-1">
                                        {result.proposedChanges.map(
                                          (update, index) => (
                                            <li key={index}>
                                              {update.personName}&apos;s rating
                                              for {update.restaurantName}:{" "}
                                              {update.oldRating} →{" "}
                                              {update.newRating}
                                            </li>
                                          )
                                        )}
                                      </ul>
                                    </div>
                                  )}
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
                                    {!result.verification.ok && (
                                      <p className="mb-1 text-amber-700">
                                        Could not be verified
                                      </p>
                                    )}
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
                            ) : result.found === true &&
                              Array.isArray(result.ratingsPerPerson) ? (
                              <div className="text-gray-700 bg-gray-50 p-3 rounded border border-gray-200">
                                <div className="flex items-center mb-2">

                                  <strong>
                                    {result.restaurantName || "Restaurant"} scores
                                  </strong>
                                </div>
                                <div className="text-sm space-y-1">
                                  {result.ratingsPerPerson.map((p, idx) => (
                                    <p key={idx}>
                                      {p.personName}: {p.rating}
                                    </p>
                                  ))}
                                  {typeof result.groupScore === "number" && (
                                    <p className="font-medium mt-2 pt-2 border-t border-gray-200">
                                      Group score: {result.groupScore}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ) : result.found === false && result.message ? (
                              <div className="text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                                <span>{result.message}</span>
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

          {(status === "submitted" || status === "streaming") && (
            <Message from="assistant">
              <MessageAvatar
                src="/assistant-avatar.png"
                name="A"
              />
              <MessageContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader className="text-muted-foreground" size={16} />
                  <span>Thinking...</span>
                </div>
              </MessageContent>
            </Message>
          )}
          {status === "error" && (
            <Message from="assistant">
              <MessageAvatar
                src="/assistant-avatar.png"
                name="A"
              />
              <MessageContent>
                <Response>{FALLBACK_ASSISTANT_MESSAGE}</Response>
              </MessageContent>
            </Message>
          )}
          {showCounterfactualFallback && (
            <Message from="assistant">
              <MessageAvatar src="/assistant-avatar.png" name="A" />
              <MessageContent>
                <Response>{FALLBACK_ASSISTANT_MESSAGE}</Response>
              </MessageContent>
            </Message>
          )}
          {isConversationClosed && (
            <Message from="assistant">
              <MessageAvatar
                src="/assistant-avatar.png"
                name="A"
              />
              <MessageContent>
                <Response>{conversationClosedMessage}</Response>
              </MessageContent>
            </Message>
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
                placeholder="Ask anything about the restaurant recommendation. For example, 'What is the recommended restaurant order?', 'Why is Rest 1 recommended?', 'How to make Rest 2 preferred?'"
                disabled={status !== "ready" || isConversationClosed}
              />
              <div className="flex-shrink-0 h-full pr-2">
                <PromptInputSubmit
                  disabled={status !== "ready" || isConversationClosed}
                />
              </div>
            </div>
          </PromptInputBody>
        </PromptInput>
      </div>
    </>
  );
};
