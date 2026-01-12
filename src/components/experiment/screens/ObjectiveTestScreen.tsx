'use client';

import { useState, useEffect, useMemo } from 'react';
import { NavigationButtons } from '../NavigationButtons';
import InteractiveGroupRecommender from '@/components/InteractiveGroupRecommender';
import { scenarios as allScenarios } from '@/lib/data/scenarios';
import { createScenarioFromData } from '@/lib/scenario_helpers';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import type { InteractionEvent, ObjectiveTaskData } from '@/lib/db';
import type { SessionData } from '../ExperimentFlow';
import type { ExplanationStrategy, ScenarioQuestion } from '@/lib/types';

interface ObjectiveTestScreenProps {
  session: SessionData;
  saveAnswer: (field: string, value: unknown) => Promise<void>;
  updateSessionData: (updates: Partial<SessionData>) => void;
  recordInteraction: (type: InteractionEvent['type'], data: Record<string, unknown>) => void;
  isLoading: boolean;
  onNext: () => void;
  onBack: () => void;
}

export function ObjectiveTestScreen({
  session,
  saveAnswer,
  updateSessionData,
  recordInteraction,
  isLoading,
  onNext,
  onBack,
}: ObjectiveTestScreenProps) {
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [taskStartTime, setTaskStartTime] = useState<string>(new Date().toISOString());
  const [taskInteractions, setTaskInteractions] = useState<InteractionEvent[]>([]);
  
  // Attention check state (shown on first counterfactual)
  const [attentionCheckAnswer, setAttentionCheckAnswer] = useState<boolean>(false);
  const [showAttentionCheck, setShowAttentionCheck] = useState(false);
  
  // Get test scenario IDs from session
  const testScenarioIds = session.testScenarioIds;
  
  // Get current scenario data
  const currentScenarioData = useMemo(() => {
    const scenarioId = testScenarioIds[currentTaskIndex];
    return allScenarios.find(s => s.id === scenarioId);
  }, [testScenarioIds, currentTaskIndex]);
  
  // Create scenario object for InteractiveGroupRecommender
  const currentScenario = useMemo(() => {
    if (!currentScenarioData) return null;
    return createScenarioFromData(currentScenarioData);
  }, [currentScenarioData]);
  
  // Get current question
  const currentQuestion: ScenarioQuestion | undefined = currentScenarioData?.questions[0];
  
  // Determine if this is the first counterfactual question (for attention check)
  const isFirstCounterfactual = useMemo(() => {
    if (!currentQuestion) return false;
    
    // Check if this is the first counterfactual in our test sequence
    const counterfactualIndices = testScenarioIds.map((id, idx) => {
      const scenario = allScenarios.find(s => s.id === id);
      return scenario?.questions[0]?.task === 'counterfactual' ? idx : -1;
    }).filter(idx => idx !== -1);
    
    return counterfactualIndices[0] === currentTaskIndex;
  }, [currentQuestion, testScenarioIds, currentTaskIndex]);
  
  // Show attention check for first counterfactual
  useEffect(() => {
    setShowAttentionCheck(isFirstCounterfactual);
  }, [isFirstCounterfactual]);
  
  // Strategy mapping
  const strategyMap: Record<string, 'LMS' | 'ADD' | 'APP'> = {
    lms: 'LMS',
    add: 'ADD',
    app: 'APP',
  };
  
  // Reset state when task changes
  useEffect(() => {
    setSelectedAnswer(null);
    setTaskStartTime(new Date().toISOString());
    setTaskInteractions([]);
    setAttentionCheckAnswer(false);
  }, [currentTaskIndex]);
  
  // Record task interaction
  const recordTaskInteraction = (type: InteractionEvent['type'], data: Record<string, unknown>) => {
    const interaction: InteractionEvent = {
      type,
      timestamp: new Date().toISOString(),
      data,
    };
    setTaskInteractions(prev => [...prev, interaction]);
    recordInteraction(type, data);
  };
  
  // Check if answer is correct
  const checkAnswer = (answer: string): boolean => {
    if (!currentQuestion?.choices) return false;
    const selectedChoice = currentQuestion.choices.find(c => c.value === answer);
    return selectedChoice?.isCorrectAnswer === true;
  };
  
  // Save current task data
  const saveTaskData = async () => {
    if (!currentQuestion) return;
    
    const taskData: ObjectiveTaskData = {
      scenarioId: testScenarioIds[currentTaskIndex],
      questionId: currentQuestion.id,
      taskType: currentQuestion.task,
      userAnswer: selectedAnswer,
      isCorrect: selectedAnswer ? checkAnswer(selectedAnswer) : null,
      isAttentionCheck: currentQuestion.isAttentionCheck || false,
      interactions: taskInteractions,
      startTime: taskStartTime,
      endTime: new Date().toISOString(),
    };
    
    const updatedTasks = [...session.objectiveTasksData];
    updatedTasks[currentTaskIndex] = taskData;
    
    await saveAnswer('objective_understanding_tasks_data', updatedTasks);
    updateSessionData({ objectiveTasksData: updatedTasks });
  };
  
  // Handle next task
  const handleNext = async () => {
    recordTaskInteraction('click', { action: 'submit_answer', answer: selectedAnswer });
    await saveTaskData();
    
    if (currentTaskIndex < testScenarioIds.length - 1) {
      setCurrentTaskIndex(prev => prev + 1);
    } else {
      onNext();
    }
  };
  
  // Handle back navigation
  const handleBack = () => {
    if (currentTaskIndex > 0) {
      setCurrentTaskIndex(prev => prev - 1);
    } else {
      onBack();
    }
  };
  
  // Check if can proceed (answer selected, and attention check if needed)
  const canProceed = selectedAnswer !== null && (!showAttentionCheck || attentionCheckAnswer);
  
  if (!currentScenario || !currentScenarioData || !currentQuestion) {
    return <div>Loading scenario...</div>;
  }

  // In the objective test phase, DON'T show explanations - use no_expl
  const displayStrategy: ExplanationStrategy = 'no_expl';
  const aggregationStrategy = strategyMap[session.aggregationStrategy];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">
            Understanding Test - Question {currentTaskIndex + 1} of {testScenarioIds.length}
          </h1>
          <p className="text-gray-600 text-sm">
            You will now be tested on your understanding of the system. Please answer the following questions based on your understanding.
          </p>
        </div>
        <div className="text-sm font-medium px-3 py-1 rounded bg-gray-100">
          {currentQuestion.task.replace('_', ' ')}
        </div>
      </div>

      {/* Scenario Display */}
      <InteractiveGroupRecommender
        strategy={aggregationStrategy}
        explanationStrategy={displayStrategy}
        sortBestToWorst={true}
        fadeNonContributing={false}
        scenario={currentScenario}
      />

      {/* Question */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <h3 className="font-medium text-blue-900 mb-3 text-sm">
          {currentQuestion.text}
        </h3>
        
        <RadioGroup
          value={selectedAnswer || ''}
          onValueChange={(value) => {
            setSelectedAnswer(value);
            recordTaskInteraction('click', { action: 'select_answer', value });
          }}
        >
          <div className="space-y-3">
            {currentQuestion.choices?.map((choice) => (
              <div key={choice.id} className="flex items-start space-x-3">
                <RadioGroupItem value={choice.value} id={choice.id} className="mt-1" />
                <Label htmlFor={choice.id} className="cursor-pointer text-gray-700">
                  {choice.text}
                </Label>
              </div>
            ))}
          </div>
        </RadioGroup>
      </div>

      {/* Attention Check (only for first counterfactual) */}
      {showAttentionCheck && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-medium text-yellow-800 mb-3">
            Attention Check
          </h4>
          <div className="flex items-start space-x-3">
            <Checkbox
              id="attention-check"
              checked={attentionCheckAnswer}
              onCheckedChange={(checked) => {
                setAttentionCheckAnswer(checked === true);
                recordTaskInteraction('click', { action: 'attention_check', checked });
              }}
            />
            <Label htmlFor="attention-check" className="cursor-pointer text-gray-700">
              Please check this box to confirm you are paying attention to the questions.
            </Label>
          </div>
        </div>
      )}

      {/* Navigation */}
      <NavigationButtons
        onBack={handleBack}
        onNext={handleNext}
        canGoBack={true}
        canGoNext={canProceed}
        isLoading={isLoading}
        nextLabel={currentTaskIndex === testScenarioIds.length - 1 ? 'Complete Test' : 'Next Question'}
      />
    </div>
  );
}
