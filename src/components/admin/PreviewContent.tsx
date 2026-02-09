'use client';

import { useState } from 'react';
import { ExperimentFlow, type SessionData } from '@/components/experiment/ExperimentFlow';
import { SCREENS, SCREEN_NAMES } from '@/lib/experiment-utils';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Mock session data for preview
function createMockSession(explanationModality: 'no_expl' | 'static_list' | 'interactive_list' | 'conversational' | 'interactive_graph' = 'interactive_graph'): SessionData {
  return {
    id: 'preview-session-' + Date.now(),
    explanationModality,
    aggregationStrategy: 'lms',
    trainingScenarioIds: ['scenario-1', 'scenario-2', 'scenario-3'],
    testScenarioIds: ['test-1', 'test-2', 'test-3', 'test-4', 'test-5', 'test-6'],
    currentScreen: SCREENS.WELCOME,
    isCompleted: false,
    demographics: {
      ageRange: '26_35',
      gender: 'prefer_not_to_say',
    },
    trainingTasksData: [
      {
        scenarioId: 'scenario-1',
        step1Answer: '4',
        step3Answer: '4',
        interactions: [],
        interaction_table_rating_edits: 0,
        interactive_graph_rating_edits: 0,
        interaction_query_submissions: {
          click_suggestion: {
            count: 0,
            suggestions_clicked: [],
          },
          typed_query: {
            count: 0,
            queries_submitted: [],
          },
        },
        startTime: new Date().toISOString(),
        endTime: null,
      },
    ],
    preliminaryUnderstanding: {
      understand: 5,
      predict: 4,
    },
    objectiveTasksData: [
      {
        scenarioId: 'test-1',
        questionId: 'q1',
        taskType: 'model_simulation',
        userAnswer: 'option-a',
        isCorrect: true,
        isAttentionCheck: false,
        interactions: [],
        startTime: new Date().toISOString(),
        endTime: null,
      },
    ],
    repeatUnderstanding: {
      understand: 5,
      predict: 5,
    },
    textualDebriefing: 'This is a preview of the debriefing screen.',
    nasaTlxData: {
      mental_demand: 5,
      physical_demand: 2,
      temporal_demand: 4,
      performance: 4,
      effort: 3,
      frustration: 2,
    },
    additionalFeedback: 'Preview feedback text.',
    screenTimings: [],
  };
}

export default function PreviewContent() {
  const [selectedScreen, setSelectedScreen] = useState<number>(SCREENS.WELCOME);
  const [explanationModality, setExplanationModality] = useState<'no_expl' | 'static_list' | 'interactive_list' | 'conversational' | 'interactive_graph'>('interactive_graph');
  const [mockSession, setMockSession] = useState<SessionData>(() => createMockSession('interactive_graph'));

  const handleScreenChange = (screenValue: string) => {
    const screenIndex = parseInt(screenValue);
    setSelectedScreen(screenIndex);
    // Update mock session to reflect the selected screen
    setMockSession(prev => ({
      ...prev,
      currentScreen: screenIndex,
    }));
  };

  const handleModalityChange = (modality: string) => {
    const typedModality = modality as 'no_expl' | 'static_list' | 'interactive_list' | 'conversational' | 'interactive_graph';
    setExplanationModality(typedModality);
    setMockSession(createMockSession(typedModality));
  };

  const screenOptions = Object.entries(SCREEN_NAMES).map(([index, name]) => ({
    value: index,
    label: name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' '),
    index: parseInt(index),
  }));

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Screen Preview & Debug</h1>
            <p className="text-gray-600">
              Select a screen to preview and debug. Changes made here won&apos;t be saved to the database.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="screen-select">Select Screen</Label>
              <Select
                value={selectedScreen.toString()}
                onValueChange={handleScreenChange}
              >
                <SelectTrigger id="screen-select" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {screenOptions.map((option) => (
                    <SelectItem key={option.index} value={option.value}>
                      {option.index}: {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="modality-select">Explanation Modality</Label>
              <Select
                value={explanationModality}
                onValueChange={handleModalityChange}
              >
                <SelectTrigger id="modality-select" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no_expl">No Explanation</SelectItem>
                  <SelectItem value="static_list">Static List</SelectItem>
                  <SelectItem value="interactive_list">Interactive List</SelectItem>
                  <SelectItem value="conversational">Conversational</SelectItem>
                  <SelectItem value="interactive_graph">Interactive Graph</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-50 rounded-md">
            <p className="text-sm text-blue-800">
              <strong>Current Screen:</strong> {SCREEN_NAMES[selectedScreen]} (Index: {selectedScreen})
            </p>
            <p className="text-sm text-blue-800 mt-1">
              <strong>Modality:</strong> {explanationModality}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
          <ExperimentFlow
            key={`preview-${selectedScreen}-${explanationModality}`}
            initialSession={{
              ...mockSession,
              currentScreen: selectedScreen,
            }}
          />
        </div>
      </div>
    </div>
  );
}
