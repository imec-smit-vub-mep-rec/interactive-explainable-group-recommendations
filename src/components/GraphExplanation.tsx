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
  fadeNonContributing?: boolean;
  onRatingChange?: (event: {
    personIndex: number;
    restaurantIndex: number;
    value: number;
  }) => void;
}

export default function GraphExplanation({
  people,
  restaurants,
  ratings,
  strategy,
  recommendedRestaurantIndices,
  groupScores,
  updateRating,
  resetRatings,
  fadeNonContributing = true,
  onRatingChange,
}: GraphExplanationProps) {
  return (
    <div className="mb-8" data-onboarding="graph-explanation">
      <GraphSliders
        people={people}
        restaurants={restaurants}
        ratings={ratings}
        strategy={strategy}
        recommendedRestaurantIndices={recommendedRestaurantIndices}
        groupScores={groupScores}
        updateRating={updateRating}
        resetRatings={resetRatings}
        fadeNonContributing={fadeNonContributing}
        onRatingChange={onRatingChange}
      />
    </div>
  );
}
