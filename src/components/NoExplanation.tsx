'use client';

import React from 'react';

interface NoExplanationProps {
  recommendedRestaurantNames: string[];
}

export default function NoExplanation({ recommendedRestaurantNames }: NoExplanationProps) {
  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <h3 className="font-semibold mb-2">no_expl:</h3>
      <p>
        Using the provided ratings, the software system made a recommendation to the group. 
        <span className="font-semibold text-blue-600"> {recommendedRestaurantNames.join(', ')} {recommendedRestaurantNames.length > 1 ? 'have' : 'has'} been recommended to the group.</span>
      </p>
    </div>
  );
}
