"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ChatInterface } from "@/components/chat/ChatInterface";
import InteractiveBarChart from "./InteractiveBarChart";
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

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
  });
  const userMessageCount = messages.filter((message) => message.role === "user").length;
  const isConversationClosed = userMessageCount >= MAX_USER_MESSAGES;

  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];

      if (lastMessage.role === "assistant" && lastMessage.parts) {
        const toolResult = lastMessage.parts.find(part =>
          part.type === "tool-result" ||
          (part.type && part.type.startsWith("tool-") && part.type !== "tool-call")
        );

        if (toolResult && ('result' in toolResult || 'output' in toolResult)) {
          const result = ('result' in toolResult ? toolResult.result :
                         'output' in toolResult ? toolResult.output :
                         toolResult) as ToolResult;

          if (result && typeof result === 'object') {
            if (result.success && result.updatedData && onDataUpdate) {
              const restaurantList = originalRestaurants || restaurants;
              const updatedRecommendedIndices = (result.updatedData.newRecommendedRestaurantIndices || [])
                .map((name: string) => restaurantList.findIndex(r => r.name === name))
                .filter((index: number) => index !== -1);

              if (!result.updatedData.newRatings || !result.updatedData.newGroupScores) {
                return;
              }

              onDataUpdate({
                ratings: result.updatedData.newRatings,
                groupScores: result.updatedData.newGroupScores,
                recommendedRestaurantIndices: updatedRecommendedIndices,
              });
              setLastToolResult(result);
            }
          }
        } else {
          const toolCallPart = lastMessage.parts?.find(part =>
            part.type && part.type.startsWith("tool-") && part.type !== "tool-result"
          );

          if (toolCallPart) {
            const result = ('result' in toolCallPart ? toolCallPart.result :
                           'output' in toolCallPart ? toolCallPart.output :
                           'data' in toolCallPart ? toolCallPart.data :
                           toolCallPart) as ToolResult;

            if (result && typeof result === 'object' && result.success && result.updatedData && onDataUpdate) {
              const restaurantList = originalRestaurants || restaurants;
              const updatedRecommendedIndices = (result.updatedData.newRecommendedRestaurantIndices || [])
                .map((name: string) => restaurantList.findIndex(r => r.name === name))
                .filter((index: number) => index !== -1);

              if (result.updatedData.newRatings && result.updatedData.newGroupScores) {
                onDataUpdate({
                  ratings: result.updatedData.newRatings,
                  groupScores: result.updatedData.newGroupScores,
                  recommendedRestaurantIndices: updatedRecommendedIndices,
                });
                setLastToolResult(result);
              }
            }
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
    if (isConversationClosed) {
      return;
    }

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
    if (isConversationClosed) {
      return;
    }
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

  const excludedSuggestionRestaurants = [
    ...restaurants.filter((restaurant) => restaurant.visited).map((r) => r.name),
    ...recommendedRestaurantIndices.map((index) => restaurants[index]?.name),
  ].filter((name): name is string => Boolean(name));

  const updateRating = (personIndex: number, restaurantIndex: number, newRating: number) => {
    const updatedRatings = ratings.map((personRatings, pIndex) => {
      if (pIndex === personIndex) {
        const newPersonRatings = [...personRatings];
        newPersonRatings[restaurantIndex] = newRating;
        return newPersonRatings;
      }
      return personRatings;
    });

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

    if (onDataUpdate) {
      onDataUpdate({
        ratings: updatedRatings,
        groupScores: newGroupScores,
        recommendedRestaurantIndices: newRecommendedRestaurantIndices,
      });
    }
  };

  const resetRatings = () => {
    if (originalRatings && onDataUpdate) {
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

      onDataUpdate({
        ratings: originalRatings,
        groupScores: resetGroupScores,
        recommendedRestaurantIndices: resetRecommendedRestaurantIndices,
      });
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
        <InteractiveBarChart
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
          excludedSuggestionRestaurants={excludedSuggestionRestaurants}
          conversationClassName="h-96 border rounded-lg"
          isConversationClosed={isConversationClosed}
          conversationClosedMessage={CONVERSATION_CLOSED_MESSAGE}
        />
      </div>
    </div>
  );
}
