"use client";

import React, { useState, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { CheckCircle2, Wrench, XCircle } from "lucide-react";
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
  onDataUpdate?: (updatedData: {
    ratings: number[][];
    groupScores: number[];
    recommendedRestaurantIndices: number[];
  }) => void;
  originalRestaurants?: Restaurant[];
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
  }
  const [lastToolResult, setLastToolResult] = useState<ToolResult | null>(null);
  
  // Helper function to parse suggestions from text
  const parseSuggestions = (text: string): { cleanText: string; suggestions: string[] } => {
    if (!text || typeof text !== 'string') return { cleanText: text || '', suggestions: [] };
    
    // More robust regex that handles various whitespace and formatting
    // Match <suggestions>...</suggestions> with any whitespace
    const suggestionRegex = /<suggestions\s*>([\s\S]*?)<\/suggestions\s*>/gi;
    let cleanText = text;
    const suggestions: string[] = [];
    
    // Find and extract all suggestion blocks
    const matches = [...text.matchAll(suggestionRegex)];
    
    if (matches.length > 0) {
      // Extract suggestions from all matches
      matches.forEach(match => {
        const suggestionsText = match[1].trim();
        const extracted = suggestionsText
          .split('\n')
          .map(line => line.replace(/^[-•*]\s*/, '').trim())
          .filter(line => line.length > 0);
        suggestions.push(...extracted);
      });
      
      // Remove all suggestion blocks from the text
      cleanText = text.replace(suggestionRegex, '').trim();
    }
    
    // Final safeguard: remove any remaining suggestion tags (in case of malformed tags)
    cleanText = cleanText.replace(/<\/?suggestions\s*>/gi, '').trim();
    
    return { cleanText, suggestions };
  };

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
    }),
  });

  // Handle tool results and update parent component
  useEffect(() => {
    console.log('🔍 TextChat useEffect triggered - messages length:', messages.length);
    
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      console.log('📨 Last message:', {
        role: lastMessage.role,
        partsCount: lastMessage.parts?.length || 0,
        parts: lastMessage.parts?.map(part => ({
          type: part.type,
          hasResult: 'result' in part,
          toolName: 'toolName' in part ? part.toolName : undefined
        }))
      });

      if (lastMessage.role === "assistant" && lastMessage.parts) {
        // Look for tool-result or tool-{toolName} parts
        const toolResult = lastMessage.parts.find(part => 
          part.type === "tool-result" || 
          (part.type && part.type.startsWith("tool-") && part.type !== "tool-call")
        );
        console.log('🔧 Tool result found:', !!toolResult, 'Tool result type:', toolResult?.type);
        
        // Check if there are any tool calls in progress
        const toolCallInProgress = lastMessage.parts?.find(part => 
          part.type && part.type.startsWith("tool-") && part.type !== "tool-result"
        );
        if (toolCallInProgress) {
          console.log('⏳ Tool call in progress:', {
            type: toolCallInProgress.type,
            hasResult: 'result' in toolCallInProgress,
            hasOutput: 'output' in toolCallInProgress,
            keys: Object.keys(toolCallInProgress),
            fullPart: toolCallInProgress
          });
        }
        
        if (toolResult && ('result' in toolResult || 'output' in toolResult)) {
          // Handle both tool-result and tool-{toolName} formats
          const result = ('result' in toolResult ? toolResult.result : 
                         'output' in toolResult ? toolResult.output : 
                         toolResult) as ToolResult;
          console.log('📊 Tool result structure:', {
            toolResultType: toolResult.type,
            hasResult: 'result' in toolResult,
            hasOutput: 'output' in toolResult,
            resultKeys: Object.keys(result || {}),
            resultValue: result,
            fullToolResult: toolResult
          });
          
          // Check if result is valid before trying to access properties
          if (result && typeof result === 'object' && (result.success !== undefined || result.message)) {
            console.log('📊 Tool result data:', {
              success: result.success,
              hasUpdatedData: !!result.updatedData,
              message: result.message,
              updatedData: result.updatedData ? {
                personName: result.updatedData.personName,
                restaurantName: result.updatedData.restaurantName,
                oldRating: result.updatedData.oldRating,
                newRating: result.updatedData.newRating,
                newRatingsLength: result.updatedData.newRatings?.length,
                newGroupScoresLength: result.updatedData.newGroupScores?.length,
                newRecommendedRestaurantIndices: result.updatedData.newRecommendedRestaurantIndices
              } : null
            });

            if (result.success && result.updatedData && onDataUpdate) {
            console.log('✅ Processing successful tool result');
            
            // The tool result contains data based on original indices
            // We need to convert restaurant names back to original indices for recommended restaurants
            const restaurantList = originalRestaurants || restaurants;
            console.log('🏪 Restaurant list for mapping:', {
              usingOriginal: !!originalRestaurants,
              restaurantCount: restaurantList.length,
              restaurantNames: restaurantList.map(r => r.name)
            });

            const updatedRecommendedIndices = (result.updatedData.newRecommendedRestaurantIndices || [])
              .map((name: string) => {
                const index = restaurantList.findIndex(r => r.name === name);
                console.log(`🔍 Mapping restaurant "${name}" to index: ${index}`);
                return index;
              })
              .filter((index: number) => index !== -1);

            console.log('🎯 Final updated recommended indices:', updatedRecommendedIndices);

            if (!result.updatedData.newRatings || !result.updatedData.newGroupScores) {
              console.error('Missing required data in updatedData');
              return;
            }

            const updateData = {
              ratings: result.updatedData.newRatings,
              groupScores: result.updatedData.newGroupScores,
              recommendedRestaurantIndices: updatedRecommendedIndices,
            };

            console.log('📤 Calling onDataUpdate with:', {
              ratingsShape: `${updateData.ratings.length}x${updateData.ratings[0]?.length}`,
              groupScoresLength: updateData.groupScores.length,
              recommendedIndices: updateData.recommendedRestaurantIndices,
              hasOnDataUpdate: !!onDataUpdate,
              updateType: result.updatedData.updates ? 'multiple' : 'single',
              updateCount: result.updatedData.updates?.length || 1
            });

            // Update the parent component with new data
            // The tool result already contains the correct ratings in original index format
            onDataUpdate(updateData);
            setLastToolResult(result);
            
              console.log('✅ Tool result processing complete');
              console.log('🎉 LastToolResult state updated with:', {
                success: result.success,
                message: result.message,
                hasUpdatedData: !!result.updatedData,
                updateType: result.updatedData.updates ? 'multiple' : 'single',
                updateCount: result.updatedData.updates?.length || 1
              });
            } else {
              console.log('❌ Tool result not processed:', {
                success: result.success,
                hasUpdatedData: !!result.updatedData,
                hasOnDataUpdate: !!onDataUpdate
              });
            }
          } else {
            console.log('❌ Invalid tool result format:', {
              result: result,
              resultType: typeof result,
              hasSuccess: result && 'success' in result,
              hasMessage: result && 'message' in result
            });
          }
        } else {
          // Check if we have a tool call that might contain the result in a different format
          const toolCallPart = lastMessage.parts?.find(part => 
            part.type && part.type.startsWith("tool-") && part.type !== "tool-result"
          );
          
          if (toolCallPart) {
            console.log('🔍 Found tool call part, checking for result data:', {
              type: toolCallPart.type,
              hasResult: 'result' in toolCallPart,
              hasOutput: 'output' in toolCallPart,
              hasData: 'data' in toolCallPart,
              keys: Object.keys(toolCallPart),
              fullPart: toolCallPart
            });
            
            // Try to extract result from the tool call part
            const result = ('result' in toolCallPart ? toolCallPart.result : 
                           'output' in toolCallPart ? toolCallPart.output : 
                           'data' in toolCallPart ? toolCallPart.data : 
                           toolCallPart) as ToolResult;
                           
            if (result && typeof result === 'object' && (result.success || result.message)) {
              console.log('✅ Found result in tool call part:', result);
              // Process the result as if it were a tool result
              if (result.success && result.updatedData && onDataUpdate) {
                console.log('🔄 Processing result from tool call part...');
                // Use the same processing logic as above
                const restaurantList = originalRestaurants || restaurants;
                const updatedRecommendedIndices = (result.updatedData.newRecommendedRestaurantIndices || [])
                  .map((name: string) => restaurantList.findIndex(r => r.name === name))
                  .filter((index: number) => index !== -1);

                console.log('📤 Processing tool call part with:', {
                  updateType: result.updatedData.updates ? 'multiple' : 'single',
                  updateCount: result.updatedData.updates?.length || 1
                });

                if (!result.updatedData.newRatings || !result.updatedData.newGroupScores) {
                  console.error('Missing required data in updatedData');
                  return;
                }

                onDataUpdate({
                  ratings: result.updatedData.newRatings,
                  groupScores: result.updatedData.newGroupScores,
                  recommendedRestaurantIndices: updatedRecommendedIndices,
                });
                setLastToolResult(result);
                console.log('✅ Tool call part result processed successfully');
              }
            }
          } else {
            console.log('❌ No valid tool result found in message parts:', {
              toolResultFound: !!toolResult,
              toolResultType: toolResult?.type,
              hasResult: toolResult ? 'result' in toolResult : false,
              hasOutput: toolResult ? 'output' in toolResult : false,
              allPartTypes: lastMessage.parts?.map(p => p.type)
            });
          }
        }
      }
    }
  }, [messages, onDataUpdate, people, restaurants, originalRestaurants]);

  // Track when lastToolResult changes
  useEffect(() => {
    if (lastToolResult) {
      console.log('🔄 lastToolResult state changed:', {
        success: lastToolResult.success,
        message: lastToolResult.message,
        hasUpdatedData: !!lastToolResult.updatedData
      });
    }
  }, [lastToolResult]);

  interface MessageInput {
    text?: string;
    files?: unknown[];
  }
  const handleFormSubmit = (message: MessageInput, event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim()) return;
    
    console.log('📤 Sending message:', {
      text: input,
      context: {
        peopleCount: context.people.length,
        restaurantsCount: context.restaurants.length,
        ratingsShape: `${context.ratings.length}x${context.ratings[0]?.length}`,
        strategy: context.strategy
      }
    });
    
    sendMessage({ text: input, metadata: { context } });
    setInput("");
  };

  const handleInputChangeWrapper = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setInput(e.target.value);
  };

  const handleSuggestionClick = (suggestion: string) => {
    console.log('💡 Suggestion clicked:', suggestion);
    setInput(suggestion);
    sendMessage({ text: suggestion, metadata: { context } });
    setInput("");
  };

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


      {/* Show suggestions when there are no messages */}
      {messages.length === 0 && (
        <div className="mb-4" data-onboarding="presets">
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

      <Conversation className="h-96 border rounded-lg" data-onboarding="chat-interface">
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
                  {message.parts?.map((part, i: number) => {
                    if (part.type === "text") {
                      const textContent = typeof part.text === 'string' ? part.text : String(part.text || '');
                      const { cleanText, suggestions } = parseSuggestions(textContent);
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
                                    onClick={handleSuggestionClick}
                                  />
                                ))}
                              </Suggestions>
                            </div>
                          )}
                        </div>
                      );
                    }
                    if (part.type === "tool-call") {
                      return (
                        <div
                          key={i}
                          className="text-sm text-blue-700 bg-blue-50 p-2 rounded border border-blue-200 inline-flex items-center gap-2"
                        >
                          <Wrench className="w-4 h-4 text-blue-700" aria-hidden="true" />
                          <span>
                            Calling tool:{" "}
                            {"toolName" in part ? String(part.toolName) : "unknown"}
                          </span>
                        </div>
                      );
                    }
                    if (part.type === "tool-result" || (part.type && part.type.startsWith("tool-") && part.type !== "tool-call")) {
                      const result = ('result' in part ? part.result : 
                                     'output' in part ? part.output : 
                                     'data' in part ? part.data : 
                                     part) as ToolResult | null;
                      if (!result) return null;
                      return (
                        <div key={i} className="text-sm text-gray-600">
                          {result.success ? (
                            <div className="text-green-600 bg-green-50 p-3 rounded border border-green-200">
                              <div className="flex items-center mb-2">
                                <CheckCircle2 className="w-4 h-4 text-green-700 mr-2" aria-hidden="true" />
                                <strong>{result.message || 'Success'}</strong>
                              </div>
                              {result.updatedData && (
                                <div className="text-sm">
                                  <p className="mb-2">New recommended restaurants: {(result.updatedData.newRecommendedRestaurantIndices || []).join(", ")}</p>
                                  {result.updatedData.updates && result.updatedData.updates.length > 1 && (
                                    <div>
                                      <p className="font-medium mb-1">Updated ratings:</p>
                                      <ul className="list-disc list-inside ml-2 space-y-1">
                                        {result.updatedData.updates.map((update: { personName: string; restaurantName: string; oldRating: number; newRating: number }, index: number) => (
                                          <li key={index}>
                                            {update.personName}&apos;s rating for {update.restaurantName}: {update.oldRating} → {update.newRating}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-red-700 bg-red-50 p-2 rounded border border-red-200 inline-flex items-start gap-2">
                              <XCircle className="w-4 h-4 text-red-700 mt-0.5" aria-hidden="true" />
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
            ))
          )}
        </ConversationContent>
      </Conversation>

      <div className="mt-4" data-onboarding="chat-input">
        <PromptInput onSubmit={handleFormSubmit}>
          <PromptInputBody>
            <PromptInputTextarea
              value={input}
              onChange={handleInputChangeWrapper}
              placeholder="Ask about the restaurant recommendation or request changes..."
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

