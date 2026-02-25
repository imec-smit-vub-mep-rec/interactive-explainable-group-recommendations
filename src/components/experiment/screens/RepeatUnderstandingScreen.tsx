'use client';

import { useState, useEffect } from 'react';
import { NavigationButtons } from '../NavigationButtons';
import { UnderstandingQuestion } from '../UnderstandingQuestion';
import type { InteractionEvent } from '@/lib/db';
import type { SessionData } from '../ExperimentFlow';

interface RepeatUnderstandingScreenProps {
  session: SessionData;
  saveAnswer: (field: string, value: unknown, sessionIdOverride?: string) => Promise<void>;
  updateSessionData: (updates: Partial<SessionData>) => void;
  recordInteraction: (type: InteractionEvent['type'], data: Record<string, unknown>) => void;
  isLoading: boolean;
  onNext: () => void;
  onBack?: () => void;
}

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
      <UnderstandingQuestion
        idPrefix="repeat-understand"
        label="I understand how the model works to predict the best recommendation for the group."
        value={understand}
        onChange={(value) => {
          setUnderstand(value);
          recordInteraction('click', { action: 'rate_understand', value });
        }}
      />

      {/* Question 2: Prediction */}
      <UnderstandingQuestion
        idPrefix="repeat-predict"
        label="I can predict how the model will behave."
        value={predict}
        onChange={(value) => {
          setPredict(value);
          recordInteraction('click', { action: 'rate_predict', value });
        }}
      />

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
