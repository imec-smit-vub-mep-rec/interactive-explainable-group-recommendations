'use client';

import { useState, useEffect, useMemo } from 'react';
import { NavigationButtons } from '../NavigationButtons';
import InteractiveGroupRecommender from '@/components/InteractiveGroupRecommender';
import { scenarios as allScenarios } from '@/lib/data/scenarios';
import { createScenarioFromData } from '@/lib/scenario_helpers';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { InteractionEvent } from '@/lib/db';
import type { SessionData } from '../ExperimentFlow';
import type { ExplanationStrategy } from '@/lib/types';

interface DebriefingScreenProps {
  session: SessionData;
  saveAnswer: (field: string, value: unknown) => Promise<void>;
  updateSessionData: (updates: Partial<SessionData>) => void;
  recordInteraction: (type: InteractionEvent['type'], data: Record<string, unknown>) => void;
  isLoading: boolean;
  onNext: () => void;
  onBack: () => void;
}

export function DebriefingScreen({
  session,
  saveAnswer,
  updateSessionData,
  recordInteraction,
  isLoading,
  onNext,
  onBack,
}: DebriefingScreenProps) {
  const [explanation, setExplanation] = useState(session.textualDebriefing || '');
  
  // Get the first training scenario for debriefing display
  const firstTrainingScenarioId = session.trainingScenarioIds[0];
  
  const scenarioData = useMemo(() => {
    return allScenarios.find(s => s.id === firstTrainingScenarioId);
  }, [firstTrainingScenarioId]);
  
  const scenario = useMemo(() => {
    if (!scenarioData) return null;
    return createScenarioFromData(scenarioData);
  }, [scenarioData]);
  
  // Strategy mapping
  const strategyMap: Record<string, 'LMS' | 'ADD' | 'APP'> = {
    lms: 'LMS',
    add: 'ADD',
    app: 'APP',
  };

  // Debounce save
  useEffect(() => {
    const timer = setTimeout(() => {
      if (explanation.trim()) {
        saveAnswer('textual_debriefing', explanation);
        updateSessionData({ textualDebriefing: explanation });
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [explanation]);

  const handleExplanationChange = (value: string) => {
    setExplanation(value);
    recordInteraction('click', { action: 'type_explanation', length: value.length });
  };

  const canProceed = explanation.trim().length > 0;
  
  if (!scenario) {
    return <div>Loading scenario...</div>;
  }

  const displayStrategy = session.explanationModality as ExplanationStrategy;
  const aggregationStrategy = strategyMap[session.aggregationStrategy];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Textual Debriefing
        </h1>
        <p className="text-gray-600">
          In your own words, provide a textual explanation to present to the group members, 
          explaining how the system made the recommendation for the group.
        </p>
      </div>

      {/* Show the first training scenario as reference */}
      <div className="border rounded-lg p-4 bg-gray-50">
        <h3 className="font-medium text-gray-700 mb-4">Reference Scenario:</h3>
        <InteractiveGroupRecommender
          strategy={aggregationStrategy}
          explanationStrategy={displayStrategy}
          sortBestToWorst={true}
          fadeNonContributing={false}
          scenario={scenario}
        />
      </div>

      {/* Explanation Input */}
      <div className="space-y-3">
        <Label htmlFor="explanation" className="text-lg font-medium text-gray-900">
          Your Explanation
        </Label>
        <p className="text-sm text-gray-500">
          Imagine you need to explain to the group members how the system arrived at its recommendation. 
          What would you tell them?
        </p>
        <Textarea
          id="explanation"
          value={explanation}
          onChange={(e) => handleExplanationChange(e.target.value)}
          placeholder="Write your explanation here..."
          className="min-h-40 resize-y"
          required
        />
        <p className="text-sm text-gray-400">
          {explanation.length} characters
        </p>
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
