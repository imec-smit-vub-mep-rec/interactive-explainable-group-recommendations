'use client';

import { useState, useEffect } from 'react';
import { NavigationButtons } from '../NavigationButtons';
import { QuestionRenderer } from '@/components/survey/QuestionRenderer';
import { questions } from '@/lib/data/questions';
import type { InteractionEvent } from '@/lib/db';
import type { SessionData } from '../ExperimentFlow';
import type { AnswerValue } from '@/lib/types';

interface DemographicsScreenProps {
  session: SessionData;
  saveAnswer: (field: string, value: unknown) => Promise<void>;
  updateSessionData: (updates: Partial<SessionData>) => void;
  recordInteraction: (type: InteractionEvent['type'], data: Record<string, unknown>) => void;
  isLoading: boolean;
  onNext: () => void;
  onBack: () => void;
}

export function DemographicsScreen({
  session,
  saveAnswer,
  updateSessionData,
  isLoading,
  onNext,
  onBack,
}: DemographicsScreenProps) {
  const [birthYear, setBirthYear] = useState<number | null>(
    session.demographics?.birthYear || null
  );
  const [gender, setGender] = useState<string | null>(
    session.demographics?.gender || null
  );

  const demographicsQuestions = questions.onboarding.questions;

  // Save answers when they change
  useEffect(() => {
    if (birthYear !== null) {
      saveAnswer('onboarding_demographics_1_birth_year', birthYear);
      updateSessionData({
        demographics: {
          ...session.demographics,
          birthYear,
          gender: session.demographics?.gender || null,
        },
      });
    }
  }, [birthYear]);

  useEffect(() => {
    if (gender !== null) {
      saveAnswer('onboarding_demographics_2_gender', gender);
      updateSessionData({
        demographics: {
          birthYear: session.demographics?.birthYear || null,
          ...session.demographics,
          gender,
        },
      });
    }
  }, [gender]);

  const handleBirthYearChange = (value: AnswerValue) => {
    setBirthYear(value as number);
  };

  const handleGenderChange = (value: AnswerValue) => {
    setGender(value as string);
  };

  const canProceed = birthYear !== null && gender !== null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {questions.onboarding.title}
        </h1>
        <p className="text-gray-600">
          {questions.onboarding.intro}
        </p>
      </div>

      {/* Questions */}
      <div className="space-y-8">
        {/* Birth Year */}
        <div className="space-y-2">
          <QuestionRenderer
            question={demographicsQuestions[0]}
            value={birthYear ?? undefined}
            onChange={handleBirthYearChange}
          />
        </div>

        {/* Gender */}
        <div className="space-y-2">
          <QuestionRenderer
            question={demographicsQuestions[1]}
            value={gender ?? undefined}
            onChange={handleGenderChange}
          />
        </div>
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
