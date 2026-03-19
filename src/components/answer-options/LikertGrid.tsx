'use client';

import { useState, useEffect } from 'react';
import { AnswerValue } from '@/lib/types';

interface LikertGridProps {
  question: string;
  statements: string[];
  scale: string[];
  value?: AnswerValue;
  onChange: (value: AnswerValue) => void;
  required?: boolean;
  onAutoNext?: () => void;
  questionIds?: string[]; // Optional: question IDs for each statement (used for grouped MC questions)
}

export function LikertGrid({ 
  question, 
  statements, 
  scale, 
  value, 
  onChange, 
  required = false,
  onAutoNext,
  questionIds
}: LikertGridProps) {
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Get the key for a statement (use questionId if available, otherwise use index)
  const getStatementKey = (index: number): string => {
    if (questionIds && questionIds[index]) {
      return questionIds[index];
    }
    return index.toString();
  };

  // Reset state when question changes - this is the key fix
  useEffect(() => {
    setResponses({});
    setShowConfirmation(false);
  }, [question]);

  // Only update from external value if it's not empty
  useEffect(() => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      setResponses(value as Record<string, string>);
    }
  }, [value]);

  const handleResponseChange = (statementIndex: number, scaleValue: string) => {
    const key = getStatementKey(statementIndex);
    const newResponses = {
      ...responses,
      [key]: scaleValue
    };
    setResponses(newResponses);
    onChange(newResponses as unknown as AnswerValue);
    setShowConfirmation(true);
    
    // Auto-advance after all statements are answered
    const allAnswered = statements.every((_, index) => {
      const responseKey = getStatementKey(index);
      return newResponses[responseKey];
    });
    if (allAnswered && onAutoNext) {
      setTimeout(() => {
        onAutoNext();
      }, 500);
    }   
  };

  const isAllAnswered = statements.every((_, index) => {
    const key = getStatementKey(index);
    return responses[key];
  });

  return (
    <div className="space-y-6">
      {/* <h3 className="text-lg font-medium text-dark-purple">
        {question}
        {required && <span className="text-red-500 ml-1">*</span>}
      </h3> */}
      
      <div className="overflow-x-auto">
        <table key={question} className="w-full border-collapse table-fixed">
          <thead>
            <tr>
              <th className="text-left border-b border-dark-purple/20 text-dark-purple font-medium w-1/4 sm:w-1/2">
                Statement
              </th>
              {scale.map((scaleItem, scaleIndex) => (
                <th 
                  key={scaleIndex}
                  className="text-center p-1 border-b border-dark-purple/20 text-dark-purple font-medium text-[10px] sm:text-xs w-[10%]"
                >
                  <div className="break-words leading-tight">
                    {scaleItem}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {statements.map((statement, statementIndex) => (
              <tr key={statementIndex} className="border-b border-dark-purple/10">
                <td className="py-2 sm:py-4 text-dark-purple text-xs sm:text-sm leading-relaxed w-1/2">
                  {statement}
                </td>
                {scale.map((scaleItem, scaleIndex) => (
                  <td key={scaleIndex} className="p-1 text-center w-[10%]">
                    <button
                      onClick={() => handleResponseChange(statementIndex, scaleItem)}
                        className={`
                        w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center mx-auto
                        transition-all duration-200 text-[10px] sm:text-xs font-medium
                        ${responses[getStatementKey(statementIndex)] === scaleItem
                          ? 'bg-maize border-maize text-dark-purple' 
                          : 'border-dark-purple text-dark-purple hover:border-maize hover:bg-maize/20'
                        }
                        ${showConfirmation && responses[getStatementKey(statementIndex)] === scaleItem
                          ? 'ring-2 ring-maize ring-offset-1 scale-110' 
                          : ''
                        }
                      `}
                    >
                      {scaleIndex + 1}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
     
    </div>
  );
}
