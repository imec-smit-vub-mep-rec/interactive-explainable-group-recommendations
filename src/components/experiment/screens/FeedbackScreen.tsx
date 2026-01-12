'use client';

import { useState, useEffect } from 'react';
import { NavigationButtons } from '../NavigationButtons';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { InteractionEvent } from '@/lib/db';
import type { SessionData } from '../ExperimentFlow';

interface FeedbackScreenProps {
  session: SessionData;
  saveAnswer: (field: string, value: unknown) => Promise<void>;
  updateSessionData: (updates: Partial<SessionData>) => void;
  recordInteraction: (type: InteractionEvent['type'], data: Record<string, unknown>) => void;
  isLoading: boolean;
  onNext: () => void;
  onBack: () => void;
}

export function FeedbackScreen({
  session,
  saveAnswer,
  updateSessionData,
  recordInteraction,
  isLoading,
  onNext,
  onBack,
}: FeedbackScreenProps) {
  const [feedback, setFeedback] = useState(session.additionalFeedback || '');

  // Debounce save
  useEffect(() => {
    const timer = setTimeout(() => {
      if (feedback !== session.additionalFeedback) {
        saveAnswer('additional_feedback', feedback || null);
        updateSessionData({ additionalFeedback: feedback });
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [feedback]);

  const handleFeedbackChange = (value: string) => {
    setFeedback(value);
    recordInteraction('click', { action: 'type_feedback', length: value.length });
  };

  // Feedback is optional, so can always proceed
  const canProceed = true;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Additional Feedback
        </h1>
        <p className="text-gray-600">
          Do you have any additional feedback about the experiment? This is optional but we appreciate any comments you may have.
        </p>
      </div>

      {/* Feedback Input */}
      <div className="space-y-3">
        <Label htmlFor="feedback" className="text-lg font-medium text-gray-900">
          Your Feedback (Optional)
        </Label>
        <Textarea
          id="feedback"
          value={feedback}
          onChange={(e) => handleFeedbackChange(e.target.value)}
          placeholder="Share any thoughts, suggestions, or comments about your experience..."
          className="min-h-32 resize-y"
        />
        <p className="text-sm text-gray-400">
          {feedback.length} characters
        </p>
      </div>

      {/* Suggestions */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-medium text-gray-700 mb-2">Some things you might comment on:</h3>
        <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
          <li>Was anything confusing or unclear?</li>
          <li>How did you find the difficulty of the tasks?</li>
          <li>Did the system work as you expected?</li>
          <li>Any technical issues you encountered?</li>
        </ul>
      </div>

      {/* Navigation */}
      <NavigationButtons
        onBack={onBack}
        onNext={onNext}
        canGoBack={true}
        canGoNext={canProceed}
        isLoading={isLoading}
        nextLabel="Finish Experiment"
      />
    </div>
  );
}
