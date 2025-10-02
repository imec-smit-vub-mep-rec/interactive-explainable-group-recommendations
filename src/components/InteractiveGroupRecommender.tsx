"use client";

import React, { useState, useMemo } from "react";
import NoExplanation from "./NoExplanation";
import TextExplanation from "./TextExplanation";
import GraphExplanation from "./GraphExplanation";
import PieExplanation from "./PieExplanation";
import Heatmap from "./Heatmap";
import OrderedListExplanation from "./OrderedListExplanation";
import TextChat from "./TextChat";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { ChevronDownIcon, ChevronUpIcon, SettingsIcon } from "lucide-react";

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
type ExplanationStrategy =
  | "no_expl"
  | "text_expl"
  | "chat_expl"
  | "graph_expl"
  | "pie_expl"
  | "heatmap_expl"
  | "ordered_list_expl";

const people: Person[] = [
  { name: "Darcy", pattern: "solid", color: "#6B7280" },
  { name: "Alex", pattern: "dotted", color: "#3B82F6" },
  { name: "Jess", pattern: "horizontal", color: "#10B981" },
  { name: "Jackie", pattern: "vertical", color: "#F59E0B" },
  { name: "Freddy", pattern: "diagonal", color: "#EF4444" },
];

const restaurants: Restaurant[] = [
  { id: 1, name: "Rest 1", visited: false },
  { id: 2, name: "Rest 2", visited: false },
  { id: 3, name: "Rest 3", visited: false },
  { id: 4, name: "Rest 4", visited: false },
  { id: 5, name: "Rest 5", visited: true },
  { id: 6, name: "Rest 6", visited: false },
  { id: 7, name: "Rest 7", visited: true },
  { id: 8, name: "Rest 8", visited: false },
  { id: 9, name: "Rest 9", visited: true },
  { id: 10, name: "Rest 10", visited: false },
];

// Initial ratings data
const initialRatings: number[][] = [
  [5, 1, 1, 4, 3, 2, 4, 2, 5, 1], // Darcy
  [5, 3, 1, 2, 5, 1, 4, 4, 3, 2], // Alex
  [4, 2, 1, 5, 5, 1, 5, 2, 4, 4], // Jess
  [5, 1, 2, 2, 3, 1, 5, 1, 3, 5], // Jackie
  [1, 5, 5, 4, 3, 4, 4, 5, 4, 1], // Freddy
];

export default function InteractiveGroupRecommender() {
  const [ratings, setRatings] = useState<number[][]>(initialRatings);
  const [strategy, setStrategy] = useState<AggregationStrategy>("LMS");
  const [explanationStrategy, setExplanationStrategy] =
    useState<ExplanationStrategy>("no_expl");
  const [sortBestToWorst, setSortBestToWorst] = useState<boolean>(false);
  const [fadeNonContributing, setFadeNonContributing] =
    useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Helper functions to get strategy labels
  const getAggregationStrategyLabel = (strategy: AggregationStrategy) => {
    const labels = {
      LMS: "Least Misery (LMS)",
      ADD: "Additive (ADD)",
      APP: "Approval Voting (APP)",
    };
    return labels[strategy];
  };

  const getExplanationStrategyLabel = (strategy: ExplanationStrategy) => {
    const labels = {
      no_expl: "No Explanation",
      ordered_list_expl: "Ordered List Explanation",
      graph_expl: "Graph Explanation",
      text_expl: "Text Explanation",
      chat_expl: "Chat Explanation",
      pie_expl: "Pie Chart Explanation",
      heatmap_expl: "Heatmap Explanation",
    };
    return labels[strategy];
  };

  // Calculate group scores based on selected strategy
  const groupScores = useMemo(() => {
    return restaurants.map((_, restaurantIndex) => {
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
  }, [ratings, strategy]);

  // Create sorted restaurants array and corresponding data when sorting is enabled
  const {
    sortedRestaurants,
    sortedRatings,
    sortedGroupScores,
    originalToSortedIndexMap,
  } = useMemo(() => {
    if (!sortBestToWorst) {
      return {
        sortedRestaurants: restaurants,
        sortedRatings: ratings,
        sortedGroupScores: groupScores,
        originalToSortedIndexMap: restaurants.map((_, index) => index),
      };
    }

    // Create array of restaurant indices with their scores for sorting
    const restaurantScores = restaurants.map((restaurant, index) => ({
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
    const originalToSortedIndexMap = new Array(restaurants.length);
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
  }, [restaurants, ratings, groupScores, sortBestToWorst]);

  // Find all top-scoring non-visited restaurants (handle ties) - use sorted data
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
    return candidates.filter((c) => c.score === bestScore).map((c) => c.index);
  }, [sortedRestaurants, sortedGroupScores]);

  const updateRating = (
    personIndex: number,
    restaurantIndex: number,
    value: number
  ) => {
    setRatings((prev) => {
      const newRatings = [...prev];
      newRatings[personIndex] = [...newRatings[personIndex]];

      // If sorting is enabled, we need to map from sorted index back to original index
      let actualRestaurantIndex = restaurantIndex;
      if (sortBestToWorst) {
        // Find the original index for this sorted index
        actualRestaurantIndex = sortedRestaurants[restaurantIndex].id - 1; // Assuming id is 1-based
      }

      newRatings[personIndex][actualRestaurantIndex] = value;
      return newRatings;
    });
  };

  const resetRatings = () => {
    setRatings(initialRatings);
  };

  const recommendedRestaurantNames = recommendedRestaurantIndices.map(
    (i) => sortedRestaurants[i].name
  );

  const renderExplanation = () => {
    switch (explanationStrategy) {
      case "no_expl":
        return (
          <NoExplanation
            recommendedRestaurantNames={recommendedRestaurantNames}
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
      case "chat_expl":
        return (
          <TextChat
            people={people}
            restaurants={sortedRestaurants}
            ratings={sortedRatings}
            strategy={strategy}
            groupScores={sortedGroupScores}
            recommendedRestaurantIndices={recommendedRestaurantIndices}
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
    <div className="max-w-7xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">LMS6</h1>
        <p className="text-gray-600 mb-4">
          Previous visits: The group has previously visited the following
          restaurants in this order: Rest 7, Rest 5, Rest 9.
        </p>
      </div>

      {/* Ratings Table */}
      <div className="mb-8">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-300 px-4 py-2 text-left">
                  Person
                </th>
                {sortedRestaurants.map((restaurant) => (
                  <th
                    key={restaurant.id}
                    className={`border border-gray-300 px-2 py-2 text-center text-sm ${
                      restaurant.visited ? "bg-gray-300 text-gray-500" : ""
                    }`}
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
                  <td className="border border-gray-300 px-4 py-2 font-medium">
                    {person.name}
                  </td>
                  {sortedRestaurants.map((restaurant, restaurantIndex) => (
                    <td
                      key={restaurant.id}
                      className={`border border-gray-300 px-2 py-2 text-center ${
                        restaurant.visited ? "bg-gray-200" : ""
                      }`}
                    >
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={sortedRatings[personIndex][restaurantIndex]}
                        onChange={(e) => {
                          if (!restaurant.visited) {
                            const value = parseInt(e.target.value);
                            if (value >= 1 && value <= 5) {
                              updateRating(personIndex, restaurantIndex, value);
                            }
                          }
                        }}
                        disabled={restaurant.visited}
                        className={`w-12 h-8 text-center border border-gray-300 rounded ${
                          restaurant.visited
                            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                            : "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        }`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Explanations */}
      <div className="mb-8 space-y-4">{renderExplanation()}</div>

      {/* Reset Button */}
      <div className="flex justify-center">
        <button
          onClick={resetRatings}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Reset to Initial Values
        </button>
      </div>

      <div className="my-6">
                {/* Settings Accordion */}
                <Collapsible open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <CollapsibleTrigger className="w-full">
            <div className="bg-gray-50 p-4 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <SettingsIcon className="w-5 h-5 text-gray-600" />
                  <div className="text-left">
                    <h3 className="text-lg font-semibold">Settings</h3>
                    {!isSettingsOpen && (
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>
                          <span className="font-medium">Strategy:</span>{" "}
                          {getAggregationStrategyLabel(strategy)}
                        </p>
                        <p>
                          <span className="font-medium">Explanation:</span>{" "}
                          {getExplanationStrategyLabel(explanationStrategy)}
                        </p>
                        <p>
                          <span className="font-medium">Options:</span>{" "}
                          {sortBestToWorst ? "Sorted" : "Original order"}
                          {fadeNonContributing && ", Fade non-contributing"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                {isSettingsOpen ? (
                  <ChevronUpIcon className="w-5 h-5 text-gray-600" />
                ) : (
                  <ChevronDownIcon className="w-5 h-5 text-gray-600" />
                )}
              </div>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="bg-gray-50 p-4 rounded-lg mt-2 space-y-6">
              {/* Aggregation Strategy Selection */}
              <div>
                <h4 className="text-md font-semibold mb-3">
                  Aggregation Strategy
                </h4>
                <Select
                  value={strategy}
                  onValueChange={(value) =>
                    setStrategy(value as AggregationStrategy)
                  }
                >
                  <SelectTrigger className="w-full max-w-md py-6">
                    <SelectValue placeholder="Select aggregation strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LMS">
                      <div className="flex flex-col text-left">
                        <span className="font-medium">Least Misery (LMS)</span>
                        <span className="text-sm text-muted-foreground">
                          Minimize the lowest rating
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="ADD">
                      <div className="flex flex-col text-left">
                        <span className="font-medium">Additive (ADD)</span>
                        <span className="text-sm text-muted-foreground">
                          Maximize total rating sum
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="APP">
                      <div className="flex flex-col text-left">
                        <span className="font-medium">
                          Approval Voting (APP)
                        </span>
                        <span className="text-sm text-muted-foreground">
                          Maximize votes above 3
                        </span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Explanation Strategy Selection */}
              <div>
                <h4 className="text-md font-semibold mb-3">
                  Explanation Strategy
                </h4>
                <Select
                  value={explanationStrategy}
                  onValueChange={(value) =>
                    setExplanationStrategy(value as ExplanationStrategy)
                  }
                >
                  <SelectTrigger className="w-full max-w-md py-6">
                    <SelectValue placeholder="Select explanation strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no_expl">
                      <div className="flex flex-col text-left">
                        <span className="font-medium">No Explanation</span>
                        <span className="text-sm text-muted-foreground">
                          Show only the recommendation without explanation
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="text_expl">
                      <div className="flex flex-col text-left">
                        <span className="font-medium">Text Explanation</span>
                        <span className="text-sm text-muted-foreground">
                          Show recommendation with textual explanation
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="chat_expl">
                      <div className="flex flex-col text-left">
                        <span className="font-medium">Chat Explanation</span>
                        <span className="text-sm text-muted-foreground">
                          Show interactive chat with explanation
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="graph_expl">
                      <div className="flex flex-col text-left">
                        <span className="font-medium">Graph Explanation</span>
                        <span className="text-sm text-muted-foreground">
                          Show interactive graph with visual explanation
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="pie_expl">
                      <div className="flex flex-col text-left">
                        <span className="font-medium">
                          Pie Chart Explanation
                        </span>
                        <span className="text-sm text-muted-foreground">
                          Show interactive pie charts for each restaurant
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="heatmap_expl">
                      <div className="flex flex-col text-left">
                        <span className="font-medium">Heatmap Explanation</span>
                        <span className="text-sm text-muted-foreground">
                          Show interactive heatmap of all person-restaurant
                          ratings
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="ordered_list_expl">
                      <div className="flex flex-col text-left">
                        <span className="font-medium">
                          Ordered List Explanation
                        </span>
                        <span className="text-sm text-muted-foreground">
                          Show restaurants ranked by score with contextual
                          explanations
                        </span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Display Options */}
              <div>
                <h4 className="text-md font-semibold mb-3">Display Options</h4>
                <div className="space-y-3">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sortBestToWorst}
                      onChange={(e) => setSortBestToWorst(e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-medium text-gray-900">
                        Sort best to worst
                      </span>
                      <p className="text-sm text-gray-600">
                        Sort restaurants by group score (best to worst)
                      </p>
                    </div>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fadeNonContributing}
                      onChange={(e) => setFadeNonContributing(e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-medium text-gray-900">
                        Fade non-contributing users
                      </span>
                      <p className="text-sm text-gray-600">
                        Reduce opacity of bars that don't contribute to the
                        group score
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
