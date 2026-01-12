'use client';

import { useState, useEffect } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { AnswerValue } from '@/lib/types';

interface Option {
  id: string;
  text: string;
  value: string;
}
interface MultipleChoiceProps {
  question: string;
  options: Option[];
  value?: AnswerValue;
  onChange: (value: AnswerValue) => void;
  required?: boolean;
  onAutoNext?: () => void;
}

export function MultipleChoice({ 
  question, 
  options, 
  value, 
  onChange, 
  required = false,
  onAutoNext
}: MultipleChoiceProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Reset confirmation effect on question change
  useEffect(() => {
    setShowConfirmation(false);
  }, [question]);

  const selectedOption = (value as string) ?? "";

  const handleValueChange = (newValue: string) => {
    onChange(newValue);
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
      <RadioGroup 
        key={question}
        value={selectedOption}
        onValueChange={handleValueChange}
        className="space-y-3"
      >
        {options.map((option) => (
          <div key={option.id} className="flex items-center space-x-3">
            <RadioGroupItem 
              value={option.value} 
              id={option.id}
              className={`border-dark-purple data-[state=checked]:bg-maize data-[state=checked]:border-maize transition-all duration-200 ${
                showConfirmation && selectedOption === option.value 
                  ? 'ring-2 ring-maize ring-offset-2 scale-105' 
                  : ''
              }`}
            />
            <Label 
              htmlFor={option.id}
              className={`text-dark-purple cursor-pointer flex-1 transition-all duration-200 ${
                showConfirmation && selectedOption === option.value 
                  ? 'text-maize font-semibold' 
                  : ''
              }`}
            >
              {option.text}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
