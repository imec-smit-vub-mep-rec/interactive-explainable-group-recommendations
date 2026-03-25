"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import NoExplanation from "./explanation-styles/NoExplanation";
import TextExplanation from "./explanation-styles/TextExplanation";
import StaticBarChartExplanation from "./explanation-styles/StaticBarChart";
import PieExplanation from "./explanation-styles/PieExplanation";
import Heatmap from "./explanation-styles/Heatmap";
import OrderedListExplanation from "./explanation-styles/OrderedListExplanation";
import TextChat, { type ChatLogEntry } from "./explanation-styles/Conversational";
import { Scenario } from "@/lib/scenario_helpers";
import { ExplanationStrategy } from "@/lib/types";

type AggregationStrategy = "LMS" | "ADD" | "APP";

interface InteractiveGroupRecommenderProps {
  strategy: AggregationStrategy;
  explanationStrategy: ExplanationStrategy;
  sortBestToWorst: boolean;
  fadeNonContributing: boolean;
  scenario: Scenario;
  hideExplanation?: boolean;
  onResetRatingsRef?: React.MutableRefObject<(() => void) | null>;
  onTableRatingChange?: (event: {
    personIndex: number;
    restaurantIndex: number;
    value: number;
  }) => void;
  onGraphRatingChange?: (event: {
    personIndex: number;
    restaurantIndex: number;
    value: number;
  }) => void;
  onSuggestionClick?: (suggestion: string) => void;
  onTypedQuerySubmit?: (query: string) => void;
  onChatLogEntry?: (entry: ChatLogEntry) => void;
  onChatBusyChange?: (busy: boolean) => void;
}

export default function InteractiveGroupRecommender({
  strategy,
  explanationStrategy,
  sortBestToWorst,
  fadeNonContributing,
  scenario,
  hideExplanation = false,
  onResetRatingsRef,
  onTableRatingChange,
  onGraphRatingChange,
  onSuggestionClick,
  onTypedQuerySubmit,
  onChatLogEntry,
  onChatBusyChange,
}: InteractiveGroupRecommenderProps) {
  const [ratings, setRatings] = useState<number[][]>(scenario.ratings);
  const people = scenario.people;

  useEffect(() => {
    setRatings(scenario.ratings);
  }, [scenario]);

  const groupScores = useMemo(() => {
    const scores = scenario.restaurants.map((_, restaurantIndex) => {
      const restaurantRatings = ratings.map(
        (personRatings) => personRatings[restaurantIndex]
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
    return scores;
  }, [ratings, strategy, scenario.restaurants]);

  const {
    sortedRestaurants,
    sortedRatings,
    sortedGroupScores,
    originalToSortedIndexMap,
    sortedToOriginalIndexMap,
  } = useMemo(() => {
    if (!sortBestToWorst) {
      const identityMap = scenario.restaurants.map((_, index) => index);
      return {
        sortedRestaurants: scenario.restaurants,
        sortedRatings: ratings,
        sortedGroupScores: groupScores,
        originalToSortedIndexMap: identityMap,
        sortedToOriginalIndexMap: identityMap,
      };
    }

    const restaurantScores = scenario.restaurants.map((restaurant, index) => ({
      originalIndex: index,
      restaurant,
      score: groupScores[index],
    }));

    const sortedRestaurantScores = restaurantScores.sort(
      (a, b) => b.score - a.score
    );

    const sortedRestaurants = sortedRestaurantScores.map(
      (item) => item.restaurant
    );
    const sortedGroupScores = sortedRestaurantScores.map((item) => item.score);

    const originalToSortedIndexMap = new Array(scenario.restaurants.length);
    const sortedToOriginalIndexMap = new Array(scenario.restaurants.length);
    sortedRestaurantScores.forEach((item, sortedIndex) => {
      originalToSortedIndexMap[item.originalIndex] = sortedIndex;
      sortedToOriginalIndexMap[sortedIndex] = item.originalIndex;
    });

    const sortedRatings = ratings.map((personRatings) =>
      sortedRestaurantScores.map((item) => personRatings[item.originalIndex])
    );

    return {
      sortedRestaurants,
      sortedRatings,
      sortedGroupScores,
      originalToSortedIndexMap,
      sortedToOriginalIndexMap,
    };
  }, [scenario.restaurants, ratings, groupScores, sortBestToWorst]);

  const recommendedRestaurantIndices = useMemo(() => {
    const candidates = sortedRestaurants
      .map((restaurant, index) => ({
        index,
        visited: restaurant.visited,
        score: sortedGroupScores[index],
      }))
      .filter((r) => !r.visited);

    if (candidates.length === 0) return [] as number[];

    const bestScore = Math.max(...candidates.map((c) => c.score));
    return candidates
      .filter((c) => c.score === bestScore)
      .map((c) => c.index);
  }, [sortedRestaurants, sortedGroupScores]);

  const updateRating = (
    personIndex: number,
    restaurantIndex: number,
    value: number
  ) => {
    setRatings((prev) => {
      const newRatings = [...prev];
      newRatings[personIndex] = [...newRatings[personIndex]];
      newRatings[personIndex][restaurantIndex] = value;
      return newRatings;
    });
  };

  const updateRatingForGraph = useMemo(() => {
    if (!sortBestToWorst) {
      return updateRating;
    }
    return (personIndex: number, sortedRestaurantIndex: number, value: number) => {
      const originalRestaurantIndex = sortedToOriginalIndexMap[sortedRestaurantIndex];
      updateRating(personIndex, originalRestaurantIndex, value);
    };
  }, [sortBestToWorst, sortedToOriginalIndexMap]);

  const graphRecommendedRestaurantIndices = useMemo(() => {
    if (!sortBestToWorst) {
      return recommendedRestaurantIndices;
    }
    return recommendedRestaurantIndices.map(
      (sortedIndex) => sortedToOriginalIndexMap[sortedIndex]
    );
  }, [recommendedRestaurantIndices, sortBestToWorst, sortedToOriginalIndexMap]);

  const resetRatings = useCallback(() => {
    setRatings(scenario.ratings);
  }, [scenario]);

  useEffect(() => {
    if (onResetRatingsRef) {
      onResetRatingsRef.current = resetRatings;
    }
    return () => {
      if (onResetRatingsRef) {
        onResetRatingsRef.current = null;
      }
    };
  }, [onResetRatingsRef, resetRatings]);

  const recommendedRestaurantNames = recommendedRestaurantIndices.map(
    (i) => sortedRestaurants[i].name
  );

  const isTableDisabled =
    explanationStrategy === "no_expl" ||
    explanationStrategy === "static_list" ||
    explanationStrategy === "conversational";

  const renderExplanation = () => {
    switch (explanationStrategy) {
      case "no_expl":
        return (
          <NoExplanation
            recommendedRestaurantNames={recommendedRestaurantNames}
          />
        );
      case "static_list":
        return (
          <OrderedListExplanation
            people={people}
            restaurants={sortedRestaurants}
            ratings={sortedRatings}
            strategy={strategy}
            recommendedRestaurantIndices={recommendedRestaurantIndices}
            groupScores={sortedGroupScores}
          />
        );
      case "interactive_list":
        return (
          <OrderedListExplanation
            people={people}
            restaurants={sortedRestaurants}
            ratings={sortedRatings}
            strategy={strategy}
            recommendedRestaurantIndices={recommendedRestaurantIndices}
            groupScores={sortedGroupScores}
          />
        );
      case "conversational":
      case "chat_expl_basic":
        return (
          <TextChat
            people={people}
            restaurants={sortedRestaurants}
            ratings={sortedRatings}
            strategy={strategy}
            groupScores={sortedGroupScores}
            recommendedRestaurantIndices={recommendedRestaurantIndices}
            originalRestaurants={scenario.restaurants}
            onSuggestionClick={onSuggestionClick}
            onQuerySubmit={onTypedQuerySubmit}
            onChatLogEntry={onChatLogEntry}
            onChatBusyChange={onChatBusyChange}
          />
        );
      case "text_expl":
        return (
          <TextExplanation
            recommendedRestaurantNames={recommendedRestaurantNames}
            strategy={strategy}
            people={people}
            restaurants={sortedRestaurants}
            ratings={sortedRatings}
            groupScores={sortedGroupScores}
            recommendedRestaurantIndices={recommendedRestaurantIndices}
          />
        );
      case "interactive_bar_chart":
      case "graph_expl":
        return (
          <StaticBarChartExplanation
            people={people}
            restaurants={scenario.restaurants}
            ratings={ratings}
            strategy={strategy}
            recommendedRestaurantIndices={graphRecommendedRestaurantIndices}
            groupScores={groupScores}
            updateRating={updateRating}
            resetRatings={resetRatings}
            fadeNonContributing={fadeNonContributing}
            onRatingChange={onGraphRatingChange}
          />
        );
      case "pie_expl":
        return (
          <PieExplanation
            people={people}
            restaurants={sortedRestaurants}
            ratings={sortedRatings}
            strategy={strategy}
            recommendedRestaurantIndices={recommendedRestaurantIndices}
            groupScores={sortedGroupScores}
            updateRating={updateRatingForGraph}
            resetRatings={resetRatings}
          />
        );
      case "heatmap_expl":
        return (
          <Heatmap
            people={people}
            restaurants={sortedRestaurants}
            ratings={sortedRatings}
            strategy={strategy}
            recommendedRestaurantIndices={recommendedRestaurantIndices}
            groupScores={sortedGroupScores}
            updateRating={updateRatingForGraph}
            resetRatings={resetRatings}
          />
        );
      case "ordered_list_expl":
        return (
          <OrderedListExplanation
            people={people}
            restaurants={sortedRestaurants}
            ratings={sortedRatings}
            strategy={strategy}
            recommendedRestaurantIndices={recommendedRestaurantIndices}
            groupScores={sortedGroupScores}
          />
        );
      default:
        return (
          <NoExplanation
            recommendedRestaurantNames={recommendedRestaurantNames}
          />
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto  bg-white rounded-lg ">

      {/* Ratings Table */}
      <div className="mb-4">
        <div className="overflow-x-auto overflow-y-visible">
          <table
            className="min-w-full border-collapse border border-gray-300"
            data-onboarding={
              isTableDisabled ? "ratings-table" : "interactive-table"
            }
          >
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-300 px-2 py-1.5 text-left text-base">
                  Person
                </th>
                {scenario.restaurants.map((restaurant, index) => (
                  <th
                    key={restaurant.id}
                    className={`border border-gray-300 px-1.5 py-1.5 text-center text-sm ${restaurant.visited ? "bg-gray-300 text-gray-500" : ""
                      }`}
                    {...(restaurant.visited &&
                      scenario.restaurants.findIndex((r) => r.visited) ===
                      index && {
                      "data-onboarding": "grey-rows",
                    })}
                  >
                    {restaurant.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((person, personIndex) => {
                const usePersonTint = explanationStrategy === "interactive_bar_chart";
                const rowClassName = usePersonTint
                  ? ""
                  : personIndex % 2 === 0
                    ? "bg-white"
                    : "bg-gray-50";
                return (
                  <tr
                    key={person.name}
                    className={rowClassName}
                    style={
                      usePersonTint ? { backgroundColor: `${person.color}20` } : undefined
                    }
                  >
                    <td className="border border-gray-300 px-2 py-1.5 font-medium text-base">
                      {person.name}
                    </td>
                    {scenario.restaurants.map((restaurant, restaurantIndex) => {
                      const isFirstVisited =
                        restaurant.visited &&
                        scenario.restaurants.findIndex((r) => r.visited) ===
                        restaurantIndex;
                      return (
                        <td
                          key={restaurant.id}
                          className={`border border-gray-300 px-1.5 py-1.5 text-center ${restaurant.visited ? "bg-gray-200" : ""
                            }`}
                          {...(isFirstVisited && {
                            "data-onboarding": "grey-rows",
                          })}
                        >
                          {isTableDisabled ? (
                            <span
                              className={`text-center ${restaurant.visited
                                  ? "text-gray-500"
                                  : "text-gray-900 font-medium"
                                }`}
                            >
                              {ratings[personIndex][restaurantIndex]}
                            </span>
                          ) : (
                            <input
                              type="number"
                              min="1"
                              max="5"
                              value={ratings[personIndex][restaurantIndex]}
                              onChange={(e) => {
                                if (!restaurant.visited) {
                                  const value = parseInt(e.target.value);
                                  if (value >= 1 && value <= 5) {
                                    updateRating(
                                      personIndex,
                                      restaurantIndex,
                                      value
                                    );
                                    onTableRatingChange?.({
                                      personIndex,
                                      restaurantIndex,
                                      value,
                                    });
                                  }
                                }
                              }}
                              disabled={restaurant.visited}
                              className={`w-10 h-7 text-base text-center border border-gray-300 rounded ${restaurant.visited
                                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                  : "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                }`}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Explanations */}
      {!hideExplanation && (
        <div className="mb-4 space-y-2 max-h-[calc(100vh-24rem)] overflow-y-auto">
          {renderExplanation()}
        </div>
      )}


    </div>
  );
}
