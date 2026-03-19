'use client';

import { useState, useEffect } from 'react';
import { AnswerValue } from '@/lib/types';

interface RatingScaleProps {
  question: string;
  value?: AnswerValue;
  onChange: (value: AnswerValue) => void;
  min?: number;
  max?: number;
  required?: boolean;
  onAutoNext?: () => void;
}

export function RatingScale({ 
  question, 
  value, 
  onChange, 
  min = 1, 
  max = 5,
  required = false,
  onAutoNext
}: RatingScaleProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const range = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  // Reset confirmation on question change
  useEffect(() => {
    setShowConfirmation(false);
  }, [question]);
  
  const selectedRating = (value as number) ?? null;

  const handleRatingClick = (rating: number) => {
    onChange(rating);
    setShowConfirmation(true);
    
    // Auto-advance after 0.5 seconds with visual confirmation
    if (onAutoNext) {
      setTimeout(() => {
        onAutoNext();
      }, 500);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-dark-purple">
        {question}
        {required && <span className="text-red-500 ml-1">*</span>}
      </h3>
      <div className="flex justify-between items-center">
        <span className="text-sm text-dark-purple/70">
          {min === 1 ? 'Not at all' : min}
        </span>
        <div className="flex space-x-2">
          {range.map((rating) => (
            <button
              key={rating}
              onClick={() => handleRatingClick(rating)}
              className={`
                w-12 h-12 rounded-full border-2 flex items-center justify-center
                transition-all duration-200 font-medium
                ${selectedRating === rating 
                  ? 'bg-maize border-maize text-dark-purple' 
                  : 'border-dark-purple text-dark-purple hover:border-maize hover:bg-maize/20'
                }
                ${showConfirmation && selectedRating === rating 
                  ? 'ring-2 ring-maize ring-offset-2 scale-110' 
                  : ''
                }
              `}
            >
              {rating}
            </button>
          ))}
        </div>
        <span className="text-sm text-dark-purple/70">
          {max === 5 ? 'Very much' : max}
        </span>
      </div>
    </div>
  );
}
