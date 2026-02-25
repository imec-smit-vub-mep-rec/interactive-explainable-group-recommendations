'use client';

import { useState, useEffect } from 'react';
import { NavigationButtons } from '../NavigationButtons';
import { UnderstandingQuestion } from '../UnderstandingQuestion';
import type { InteractionEvent } from '@/lib/db';
import type { SessionData } from '../ExperimentFlow';

interface PreliminaryUnderstandingScreenProps {
  session: SessionData;
  saveAnswer: (field: string, value: unknown, sessionIdOverride?: string) => Promise<void>;
  updateSessionData: (updates: Partial<SessionData>) => void;
  recordInteraction: (type: InteractionEvent['type'], data: Record<string, unknown>) => void;
  isLoading: boolean;
  onNext: () => void;
  onBack?: () => void;
}

export function PreliminaryUnderstandingScreen({
  session,
  saveAnswer,
  updateSessionData,
  recordInteraction,
  isLoading,
  onNext,
  onBack,
}: PreliminaryUnderstandingScreenProps) {
  const [understand, setUnderstand] = useState<number | null>(
    session.preliminaryUnderstanding?.understand || null
  );
  const [predict, setPredict] = useState<number | null>(
    session.preliminaryUnderstanding?.predict || null
  );

  // Save answers when they change
  useEffect(() => {
    if (understand !== null) {
      saveAnswer('preliminary_subjective_understanding_1_understand', understand);
      updateSessionData({
        preliminaryUnderstanding: {
          understand,
          predict: session.preliminaryUnderstanding?.predict || null,
        },
      });
    }
  }, [understand]);

  useEffect(() => {
    if (predict !== null) {
      saveAnswer('preliminary_subjective_understanding_2_predict', predict);
      updateSessionData({
        preliminaryUnderstanding: {
          understand: session.preliminaryUnderstanding?.understand || null,
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
          Your Understanding So Far
        </h1>
        <p className="text-gray-600">
          Please rate your agreement with the following statements based on your experience with the training tasks.
        </p>
      </div>

      {/* Question 1: Understanding */}
      <UnderstandingQuestion
        idPrefix="preliminary-understand"
        label="I understand how the model works to predict the best recommendation for the group."
        value={understand}
        onChange={(value) => {
          setUnderstand(value);
          recordInteraction('click', { action: 'rate_understand', value });
        }}
      />

      {/* Question 2: Prediction */}
      <UnderstandingQuestion
        idPrefix="preliminary-predict"
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
