'use client';

import React from 'react';
import TextChat from './TextChat';

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

interface TextExplanationProps {
  recommendedRestaurantNames: string[];
  strategy: 'LMS' | 'ADD' | 'APP';
  people?: Person[];
  restaurants?: Restaurant[];
  ratings?: number[][];
  groupScores?: number[];
  recommendedRestaurantIndices?: number[];
}

export default function TextExplanation({ 
  recommendedRestaurantNames, 
  strategy,
  people,
  restaurants,
  ratings,
  groupScores,
  recommendedRestaurantIndices
}: TextExplanationProps) {
  const getStrategyExplanation = () => {
    switch (strategy) {
      case 'LMS':
        return ' since no group members has a real problem with it.';
      case 'ADD':
        return ' because it has the highest total rating sum among all group members.';
      case 'APP':
        return ' because it received the most approval votes (ratings above 3).';
      default:
        return ' since no group members has a real problem with it.';
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-2">text_expl:</h3>
        <p>
          Using the provided ratings, the software system made a recommendation to the group. 
          <span className="font-semibold text-blue-600"> {recommendedRestaurantNames.join(', ')} {recommendedRestaurantNames.length > 1 ? 'have' : 'has'} been recommended to the group</span> 
          {getStrategyExplanation()}
        </p>
      </div>
      

    </div>
  );
}
