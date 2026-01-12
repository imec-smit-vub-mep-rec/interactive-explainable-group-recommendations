'use client';

import { useState, useEffect } from 'react';
import { NavigationButtons } from '../NavigationButtons';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import type { InteractionEvent, NasaTlxData } from '@/lib/db';
import type { SessionData } from '../ExperimentFlow';

interface NasaTlxScreenProps {
  session: SessionData;
  saveAnswer: (field: string, value: unknown) => Promise<void>;
  updateSessionData: (updates: Partial<SessionData>) => void;
  recordInteraction: (type: InteractionEvent['type'], data: Record<string, unknown>) => void;
  isLoading: boolean;
  onNext: () => void;
  onBack: () => void;
}

interface NasaTlxQuestion {
  id: keyof NasaTlxData;
  title: string;
  description: string;
  lowLabel: string;
  highLabel: string;
}

const NASA_TLX_QUESTIONS: NasaTlxQuestion[] = [
  {
    id: 'mental_demand',
    title: 'Mental Demand',
    description: 'How mentally demanding was the task?',
    lowLabel: 'Very Low',
    highLabel: 'Very High',
  },
  {
    id: 'physical_demand',
    title: 'Physical Demand',
    description: 'How physically demanding was the task?',
    lowLabel: 'Very Low',
    highLabel: 'Very High',
  },
  {
    id: 'temporal_demand',
    title: 'Temporal Demand',
    description: 'How hurried or rushed was the pace of the task?',
    lowLabel: 'Very Low',
    highLabel: 'Very High',
  },
  {
    id: 'performance',
    title: 'Performance',
    description: 'How successful were you in accomplishing what you were asked to do?',
    lowLabel: 'Perfect',
    highLabel: 'Failure',
  },
  {
    id: 'effort',
    title: 'Effort',
    description: 'How hard did you have to work to accomplish your level of performance?',
    lowLabel: 'Very Low',
    highLabel: 'Very High',
  },
  {
    id: 'frustration',
    title: 'Frustration',
    description: 'How insecure, discouraged, irritated, stressed, and annoyed were you?',
    lowLabel: 'Very Low',
    highLabel: 'Very High',
  },
];

export function NasaTlxScreen({
  session,
  saveAnswer,
  updateSessionData,
  recordInteraction,
  isLoading,
  onNext,
  onBack,
}: NasaTlxScreenProps) {
  const [ratings, setRatings] = useState<NasaTlxData>(
    session.nasaTlxData || {}
  );

  // Save all ratings when they change
  useEffect(() => {
    const allAnswered = NASA_TLX_QUESTIONS.every(q => ratings[q.id] !== undefined);
    if (allAnswered) {
      saveAnswer('nasa_tlx_data', ratings);
      updateSessionData({ nasaTlxData: ratings });
    }
  }, [ratings]);

  const handleRatingChange = (questionId: keyof NasaTlxData, value: number) => {
    setRatings(prev => {
      const updated = { ...prev, [questionId]: value };
      // Save immediately on change
      saveAnswer('nasa_tlx_data', updated);
      updateSessionData({ nasaTlxData: updated });
      return updated;
    });
    recordInteraction('click', { action: 'rate_nasa_tlx', questionId, value });
  };

  const canProceed = NASA_TLX_QUESTIONS.every(q => ratings[q.id] !== undefined);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Cognitive Load Assessment
        </h1>
        <p className="text-gray-600">
          Please rate your experience with the tasks you just completed. Move each slider to indicate your rating on a scale from 1 to 20.
        </p>
      </div>

      {/* NASA-TLX Questions */}
      <div className="space-y-8">
        {NASA_TLX_QUESTIONS.map((question) => (
          <div key={question.id} className="space-y-4">
            <div>
              <Label className="text-lg font-medium text-gray-900">
                {question.title}
              </Label>
              <p className="text-sm text-gray-600 mt-1">
                {question.description}
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-500">
                <span>{question.lowLabel}</span>
                <span>{question.highLabel}</span>
              </div>
              
              <div className="flex items-center gap-4">
                <Slider
                  value={[ratings[question.id] ?? 10]}
                  onValueChange={([value]) => handleRatingChange(question.id, value)}
                  min={1}
                  max={20}
                  step={1}
                  className="flex-1"
                />
                <span className="w-8 text-center font-medium text-gray-700">
                  {ratings[question.id] ?? '-'}
                </span>
              </div>
              
              <div className="flex justify-between text-xs text-gray-400">
                <span>1</span>
                <span>5</span>
                <span>10</span>
                <span>15</span>
                <span>20</span>
              </div>
            </div>
          </div>
        ))}
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
