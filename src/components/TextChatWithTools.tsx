"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { resolvePeoplePlaceholders } from "@/lib/scenario_helpers";

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
const suggestionTemplates = [
  "Why was this restaurant recommended?",
  "How to make Rest 1 the top choice?",
  "What would need to change for Rest 3 to be preferred?",
  "Explain the current recommendation strategy",
  "Show me the individual ratings for the recommended restaurant",
  "Which person's rating has the most impact on the recommendation?",
  "What if {p1}'s rating for Rest 4 increased to 5?",
  "What if {p0} changed their rating for Rest 2 to 5?",
  "Update {p1}'s rating for Rest 1 to 5",
  "Change {p0}'s rating for Rest 3 to 4",
  "Change all {p3}'s ratings to 3",
  "Set all of {p1}'s ratings to be at least 4",
  "What happens if I increase all ratings for Rest 2 by 1?",
];
const MAX_USER_MESSAGES = 15;
const CONVERSATION_CLOSED_MESSAGE =
  "This conversation is now closed after 15 questions.";

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
  const suggestions = useMemo(() => {
    const peopleNames = people.map((person) => person.name);
    return suggestionTemplates.map((template) =>
      resolvePeoplePlaceholders(template, peopleNames)
    );
  }, [people]);
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
  const userMessageCount = messages.filter((message) => message.role === "user").length;
  const isConversationClosed = userMessageCount >= MAX_USER_MESSAGES;

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
    if (isConversationClosed) return;
    
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
    if (isConversationClosed) return;
    console.log('💡 Suggestion clicked:', suggestion);
    setInput(suggestion);
    sendMessage({ text: suggestion, metadata: { context } });
    setInput("");
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
        conversationClassName="h-96 border rounded-lg"
        isConversationClosed={isConversationClosed}
        conversationClosedMessage={CONVERSATION_CLOSED_MESSAGE}
      />
    </div>
  );
}

