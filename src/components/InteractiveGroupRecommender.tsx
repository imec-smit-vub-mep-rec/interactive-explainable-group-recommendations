'use client';

import React, { useState, useMemo } from 'react';
import NoExplanation from './NoExplanation';
import TextExplanation from './TextExplanation';
import GraphExplanation from './GraphExplanation';

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

type AggregationStrategy = 'LMS' | 'ADD' | 'APP';
type ExplanationStrategy = 'no_expl' | 'text_expl' | 'graph_expl';

const people: Person[] = [
  { name: 'Darcy', pattern: 'solid', color: '#6B7280' },
  { name: 'Alex', pattern: 'dotted', color: '#3B82F6' },
  { name: 'Jess', pattern: 'horizontal', color: '#10B981' },
  { name: 'Jackie', pattern: 'vertical', color: '#F59E0B' },
  { name: 'Freddy', pattern: 'diagonal', color: '#EF4444' }
];

const restaurants: Restaurant[] = [
  { id: 1, name: 'Rest 1', visited: false },
  { id: 2, name: 'Rest 2', visited: false },
  { id: 3, name: 'Rest 3', visited: false },
  { id: 4, name: 'Rest 4', visited: false },
  { id: 5, name: 'Rest 5', visited: true },
  { id: 6, name: 'Rest 6', visited: false },
  { id: 7, name: 'Rest 7', visited: true },
  { id: 8, name: 'Rest 8', visited: false },
  { id: 9, name: 'Rest 9', visited: true },
  { id: 10, name: 'Rest 10', visited: false }
];

// Initial ratings data
const initialRatings: number[][] = [
  [5, 1, 1, 4, 3, 2, 4, 2, 5, 1], // Darcy
  [5, 3, 1, 2, 5, 1, 4, 4, 3, 2], // Alex
  [4, 2, 1, 5, 5, 1, 5, 2, 4, 4], // Jess
  [5, 1, 2, 2, 3, 1, 5, 1, 3, 5], // Jackie
  [1, 5, 5, 4, 3, 4, 4, 5, 4, 1]  // Freddy
];

export default function InteractiveGroupRecommender() {
  const [ratings, setRatings] = useState<number[][]>(initialRatings);
  const [strategy, setStrategy] = useState<AggregationStrategy>('LMS');
  const [explanationStrategy, setExplanationStrategy] = useState<ExplanationStrategy>('no_expl');

  // Calculate group scores based on selected strategy
  const groupScores = useMemo(() => {
    return restaurants.map((_, restaurantIndex) => {
      const restaurantRatings = ratings.map(personRatings => personRatings[restaurantIndex]);
      
      switch (strategy) {
        case 'LMS': // Least Misery Strategy
          return Math.min(...restaurantRatings);
        case 'ADD': // Additive Strategy
          return restaurantRatings.reduce((sum, rating) => sum + rating, 0);
        case 'APP': // Approval Voting Strategy
          return restaurantRatings.filter(rating => rating > 3).length;
        default:
          return Math.min(...restaurantRatings);
      }
    });
  }, [ratings, strategy]);

  // Find all top-scoring non-visited restaurants (handle ties)
  const recommendedRestaurantIndices = useMemo(() => {
    const candidates = restaurants
      .map((restaurant, index) => ({ index, visited: restaurant.visited, score: groupScores[index] }))
      .filter(r => !r.visited);
    if (candidates.length === 0) return [] as number[];
    const bestScore = Math.max(...candidates.map(c => c.score));
    return candidates.filter(c => c.score === bestScore).map(c => c.index);
  }, [groupScores]);

  const updateRating = (personIndex: number, restaurantIndex: number, value: number) => {
    setRatings(prev => {
      const newRatings = [...prev];
      newRatings[personIndex] = [...newRatings[personIndex]];
      newRatings[personIndex][restaurantIndex] = value;
      return newRatings;
    });
  };

  const resetRatings = () => {
    setRatings(initialRatings);
  };

  const recommendedRestaurantNames = recommendedRestaurantIndices.map(i => restaurants[i].name);

  const renderExplanation = () => {
    switch (explanationStrategy) {
      case 'no_expl':
        return <NoExplanation recommendedRestaurantNames={recommendedRestaurantNames} />;
      case 'text_expl':
        return (
          <TextExplanation 
            recommendedRestaurantNames={recommendedRestaurantNames} 
            strategy={strategy}
            people={people}
            restaurants={restaurants}
            ratings={ratings}
            groupScores={groupScores}
            recommendedRestaurantIndices={recommendedRestaurantIndices}
          />
        );
      case 'graph_expl':
        return (
          <GraphExplanation
            people={people}
            restaurants={restaurants}
            ratings={ratings}
            strategy={strategy}
            recommendedRestaurantIndices={recommendedRestaurantIndices}
            groupScores={groupScores}
            updateRating={updateRating}
            resetRatings={resetRatings}
          />
        );
      default:
        return <NoExplanation recommendedRestaurantNames={recommendedRestaurantNames} />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">LMS6</h1>
        <p className="text-gray-600 mb-4">
          Previous visits: The group has previously visited the following restaurants in this order: Rest 7, Rest 5, Rest 9.
        </p>
        
        {/* Strategy Selection */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">Aggregation Strategy</h3>
          <div className="flex flex-wrap gap-4">
            {[
              { key: 'LMS', label: 'Least Misery (LMS)', description: 'Minimize the lowest rating' },
              { key: 'ADD', label: 'Additive (ADD)', description: 'Maximize total rating sum' },
              { key: 'APP', label: 'Approval Voting (APP)', description: 'Maximize votes above 3' }
            ].map(({ key, label, description }) => (
              <label key={key} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="strategy"
                  value={key}
                  checked={strategy === key}
                  onChange={(e) => setStrategy(e.target.value as AggregationStrategy)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500"
                />
                <div>
                  <span className="font-medium text-gray-900">{label}</span>
                  <p className="text-sm text-gray-600">{description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Explanation Strategy Selection */}
        <div className="bg-gray-50 p-4 rounded-lg mt-4">
          <h3 className="text-lg font-semibold mb-3">Explanation Strategy</h3>
          <div className="flex flex-wrap gap-4">
            {[
              { key: 'no_expl', label: 'No Explanation', description: 'Show only the recommendation without explanation' },
              { key: 'text_expl', label: 'Text Explanation', description: 'Show recommendation with textual explanation' },
              { key: 'graph_expl', label: 'Graph Explanation', description: 'Show interactive graph with visual explanation' }
            ].map(({ key, label, description }) => (
              <label key={key} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="explanationStrategy"
                  value={key}
                  checked={explanationStrategy === key}
                  onChange={(e) => setExplanationStrategy(e.target.value as ExplanationStrategy)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500"
                />
                <div>
                  <span className="font-medium text-gray-900">{label}</span>
                  <p className="text-sm text-gray-600">{description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Ratings Table */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">LMS6</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-300 px-4 py-2 text-left">Person</th>
                {restaurants.map(restaurant => (
                  <th 
                    key={restaurant.id} 
                    className={`border border-gray-300 px-2 py-2 text-center text-sm ${
                      restaurant.visited ? 'bg-gray-300 text-gray-500' : ''
                    }`}
                  >
                    {restaurant.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((person, personIndex) => (
                <tr key={person.name}>
                  <td className="border border-gray-300 px-4 py-2 font-medium">{person.name}</td>
                  {restaurants.map((restaurant, restaurantIndex) => (
                    <td 
                      key={restaurant.id} 
                      className={`border border-gray-300 px-2 py-2 text-center ${
                        restaurant.visited ? 'bg-gray-200' : ''
                      }`}
                    >
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={ratings[personIndex][restaurantIndex]}
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
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                            : 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
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
      <div className="mb-8 space-y-4">
        {renderExplanation()}
      </div>

      {/* Reset Button */}
      <div className="flex justify-center">
        <button
          onClick={resetRatings}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Reset to Initial Values
        </button>
      </div>
    </div>
  );
}
