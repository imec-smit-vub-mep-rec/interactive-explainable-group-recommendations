'use client';

import { useState, useEffect } from 'react';
import { NavigationButtons } from '../NavigationButtons';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { InteractionEvent } from '@/lib/db';
import type { SessionData } from '../ExperimentFlow';

interface RepeatUnderstandingScreenProps {
  session: SessionData;
  saveAnswer: (field: string, value: unknown) => Promise<void>;
  updateSessionData: (updates: Partial<SessionData>) => void;
  recordInteraction: (type: InteractionEvent['type'], data: Record<string, unknown>) => void;
  isLoading: boolean;
  onNext: () => void;
  onBack: () => void;
}

const SCALE = [1, 2, 3, 4, 5, 6, 7];
const SCALE_LABELS = {
  1: 'Strongly Disagree',
  4: 'Neutral',
  7: 'Strongly Agree',
};

export function RepeatUnderstandingScreen({
  session,
  saveAnswer,
  updateSessionData,
  recordInteraction,
  isLoading,
  onNext,
  onBack,
}: RepeatUnderstandingScreenProps) {
  const [understand, setUnderstand] = useState<number | null>(
    session.repeatUnderstanding?.understand || null
  );
  const [predict, setPredict] = useState<number | null>(
    session.repeatUnderstanding?.predict || null
  );

  // Save answers when they change
  useEffect(() => {
    if (understand !== null) {
      saveAnswer('repeat_subjective_understanding_1_understand', understand);
      updateSessionData({
        repeatUnderstanding: {
          understand,
          predict: session.repeatUnderstanding?.predict || null,
        },
      });
    }
  }, [understand]);

  useEffect(() => {
    if (predict !== null) {
      saveAnswer('repeat_subjective_understanding_2_predict', predict);
      updateSessionData({
        repeatUnderstanding: {
          understand: session.repeatUnderstanding?.understand || null,
          predict,
        },
      });
    }
  }, [predict]);

  const canProceed = understand !== null && predict !== null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Your Understanding After Testing
        </h1>
        <p className="text-gray-600">
          Now that you have completed the test questions, please rate your agreement with the following statements again.
        </p>
      </div>

      {/* Question 1: Understanding */}
      <div className="space-y-8">
        <Label className="text-lg font-medium text-gray-900">
          I understand how the model works to predict the best recommendation for the group.
        </Label>
        <RadioGroup
          value={understand?.toString() || ''}
          onValueChange={(value) => {
            setUnderstand(parseInt(value));
            recordInteraction('click', { action: 'rate_understand', value: parseInt(value) });
          }}
          className="flex flex-col space-y-3 mt-4"
        >
          <div className="flex items-start justify-between">
            {SCALE.map((value) => (
              <div key={value} className="flex flex-col items-center">
                <RadioGroupItem value={value.toString()} id={`repeat-understand-${value}`} />
                <Label
                  htmlFor={`repeat-understand-${value}`}
                  className="mt-2 text-sm text-gray-600 cursor-pointer"
                >
                  {value}
                </Label>
                {SCALE_LABELS[value as keyof typeof SCALE_LABELS] && (
                  <span className="text-xs text-gray-400 mt-1 text-center max-w-16">
                    {SCALE_LABELS[value as keyof typeof SCALE_LABELS]}
                  </span>
                )}
              </div>
            ))}
          </div>
        </RadioGroup>
      </div>

      {/* Question 2: Prediction */}
      <div className="space-y-4">
        <Label className="text-lg font-medium text-gray-900">
          I can predict how the model will behave.
        </Label>
        <RadioGroup
          value={predict?.toString() || ''}
          onValueChange={(value) => {
            setPredict(parseInt(value));
            recordInteraction('click', { action: 'rate_predict', value: parseInt(value) });
          }}
          className="flex flex-col space-y-3 mt-4"
        >
          <div className="flex items-start justify-between">
            {SCALE.map((value) => (
              <div key={value} className="flex flex-col items-center">
                <RadioGroupItem value={value.toString()} id={`repeat-predict-${value}`} />
                <Label
                  htmlFor={`repeat-predict-${value}`}
                  className="mt-2 text-sm text-gray-600 cursor-pointer"
                >
                  {value}
                </Label>
                {SCALE_LABELS[value as keyof typeof SCALE_LABELS] && (
                  <span className="text-xs text-gray-400 mt-1 text-center max-w-16">
                    {SCALE_LABELS[value as keyof typeof SCALE_LABELS]}
                  </span>
                )}
              </div>
            ))}
          </div>
        </RadioGroup>
      </div>

      {/* Navigation */}
      <NavigationButtons
        onBack={onBack}
        onNext={onNext}
        canGoBack={true}
        canGoNext={canProceed}
        isLoading={isLoading}
      />
    </div>
  );
}
