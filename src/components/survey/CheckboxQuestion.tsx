'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AnswerValue } from '@/lib/types';

interface Option {
  id: string;
  text: string;
  value: string;
}

interface CheckboxQuestionProps {
  question: string;
  options: Option[];
  value?: AnswerValue;
  onChange: (value: AnswerValue) => void;
  required?: boolean;
}

export function CheckboxQuestion({ 
  question, 
  options, 
  value = [], 
  onChange, 
  required = false 
}: CheckboxQuestionProps) {
  const currentValue = (value as string[]) || [];
  
  const handleChange = (option: Option, checked: boolean) => {
    if (checked) {
      onChange([...currentValue, option.value]);
    } else {
      onChange(currentValue.filter(v => v !== option.value));
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-dark-purple">
        {question}
        {required && <span className="text-red-500 ml-1">*</span>}
      </h3>
      <div className="space-y-3">
        {options.map((option) => (
          <div key={option.id} className="flex items-center space-x-3">
            <Checkbox 
              id={option.id}
              checked={currentValue.includes(option.value)}
              onCheckedChange={(checked) => handleChange(option, checked as boolean)}
              className="border-dark-purple data-[state=checked]:bg-maize data-[state=checked]:border-maize"
            />
            <Label 
              htmlFor={option.id}
              className="text-dark-purple cursor-pointer flex-1"
            >
              {option.text}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
