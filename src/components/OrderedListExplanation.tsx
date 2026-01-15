/**
 * List view is common according to table 8 from https://dl.acm.org/doi/10.1145/3555161
 */

"use client";

import React from "react";
import { CheckCircle2, Star } from "lucide-react";

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

interface OrderedListExplanationProps {
  people: Person[];
  restaurants: Restaurant[];
  ratings: number[][];
  strategy: "LMS" | "ADD" | "APP";
  groupScores: number[];
  recommendedRestaurantIndices: number[];
}

export default function OrderedListExplanation({
  people,
  restaurants,
  ratings,
  strategy,
  groupScores,
  recommendedRestaurantIndices,
}: OrderedListExplanationProps) {
  // Create ranked list of restaurants with their scores and explanations
  const rankedRestaurants = restaurants
    .map((restaurant, index) => ({
      ...restaurant,
      score: groupScores[index],
      originalIndex: index,
      isRecommended: recommendedRestaurantIndices.includes(index),
    }))
    .sort((a, b) => b.score - a.score); // Sort by score descending (best to worst)

  // Calculate proper rankings with ties
  const restaurantsWithRankings = rankedRestaurants.map((restaurant, index) => {
    let rank = index + 1;

    // If this restaurant has the same score as the previous one, use the same rank
    if (index > 0 && restaurant.score === rankedRestaurants[index - 1].score) {
      // Find the first restaurant with this score to get its rank
      const firstIndexWithSameScore = rankedRestaurants.findIndex(
        (r) => r.score === restaurant.score
      );
      rank = firstIndexWithSameScore + 1;
    }

    return {
      ...restaurant,
      rank,
    };
  });

  const getStrategyExplanation = (
    restaurant: (typeof rankedRestaurants)[0]
  ) => {
    const restaurantRatings = ratings.map(
      (personRatings) => personRatings[restaurant.originalIndex]
    );

    switch (strategy) {
      case "LMS": {
        const minRating = Math.min(...restaurantRatings);
        const usersWithLowerRating = restaurantRatings.filter(
          (rating) => rating === minRating
        ).length;
        return `The lowest rating is ${minRating}.`;
      }
      case "ADD": {
        const totalRating = restaurantRatings.reduce(
          (sum, rating) => sum + rating,
          0
        );
        return `The total rating is ${totalRating}.`;
      }
      case "APP": {
        const approvalVotes = restaurantRatings.filter(
          (rating) => rating >= 4
        ).length;
        return `${approvalVotes} users gave a score of 4 or more.`;
      }
      default:
        return "";
    }
  };

  return (
    <div className="space-y-2">
      <div className="p-3 bg-gray-50 rounded-lg" data-onboarding="ranked-list">
        <p className="text-gray-700 mb-2 text-sm">
          Restaurants ranked by group score (best to worst):
        </p>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700 mb-2">
          <span className="inline-flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-green-700" aria-hidden="true" />
            <span>Recommended</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <CheckCircle2
              className="w-3.5 h-3.5 text-gray-600"
              aria-hidden="true"
            />
            <span>Already visited</span>
          </span>
        </div>

        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
          {restaurantsWithRankings.map((restaurant, rankIndex) => (
            <div
              key={restaurant.id}
              className={`p-2 rounded-lg border-2 transition-all ${
                restaurant.visited
                  ? "bg-gray-200 border-gray-300 opacity-60"
                  : restaurant.isRecommended
                  ? "bg-green-50 border-green-300 shadow-md"
                  : "bg-white border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                      restaurant.visited
                        ? "bg-gray-400 text-white"
                        : restaurant.isRecommended
                        ? "bg-green-500 text-white"
                        : "bg-blue-500 text-white"
                    }`}
                  >
                    {restaurant.rank}
                  </div>

                  <div className="min-w-0 flex-shrink-0">
                    <h4
                      className={`font-semibold text-sm ${
                        restaurant.visited ? "text-gray-500" : "text-gray-900"
                      }`}
                    >
                      {restaurant.name}
                    </h4>
                  </div>

                  <div className="flex-shrink-0">
                    <p
                      className={`text-xs ${
                        restaurant.visited ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      Score: {restaurant.score}
                    </p>
                  </div>

                  <div className="ml-2 min-w-0 flex-1">
                    {restaurant.visited ? (
                      <p className="text-xs text-gray-500 inline-flex items-center gap-1">
                        <CheckCircle2
                          className="w-3.5 h-3.5 text-gray-500"
                          aria-hidden="true"
                        />
                        <span>Already visited</span>
                      </p>
                    ) : (
                      <p
                        className="text-xs text-gray-700"
                        {...(rankIndex === 0 && {
                          "data-onboarding": "strategy-label",
                        })}
                      >
                        {getStrategyExplanation(restaurant)}
                      </p>
                    )}
                  </div>
                </div>

                {restaurant.isRecommended && !restaurant.visited && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full flex-shrink-0 inline-flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-green-800" aria-hidden="true" />
                    <span>Recommended</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
