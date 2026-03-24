'use client';

import { useRef, useState } from 'react';
import { NavigationButtons } from '../NavigationButtons';
import { LikertGrid } from '@/components/answer-options/LikertGrid';
import type { InteractionEvent } from '@/lib/db';
import { questions } from '@/lib/data/survey_questions';
import type { AnswerValue, LikertGridQuestion } from '@/lib/types';
import type { SessionData } from '../ExperimentFlow';

interface SatisfactionScreenProps {
  session: SessionData;
  saveAnswer: (field: string, value: unknown, sessionIdOverride?: string) => Promise<void>;
  updateSessionData: (updates: Partial<SessionData>) => void;
  recordInteraction: (type: InteractionEvent['type'], data: Record<string, unknown>) => void;
  isLoading: boolean;
  onNext: () => void;
  onBack?: () => void;
}

export function SatisfactionScreen({
  session,
  saveAnswer,
  updateSessionData,
  recordInteraction,
  isLoading,
  onNext,
  onBack,
}: SatisfactionScreenProps) {
  const question = questions.subjective_satisfaction.questions[0] as LikertGridQuestion;
  const recommendationsKey = 'subjective_satisfaction_1_recommendations';
  const explanationsKey = 'subjective_satisfaction_2_explanations';

  const [responses, setResponses] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (session.satisfaction?.recommendations !== null && session.satisfaction?.recommendations !== undefined) {
      initial[recommendationsKey] = session.satisfaction.recommendations.toString();
    }
    if (session.satisfaction?.explanations !== null && session.satisfaction?.explanations !== undefined) {
      initial[explanationsKey] = session.satisfaction.explanations.toString();
    }
    return initial;
  });

  const previousResponsesRef = useRef<Record<string, string>>(responses);
  const canProceed = Boolean(responses[recommendationsKey] && responses[explanationsKey]);

  const handleChange = (value: AnswerValue) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;

    const nextResponses = value as Record<string, string>;
    setResponses(nextResponses);

    const recommendationsValue = nextResponses[recommendationsKey];
    const explanationsValue = nextResponses[explanationsKey];
    const parsedRecommendations = recommendationsValue ? Number.parseInt(recommendationsValue, 10) : null;
    const parsedExplanations = explanationsValue ? Number.parseInt(explanationsValue, 10) : null;

    if (recommendationsValue && previousResponsesRef.current[recommendationsKey] !== recommendationsValue) {
      saveAnswer(recommendationsKey, parsedRecommendations);
      recordInteraction('click', { action: 'rate_satisfaction_recommendations', value: parsedRecommendations });
    }

    if (explanationsValue && previousResponsesRef.current[explanationsKey] !== explanationsValue) {
      saveAnswer(explanationsKey, parsedExplanations);
      recordInteraction('click', { action: 'rate_satisfaction_explanations', value: parsedExplanations });
    }

    updateSessionData({
      satisfaction: {
        recommendations: parsedRecommendations,
        explanations: parsedExplanations,
      },
    });

    previousResponsesRef.current = nextResponses;
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Satisfaction
        </h1>
        <p className="text-gray-600">
          Please rate your agreement with the following statements.
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
