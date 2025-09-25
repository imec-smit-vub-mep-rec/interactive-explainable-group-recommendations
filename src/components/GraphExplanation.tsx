'use client';

import React from 'react';
import GraphSliders from './GraphSliders';

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

interface GraphExplanationProps {
  people: Person[];
  restaurants: Restaurant[];
  ratings: number[][];
  strategy: 'LMS' | 'ADD' | 'APP';
  recommendedRestaurantIndices: number[];
  groupScores: number[];
  updateRating: (personIndex: number, restaurantIndex: number, value: number) => void;
  resetRatings: () => void;
}

export default function GraphExplanation({
  people,
  restaurants,
  ratings,
  strategy,
  recommendedRestaurantIndices,
  groupScores,
  updateRating,
  resetRatings
}: GraphExplanationProps) {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold mb-4">graph_expl</h2>
      <GraphSliders
        people={people}
        restaurants={restaurants}
        ratings={ratings}
        strategy={strategy}
        recommendedRestaurantIndices={recommendedRestaurantIndices}
        groupScores={groupScores}
        updateRating={updateRating}
        resetRatings={resetRatings}
      />
    </div>
  );
}
