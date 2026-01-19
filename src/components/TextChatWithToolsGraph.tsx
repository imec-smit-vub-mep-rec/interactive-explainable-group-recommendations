"use client";

import React, { useState, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ChatInterface } from "@/components/chat/ChatInterface";
import GraphSliders from "./GraphSliders";

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

interface TextChatWithToolsGraphProps {
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
  originalRatings?: number[][];
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

export default function TextChatWithToolsGraph({
  people,
  restaurants,
  ratings,
  strategy,
  groupScores,
  recommendedRestaurantIndices,
  onDataUpdate,
  originalRestaurants,
  originalRatings,
}: TextChatWithToolsGraphProps) {
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

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
  });

  // Handle tool results and update parent component
  useEffect(() => {
    console.log('🔍 TextChatWithToolsGraph useEffect triggered - messages length:', messages.length);

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
        const toolResult = lastMessage.parts.find(part =>
          part.type === "tool-result" ||
          (part.type && part.type.startsWith("tool-") && part.type !== "tool-call")
        );
        console.log('🔧 Tool result found:', !!toolResult, 'Tool result type:', toolResult?.type);

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
          const result = ('result' in toolResult ? toolResult.result :
                         'output' in toolResult ? toolResult.output :
                         toolResult) as ToolResult;
          console.log('📊 Tool result structure:', {
            toolResultType: toolResult.type,
            hasResult: 'result' in toolResult,
            hasOutput: 'output' in toolResult,
            resultKeys: Object.keys(result || {}),
            fullToolResult: toolResult
          });
          
          // Add null check for result
          if (result && typeof result === 'object') {
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
            console.log('❌ Result is null or undefined:', {
              result,
              toolResultType: toolResult.type,
              hasResult: 'result' in toolResult,
              hasOutput: 'output' in toolResult
            });
          }
        } else {
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

            const result = ('result' in toolCallPart ? toolCallPart.result :
                           'output' in toolCallPart ? toolCallPart.output :
                           'data' in toolCallPart ? toolCallPart.data :
                           toolCallPart) as ToolResult;

            if (result && typeof result === 'object' && (result.success || result.message)) {
              console.log('✅ Found result in tool call part:', result);
              if (result.success && result.updatedData && onDataUpdate) {
                console.log('🔄 Processing result from tool call part...');
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

  const handleFormSubmit = (
    _message: { text?: string; files?: unknown[] },
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (!input.trim()) {
      return;
    }

    console.log("📤 Sending message:", {
      text: input,
      context: {
        people,
        restaurants,
        ratings,
        strategy,
        groupScores,
        recommendedRestaurantIndices,
      },
    });
      sendMessage({
        text: input,
        metadata: {
          context: {
            people,
            restaurants,
            ratings,
            strategy,
            groupScores,
            recommendedRestaurantIndices,
          },
        },
      });
    setInput("");
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    sendMessage({
      text: suggestion,
      metadata: {
        context: {
          people,
          restaurants,
          ratings,
          strategy,
          groupScores,
          recommendedRestaurantIndices,
        },
      },
    });
    setInput("");
  };

  const handleInputChangeWrapper = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setInput(event.target.value);
  };

  const updateRating = (personIndex: number, restaurantIndex: number, newRating: number) => {
    console.log('🎛️ Graph slider rating update requested:', { 
      personIndex, 
      restaurantIndex, 
      newRating,
      currentRatings: ratings,
      restaurants: restaurants.map(r => r.name),
      hasOnDataUpdate: !!onDataUpdate
    });
    
    // Create updated ratings array
    const updatedRatings = ratings.map((personRatings, pIndex) => {
      if (pIndex === personIndex) {
        const newPersonRatings = [...personRatings];
        newPersonRatings[restaurantIndex] = newRating;
        return newPersonRatings;
      }
      return personRatings;
    });
    
    console.log('🔄 Updated ratings:', updatedRatings);

    // Recalculate group scores with updated ratings
    const newGroupScores = restaurants.map((_, restaurantIdx) => {
      const restaurantRatings = updatedRatings.map(
        (personRatings) => personRatings[restaurantIdx]
      );

      switch (strategy) {
        case "LMS": // Least Misery Strategy
          return Math.min(...restaurantRatings);
        case "ADD": // Additive Strategy
          return restaurantRatings.reduce((sum, rating) => sum + rating, 0);
        case "APP": // Approval Voting Strategy
          return restaurantRatings.filter((rating) => rating > 3).length;
        default:
          return Math.min(...restaurantRatings);
      }
    });

    // Find new recommended restaurants
    const candidates = restaurants
      .map((restaurant, index) => ({
        index,
        visited: restaurant.visited,
        score: newGroupScores[index],
      }))
      .filter((r) => !r.visited);
    
    const newRecommendedRestaurantIndices = candidates.length === 0 
      ? [] 
      : candidates
          .filter((c) => c.score === Math.max(...candidates.map((c) => c.score)))
          .map((c) => c.index);

    // Update parent component with new data
    if (onDataUpdate) {
      console.log('📤 Calling onDataUpdate with:', {
        ratings: updatedRatings,
        groupScores: newGroupScores,
        recommendedRestaurantIndices: newRecommendedRestaurantIndices,
      });
      onDataUpdate({
        ratings: updatedRatings,
        groupScores: newGroupScores,
        recommendedRestaurantIndices: newRecommendedRestaurantIndices,
      });
      console.log('✅ onDataUpdate called successfully');
    } else {
      console.log('❌ No onDataUpdate callback available');
    }
  };

  const resetRatings = () => {
    console.log('🔄 Graph slider reset requested');
    
    // Reset to original scenario ratings if available
    if (originalRatings && onDataUpdate) {
      console.log('🔄 Resetting to original ratings:', originalRatings);
      
      // Recalculate group scores with original ratings
      const resetGroupScores = restaurants.map((_, restaurantIdx) => {
        const restaurantRatings = originalRatings.map(
          (personRatings) => personRatings[restaurantIdx]
        );

        switch (strategy) {
          case "LMS": // Least Misery Strategy
            return Math.min(...restaurantRatings);
          case "ADD": // Additive Strategy
            return restaurantRatings.reduce((sum, rating) => sum + rating, 0);
          case "APP": // Approval Voting Strategy
            return restaurantRatings.filter((rating) => rating > 3).length;
          default:
            return Math.min(...restaurantRatings);
        }
      });

      // Find recommended restaurants with original ratings
      const candidates = restaurants
        .map((restaurant, index) => ({
          index,
          visited: restaurant.visited,
          score: resetGroupScores[index],
        }))
        .filter((r) => !r.visited);
      
      const resetRecommendedRestaurantIndices = candidates.length === 0 
        ? [] 
        : candidates
            .filter((c) => c.score === Math.max(...candidates.map((c) => c.score)))
            .map((c) => c.index);

      // Update parent component with reset data
      onDataUpdate({
        ratings: originalRatings,
        groupScores: resetGroupScores,
        recommendedRestaurantIndices: resetRecommendedRestaurantIndices,
      });
      
      console.log('✅ Ratings reset to original values');
    } else {
      console.log('⚠️ Cannot reset - no original ratings or onDataUpdate callback available');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-800">
          Recommended restaurant:{" "}
          {recommendedRestaurantIndices.length > 0
            ? recommendedRestaurantIndices
                .map((i) => restaurants[i].name)
                .join(", ")
            : "None"}
        </h3>
      </div>

      {/* Bar Chart Visualization */}
      <div className="mb-4 border rounded-lg p-4 bg-white">
        <h4 className="text-md font-medium text-gray-700 mb-2">
          Interactive Rating Chart
          <span className="ml-2 text-sm text-blue-600 font-normal">
            (Click and drag sliders to adjust ratings)
          </span>
        </h4>
        <GraphSliders
          people={people}
          restaurants={restaurants}
          ratings={ratings}
          strategy={strategy}
          recommendedRestaurantIndices={recommendedRestaurantIndices}
          groupScores={groupScores}
          updateRating={updateRating}
          resetRatings={resetRatings}
          fadeNonContributing={true}
        />
      </div>

      {/* Chat Interface */}
      <div className="flex-1 flex flex-col">
        <ChatInterface
          messages={messages}
          status={status}
          input={input}
          onInputChange={handleInputChangeWrapper}
          onSubmit={handleFormSubmit}
          suggestions={suggestions}
          onSuggestionClick={handleSuggestionClick}
          conversationClassName="h-96 border rounded-lg"
        />
      </div>
    </div>
  );
}
