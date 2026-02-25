'use client';

import { useState, useEffect, useMemo } from 'react';
import { NavigationButtons } from '../NavigationButtons';
import InteractiveGroupRecommender from '@/components/InteractiveGroupRecommender';
import { scenarios as allScenarios } from '@/lib/data/scenarios';
import { questions } from '@/lib/data/questions';
import { createScenarioFromData } from '@/lib/scenario_helpers';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { InteractionEvent, ObjectiveTaskData } from '@/lib/db';
import type { SessionData } from '../ExperimentFlow';
import type { ExplanationStrategy, ScenarioQuestion, MultipleChoiceQuestion } from '@/lib/types';

interface ObjectiveTestScreenProps {
  session: SessionData;
  saveAnswer: (field: string, value: unknown, sessionIdOverride?: string) => Promise<void>;
  updateSessionData: (updates: Partial<SessionData>) => void;
  recordInteraction: (type: InteractionEvent['type'], data: Record<string, unknown>) => void;
  isLoading: boolean;
  onNext: () => void;
  onBack?: () => void;
}

export function ObjectiveTestScreen({
  session,
  saveAnswer,
  updateSessionData,
  recordInteraction,
  isLoading,
  onNext,
}: ObjectiveTestScreenProps) {
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [taskStartTime, setTaskStartTime] = useState<string>(new Date().toISOString());
  const [taskInteractions, setTaskInteractions] = useState<InteractionEvent[]>([]);
  const [showBreather, setShowBreather] = useState(false);
  
  // Attention check state (shown on 4th question, index 3)
  const [attentionCheckAnswer, setAttentionCheckAnswer] = useState<string | null>(null);
  
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
  
  // Get visited restaurant names from previous_visits (zero-indexed → "Rest N")
  const visitedRestaurantNames = useMemo(() => {
    if (!currentScenarioData) return "";
    return currentScenarioData.previous_visits
      .map((idx) => `Rest ${idx + 1}`)
      .join(", ");
  }, [currentScenarioData]);

  // Get current question
  const currentQuestion: ScenarioQuestion | undefined = currentScenarioData?.questions[0];
  
  // Show attention check on 4th question (index 3)
  const showAttentionCheck = currentTaskIndex === 3;
  
  // Get attention check question from questions.ts
  const attentionCheckQuestion = questions.objective_attention_checks?.questions[0] as MultipleChoiceQuestion | undefined;
  
  // Strategy mapping
  const strategyMap: Record<string, 'LMS' | 'ADD' | 'APP'> = {
    lms: 'LMS',
    add: 'ADD',
    app: 'APP',
  };
  
  // Reset state when task changes
  useEffect(() => {
    const taskData = session.objectiveTasksData[currentTaskIndex];
    setSelectedAnswer(taskData?.userAnswer ?? null);
    setTaskStartTime(new Date().toISOString());
    setTaskInteractions([]);
    setAttentionCheckAnswer(taskData?.attentionCheckAnswer ?? null);
  }, [currentTaskIndex, session.objectiveTasksData]);
  
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
      attentionCheckAnswer,
      interactions: taskInteractions,
      startTime: taskStartTime,
      endTime: new Date().toISOString(),
    };
    
    const updatedTasks = [...session.objectiveTasksData];
    updatedTasks[currentTaskIndex] = taskData;
    
    await saveAnswer('objective_understanding_tasks_data', updatedTasks);
    updateSessionData({ objectiveTasksData: updatedTasks });
    
    // Save attention check answer if shown on this question
    if (showAttentionCheck && attentionCheckAnswer !== null) {
      const isCorrect = attentionCheckAnswer === '3'; // Restaurant 3 is the correct answer
      await saveAnswer('attn_check_2', {
        answer: attentionCheckAnswer,
        isCorrect,
        timestamp: new Date().toISOString(),
      });
    }
  };
  
  // Handle next task
  const handleNext = async () => {
    recordTaskInteraction('click', { action: 'submit_answer', answer: selectedAnswer });
    await saveTaskData();
    
    if (currentTaskIndex === 2 && !showBreather) {
      setShowBreather(true);
      return;
    }

    if (currentTaskIndex < testScenarioIds.length - 1) {
      setCurrentTaskIndex(prev => prev + 1);
    } else {
      onNext();
    }
  };

  const handleBreatherContinue = () => {
    setShowBreather(false);
    setCurrentTaskIndex(prev => prev + 1);
  };
  
  // Handle back navigation within test (no cross-screen back)
  const handleBack = () => {
    if (currentTaskIndex > 0) {
      setCurrentTaskIndex(prev => prev - 1);
    }
    // At first question: no within-screen back, do nothing
  };
  
  // Check if can proceed (answer selected, and attention check if needed)
  const canProceed = selectedAnswer !== null && (!showAttentionCheck || attentionCheckAnswer !== null);
  
  if (showBreather) {
    return (
      <div className="space-y-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Breather</h1>
        <p className="text-gray-600">
          Feel free to take a short break. Grab a glass of water or a cup of coffee
          if you like.
        </p>
        <div>
          <Button onClick={handleBreatherContinue}>Continue</Button>
        </div>
      </div>
    );
  }

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
            Test - Question {currentTaskIndex + 1} of {testScenarioIds.length}
          </h1>
          <p className="text-gray-600 text-sm">
            You will now be tested on your understanding of the system. Please answer the following questions based on your understanding. Each time you will be presented with a different scenario.
          </p>
        </div>
      </div>

      {/* Scenario Display */}
      <InteractiveGroupRecommender
        strategy={aggregationStrategy}
        explanationStrategy={displayStrategy}
        sortBestToWorst={true}
        fadeNonContributing={false}
        scenario={currentScenario}
        hideExplanation={true}
      />

      {/* Question */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
       
        <h3 className="font-medium text-blue-900 mb-3 text-sm">
          {currentQuestion.text}
        </h3>
        <p className="text-sm text-gray-600 mb-2 italic">
          Remember, they do not want to visit <strong>{visitedRestaurantNames}</strong> again.
        </p>
        
        <RadioGroup
          value={selectedAnswer || ''}
          onValueChange={(value) => {
            setSelectedAnswer(value);
            recordTaskInteraction('click', { action: 'select_answer', value });
          }}
        >
          <div className="space-y-3">
            {currentQuestion.choices?.map((choice) => (
              <div key={choice.id} className="flex items-center space-x-3">
                <RadioGroupItem value={choice.value} id={choice.id} />
                <Label htmlFor={choice.id} className="cursor-pointer text-gray-700">
                  {choice.text}
                </Label>
              </div>
            ))}
          </div>
        </RadioGroup>
      </div>

      {/* Attention Check (shown on 4th question) */}
      {showAttentionCheck && attentionCheckQuestion && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <h3 className="font-medium text-blue-900 mb-3 text-sm">
            {attentionCheckQuestion.text}
          </h3>
          <RadioGroup
            value={attentionCheckAnswer || ''}
            onValueChange={(value) => {
              setAttentionCheckAnswer(value);
              recordTaskInteraction('click', { action: 'attention_check', questionId: 'attn_check_2', value });
            }}
          >
            <div className="space-y-3">
              {attentionCheckQuestion.choices?.map((choice) => (
                <div key={choice.id} className="flex items-center space-x-3">
                  <RadioGroupItem value={choice.value} id={`attn-${choice.id}`} />
                  <Label htmlFor={`attn-${choice.id}`} className="cursor-pointer text-gray-700">
                    {choice.text}
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        </div>
      )}

      {/* Navigation */}
      <NavigationButtons
        onBack={handleBack}
        onNext={handleNext}
        canGoBack={currentTaskIndex > 0}
        canGoNext={canProceed}
        isLoading={isLoading}
        nextLabel={currentTaskIndex === testScenarioIds.length - 1 ? 'Complete Test' : 'Next Question'}
      />
    </div>
  );
}
