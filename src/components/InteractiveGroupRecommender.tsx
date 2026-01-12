"use client";

import React, { useState, useMemo, useEffect } from "react";
import NoExplanation from "./NoExplanation";
import TextExplanation from "./TextExplanation";
import GraphExplanation from "./GraphExplanation";
import PieExplanation from "./PieExplanation";
import Heatmap from "./Heatmap";
import OrderedListExplanation from "./OrderedListExplanation";
import TextChat from "./TextChat";
import TextChatWithTools from "./TextChatWithTools";
import TextChatWithToolsGraph from "./TextChatWithToolsGraph";
import { Scenario, people, getVisitedOrder } from "@/lib/scenario_helpers";
import { ExplanationStrategy } from "@/lib/types";

// Remove duplicate interfaces since they're now imported from scenarios.ts

type AggregationStrategy = "LMS" | "ADD" | "APP";

// Remove hardcoded data since it's now provided by scenarios

interface InteractiveGroupRecommenderProps {
  strategy: AggregationStrategy;
  explanationStrategy: ExplanationStrategy;
  sortBestToWorst: boolean;
  fadeNonContributing: boolean;
  scenario: Scenario;
}

export default function InteractiveGroupRecommender({
  strategy,
  explanationStrategy,
  sortBestToWorst,
  fadeNonContributing,
  scenario,
}: InteractiveGroupRecommenderProps) {
  const [ratings, setRatings] = useState<number[][]>(scenario.ratings);

  // Update ratings when scenario changes
  useEffect(() => {
    setRatings(scenario.ratings);
  }, [scenario]);

  // Calculate group scores based on selected strategy
  const groupScores = useMemo(() => {
    console.log("🧮 Recalculating groupScores with ratings:", ratings);
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
    console.log("📊 New groupScores calculated:", scores);
    return scores;
  }, [ratings, strategy, scenario.restaurants]);

  // Create sorted restaurants array and corresponding data when sorting is enabled
  const {
    sortedRestaurants,
    sortedRatings,
    sortedGroupScores,
    originalToSortedIndexMap,
  } = useMemo(() => {
    if (!sortBestToWorst) {
      return {
        sortedRestaurants: scenario.restaurants,
        sortedRatings: ratings,
        sortedGroupScores: groupScores,
        originalToSortedIndexMap: scenario.restaurants.map((_, index) => index),
      };
    }

    // Create array of restaurant indices with their scores for sorting
    const restaurantScores = scenario.restaurants.map((restaurant, index) => ({
      originalIndex: index,
      restaurant,
      score: groupScores[index],
    }));

    // Sort by score (best to worst) - for LMS, higher is better; for ADD/APP, higher is also better
    const sortedRestaurantScores = restaurantScores.sort(
      (a, b) => b.score - a.score
    );

    // Create sorted arrays
    const sortedRestaurants = sortedRestaurantScores.map(
      (item) => item.restaurant
    );
    const sortedGroupScores = sortedRestaurantScores.map((item) => item.score);

    // Create mapping from original index to sorted index
    const originalToSortedIndexMap = new Array(scenario.restaurants.length);
    sortedRestaurantScores.forEach((item, sortedIndex) => {
      originalToSortedIndexMap[item.originalIndex] = sortedIndex;
    });

    // Reorder ratings array to match sorted restaurants
    const sortedRatings = ratings.map((personRatings) =>
      sortedRestaurantScores.map((item) => personRatings[item.originalIndex])
    );

    return {
      sortedRestaurants,
      sortedRatings,
      sortedGroupScores,
      originalToSortedIndexMap,
    };
  }, [scenario.restaurants, ratings, groupScores, sortBestToWorst]);

  // Find all top-scoring non-visited restaurants (handle ties) - use sorted data
  const recommendedRestaurantIndices = useMemo(() => {
    console.log("🎯 Recalculating recommendedRestaurantIndices with:", {
      sortedRestaurantsCount: sortedRestaurants.length,
      sortedGroupScores: sortedGroupScores,
    });

    const candidates = sortedRestaurants
      .map((restaurant, index) => ({
        index,
        visited: restaurant.visited,
        score: sortedGroupScores[index],
      }))
      .filter((r) => !r.visited);

    console.log("🏆 Candidates (non-visited):", candidates);

    if (candidates.length === 0) {
      console.log("❌ No non-visited candidates, returning empty array");
      return [] as number[];
    }

    const bestScore = Math.max(...candidates.map((c) => c.score));
    const recommended = candidates
      .filter((c) => c.score === bestScore)
      .map((c) => c.index);

    console.log(
      "🏅 Best score:",
      bestScore,
      "Recommended indices:",
      recommended
    );
    return recommended;
  }, [sortedRestaurants, sortedGroupScores]);

  const updateRating = (
    personIndex: number,
    restaurantIndex: number,
    value: number
  ) => {
    setRatings((prev) => {
      const newRatings = [...prev];
      newRatings[personIndex] = [...newRatings[personIndex]];

      // Table always uses original order, so restaurantIndex is already the original index
      newRatings[personIndex][restaurantIndex] = value;
      return newRatings;
    });
  };

  const resetRatings = () => {
    setRatings(scenario.ratings);
  };

  const recommendedRestaurantNames = recommendedRestaurantIndices.map(
    (i) => sortedRestaurants[i].name
  );

  // Determine if table inputs should be disabled
  const isTableDisabled =
    explanationStrategy === "no_expl" || explanationStrategy === "static_list";

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
            // Don't pass onDataUpdate for basic chat - tools won't be able to update data
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
      case "chat_expl_with_tools":
        return (
          <TextChatWithTools
            people={people}
            restaurants={sortedRestaurants}
            ratings={sortedRatings}
            strategy={strategy}
            groupScores={sortedGroupScores}
            recommendedRestaurantIndices={recommendedRestaurantIndices}
            originalRestaurants={scenario.restaurants}
            onDataUpdate={(updatedData) => {
              console.log(
                "🔄 InteractiveGroupRecommender onDataUpdate called with:",
                {
                  ratingsShape: `${updatedData.ratings.length}x${updatedData.ratings[0]?.length}`,
                  groupScoresLength: updatedData.groupScores.length,
                  recommendedIndices: updatedData.recommendedRestaurantIndices,
                  currentRatingsShape: `${ratings.length}x${ratings[0]?.length}`,
                  currentGroupScoresLength: groupScores.length,
                  currentRecommendedIndices: recommendedRestaurantIndices,
                }
              );

              // Update the local state with the new data from the LLM
              console.log("📝 Setting new ratings...");
              setRatings(updatedData.ratings);

              console.log(
                "✅ Ratings updated, useMemo hooks will recalculate groupScores and recommendedRestaurantIndices"
              );
              // Note: groupScores and recommendedRestaurantIndices will be recalculated
              // by the useMemo hooks based on the updated ratings
            }}
          />
        );
      case "chat_expl_with_tools_graph":
        return (
          <TextChatWithToolsGraph
            people={people}
            restaurants={sortedRestaurants}
            ratings={sortedRatings}
            strategy={strategy}
            groupScores={sortedGroupScores}
            recommendedRestaurantIndices={recommendedRestaurantIndices}
            originalRestaurants={scenario.restaurants}
            originalRatings={scenario.ratings}
            onDataUpdate={(updatedData) => {
              console.log(
                "🔄 InteractiveGroupRecommender onDataUpdate called with:",
                {
                  ratingsShape: `${updatedData.ratings.length}x${updatedData.ratings[0]?.length}`,
                  groupScoresLength: updatedData.groupScores.length,
                  recommendedIndices: updatedData.recommendedRestaurantIndices,
                  currentRatingsShape: `${ratings.length}x${ratings[0]?.length}`,
                  currentGroupScoresLength: groupScores.length,
                  currentRecommendedIndices: recommendedRestaurantIndices,
                  sortBestToWorst,
                }
              );

              // If sorting is enabled, we need to map the sorted data back to original order
              if (sortBestToWorst) {
                console.log("🔄 Mapping sorted data back to original order...");

                // Map sorted ratings back to original order
                const originalRatings = scenario.restaurants.map(
                  (_, originalIndex) => {
                    const sortedIndex = originalToSortedIndexMap[originalIndex];
                    return updatedData.ratings.map(
                      (personRatings) => personRatings[sortedIndex]
                    );
                  }
                );

                // Map sorted group scores back to original order
                const originalGroupScores = scenario.restaurants.map(
                  (_, originalIndex) => {
                    const sortedIndex = originalToSortedIndexMap[originalIndex];
                    return updatedData.groupScores[sortedIndex];
                  }
                );

                // Map recommended indices back to original order
                const originalRecommendedIndices =
                  updatedData.recommendedRestaurantIndices
                    .map((sortedIndex) => {
                      return originalToSortedIndexMap.indexOf(sortedIndex);
                    })
                    .filter((index) => index !== -1);

                console.log("📝 Setting original ratings from sorted data...");
                setRatings(originalRatings);

                console.log(
                  "✅ Original ratings updated, useMemo hooks will recalculate"
                );
              } else {
                // No sorting, data is already in original order
                console.log("📝 Setting new ratings (no sorting)...");
                setRatings(updatedData.ratings);

                console.log(
                  "✅ Ratings updated, useMemo hooks will recalculate"
                );
              }
            }}
          />
        );
      case "graph_expl":
        return (
          <GraphExplanation
            people={people}
            restaurants={sortedRestaurants}
            ratings={sortedRatings}
            strategy={strategy}
            recommendedRestaurantIndices={recommendedRestaurantIndices}
            groupScores={sortedGroupScores}
            updateRating={updateRating}
            resetRatings={resetRatings}
            fadeNonContributing={fadeNonContributing}
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
            updateRating={updateRating}
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
            updateRating={updateRating}
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
    <div className="max-w-7xl mx-auto p-4 bg-white rounded-lg shadow-lg">
      <div className="mb-4" data-onboarding="page-header">
        <p className="text-gray-600 mb-1 text-sm">{scenario.description}</p>
        <p
          className="text-gray-600 mb-2 text-sm"
          data-onboarding="history-section"
        >
          Previous visits: The group has previously visited the following
          restaurants in this order: {getVisitedOrder(scenario).join(", ")}.
        </p>
      </div>

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
                <th className="border border-gray-300 px-2 py-1.5 text-left text-sm">
                  Person
                </th>
                {scenario.restaurants.map((restaurant, index) => (
                  <th
                    key={restaurant.id}
                    className={`border border-gray-300 px-1.5 py-1.5 text-center text-xs ${
                      restaurant.visited ? "bg-gray-300 text-gray-500" : ""
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
              {people.map((person, personIndex) => (
                <tr
                  key={person.name}
                  style={{ backgroundColor: `${person.color}20` }}
                >
                  <td className="border border-gray-300 px-2 py-1.5 font-medium text-sm">
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
                        className={`border border-gray-300 px-1.5 py-1.5 text-center ${
                          restaurant.visited ? "bg-gray-200" : ""
                        }`}
                        {...(isFirstVisited && {
                          "data-onboarding": "grey-rows",
                        })}
                      >
                        {isTableDisabled ? (
                          <span
                            className={`text-center ${
                              restaurant.visited
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
                                }
                              }
                            }}
                            disabled={restaurant.visited}
                            className={`w-10 h-7 text-sm text-center border border-gray-300 rounded ${
                              restaurant.visited
                                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                : "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            }`}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Explanations */}
      <div className="mb-4 space-y-2 max-h-[calc(100vh-24rem)] overflow-y-auto">
        {renderExplanation()}
      </div>

      {/* Reset Button - Only show for interactive explanation methods */}
      {(explanationStrategy === "graph_expl" ||
        explanationStrategy === "pie_expl" ||
        explanationStrategy === "heatmap_expl" ||
        explanationStrategy === "chat_expl_with_tools" ||
        explanationStrategy === "chat_expl_with_tools_graph") && (
        <div className="flex justify-center" data-onboarding="footer-actions">
          <button
            onClick={resetRatings}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Reset to Initial Values
          </button>
        </div>
      )}
    </div>
  );
}
