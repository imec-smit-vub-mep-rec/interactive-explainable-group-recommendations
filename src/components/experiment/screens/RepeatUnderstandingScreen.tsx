'use client';

import { useRef, useState } from 'react';
import { NavigationButtons } from '../NavigationButtons';
import { LikertGrid } from '@/components/answer-options/LikertGrid';
import type { InteractionEvent } from '@/lib/db';
import { questions } from '@/lib/data/survey_questions';
import type { AnswerValue, LikertGridQuestion } from '@/lib/types';
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
  const question = questions.repeat_subjective_understanding.questions[0] as LikertGridQuestion;
  const understandKey = "repeat_subjective_understanding_1_understand";
  const predictKey = "repeat_subjective_understanding_2_predict";

  const [responses, setResponses] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (session.repeatUnderstanding?.understand !== null && session.repeatUnderstanding?.understand !== undefined) {
      initial[understandKey] = session.repeatUnderstanding.understand.toString();
    }
    if (session.repeatUnderstanding?.predict !== null && session.repeatUnderstanding?.predict !== undefined) {
      initial[predictKey] = session.repeatUnderstanding.predict.toString();
    }
    return initial;
  });

  const previousResponsesRef = useRef<Record<string, string>>(responses);

  const canProceed = Boolean(responses[understandKey] && responses[predictKey]);

  const handleChange = (value: AnswerValue) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;

    const nextResponses = value as Record<string, string>;
    setResponses(nextResponses);

    const understandValue = nextResponses[understandKey];
    const predictValue = nextResponses[predictKey];
    const parsedUnderstand = understandValue ? Number.parseInt(understandValue, 10) : null;
    const parsedPredict = predictValue ? Number.parseInt(predictValue, 10) : null;

    if (understandValue && previousResponsesRef.current[understandKey] !== understandValue) {
      saveAnswer(understandKey, parsedUnderstand);
      recordInteraction('click', { action: 'rate_understand', value: parsedUnderstand });
    }

    if (predictValue && previousResponsesRef.current[predictKey] !== predictValue) {
      saveAnswer(predictKey, parsedPredict);
      recordInteraction('click', { action: 'rate_predict', value: parsedPredict });
    }

    updateSessionData({
      repeatUnderstanding: {
        understand: parsedUnderstand,
        predict: parsedPredict,
      },
    });

    previousResponsesRef.current = nextResponses;
  };

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

      <LikertGrid
        question={question.text}
        statements={question.statements}
        scale={question.scale}
        scaleLabels={question.scaleLabels}
        questionIds={question.questionIds}
        value={responses}
        onChange={handleChange}
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
