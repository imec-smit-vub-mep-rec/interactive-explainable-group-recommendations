/**
 * List view is common according to table 8 from https://dl.acm.org/doi/10.1145/3555161
 */

"use client";

import React from "react";

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
    <div className="space-y-4">
      <div className="p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-4 text-lg">Ordered List Explanation</h3>
        <p className="text-gray-700 mb-4">
          Restaurants ranked by group score (best to worst):
        </p>

        <div className="space-y-3">
          {restaurantsWithRankings.map((restaurant, rankIndex) => (
            <div
              key={restaurant.id}
              className={`p-4 rounded-lg border-2 transition-all ${
                restaurant.visited
                  ? "bg-gray-200 border-gray-300 opacity-60"
                  : restaurant.isRecommended
                  ? "bg-green-50 border-green-300 shadow-md"
                  : "bg-white border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      restaurant.visited
                        ? "bg-gray-400 text-white"
                        : restaurant.isRecommended
                        ? "bg-green-500 text-white"
                        : "bg-blue-500 text-white"
                    }`}
                  >
                    {restaurant.rank}
                  </div>

                  <div>
                    <h4
                      className={`font-semibold ${
                        restaurant.visited ? "text-gray-500" : "text-gray-900"
                      }`}
                    >
                      {restaurant.name}
                    </h4>
  
                  </div>

                  <div>
                  <p
                      className={`text-sm ${
                        restaurant.visited ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      Score: {restaurant.score}
                    </p>
                    </div>

                  <div className="ml-4">
                    {restaurant.visited ? (
                      <p className="text-sm text-gray-500 italic">
                        Restaurant is already visited
                      </p>
                    ) : (
                      <p className="text-sm text-gray-700">
                        {getStrategyExplanation(restaurant)}
                      </p>
                    )}
                  </div>
                </div>

                {restaurant.isRecommended && !restaurant.visited && (
                  <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                    Recommended
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
