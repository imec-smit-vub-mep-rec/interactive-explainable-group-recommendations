"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { NextStep, useNextStep } from "nextstepjs";
import { NavigationButtons } from "../NavigationButtons";
import InteractiveGroupRecommender from "@/components/InteractiveGroupRecommender";
import { scenarios as allScenarios } from "@/lib/data/scenarios";
import { questions } from "@/lib/data/questions";
import { createScenarioFromData } from "@/lib/scenario_helpers";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import type { ChatLogEntry } from "@/components/TextChat";
import type { InteractionEvent, TrainingTaskData } from "@/lib/db";
import type { SessionData } from "../ExperimentFlow";
import type { ExplanationStrategy, MultipleChoiceQuestion } from "@/lib/types";
import { onboardingTours, getTourForStrategy } from "@/lib/onboarding";

interface TrainingScreenProps {
  session: SessionData;
  saveAnswer: (field: string, value: unknown, sessionIdOverride?: string) => Promise<void>;
  updateSessionData: (updates: Partial<SessionData>) => void;
  recordInteraction: (
    type: InteractionEvent["type"],
    data: Record<string, unknown>
  ) => void;
  isLoading: boolean;
  onNext: () => void;
  onBack: () => void;
}

type TrainingStep = "initial_guess" | "explore_explanation" | "final_decision";

export function TrainingScreen({
  session,
  saveAnswer,
  updateSessionData,
  recordInteraction,
  isLoading,
  onNext,
  onBack,
}: TrainingScreenProps) {
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState<TrainingStep>("initial_guess");
  const [initialGuess, setInitialGuess] = useState<string | null>(null);
  const [finalDecision, setFinalDecision] = useState<string | null>(null);
  const [taskStartTime, setTaskStartTime] = useState<string>(
    new Date().toISOString()
  );
  const [taskInteractions, setTaskInteractions] = useState<InteractionEvent[]>(
    []
  );
  const [hasShownOnboarding, setHasShownOnboarding] = useState(false);
  const [tableRatingEdits, setTableRatingEdits] = useState(0);
  const [graphRatingEdits, setGraphRatingEdits] = useState(0);
  const [suggestionsClicked, setSuggestionsClicked] = useState<string[]>([]);
  const [typedQueries, setTypedQueries] = useState<string[]>([]);
  const [showProceedConfirm, setShowProceedConfirm] = useState(false);
  
  // Attention check state (shown ONLY in second task's step 2 - explore_explanation)
  const [attentionCheckAnswer, setAttentionCheckAnswer] = useState<string | null>(null);
  const [attentionCheckCompleted, setAttentionCheckCompleted] = useState(false);
  
  // Get attention check question from questions.ts
  const attentionCheckQuestion = questions.training?.questions[1] as MultipleChoiceQuestion | undefined;
  
  // Only show attention check in second training task's step 2
  const showAttentionCheck = currentTaskIndex === 1 && currentStep === "explore_explanation";

  // Ref to access resetRatings function from InteractiveGroupRecommender
  const resetRatingsRef = useRef<(() => void) | null>(null);

  // NextStep hook for onboarding tour
  const { startNextStep } = useNextStep();

  // Get training scenario IDs from session
  const trainingScenarioIds = session.trainingScenarioIds;

  // Get explanation strategy for display
  const displayStrategy = session.explanationModality as ExplanationStrategy;

  // Start onboarding tour on first task, step 2 (explore_explanation)
  useEffect(() => {
    if (
      currentTaskIndex === 0 &&
      currentStep === "explore_explanation" &&
      !hasShownOnboarding
    ) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        const tourName = getTourForStrategy(displayStrategy);
        if (tourName) {
          startNextStep(tourName);
          setHasShownOnboarding(true);
          recordInteraction("view", { action: "onboarding_started", tour: tourName });
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [
    currentTaskIndex,
    currentStep,
    hasShownOnboarding,
    startNextStep,
    recordInteraction,
    displayStrategy,
  ]);

  // Get current scenario data
  const currentScenarioData = useMemo(() => {
    const scenarioId = trainingScenarioIds[currentTaskIndex];
    return allScenarios.find((s) => s.id === scenarioId);
  }, [trainingScenarioIds, currentTaskIndex]);

  // Create scenario object for InteractiveGroupRecommender
  const currentScenario = useMemo(() => {
    if (!currentScenarioData) return null;
    return createScenarioFromData(currentScenarioData);
  }, [currentScenarioData]);

  // Get all restaurants for radio options, sorted by ID (1-10)
  const availableRestaurants = useMemo(() => {
    if (!currentScenario) return [];
    return [...currentScenario.restaurants].sort((a, b) => a.id - b.id);
  }, [currentScenario]);

  // Get visited restaurant names from previous_visits (zero-indexed → "Rest N")
  const visitedRestaurantNames = useMemo(() => {
    if (!currentScenarioData) return "";
    return currentScenarioData.previous_visits
      .map((idx) => `Rest ${idx + 1}`)
      .join(", ");
  }, [currentScenarioData]);

  // Strategy mapping
  const strategyMap: Record<string, "LMS" | "ADD" | "APP"> = {
    lms: "LMS",
    add: "ADD",
    app: "APP",
  };

  // Reset state when task changes
  useEffect(() => {
    const taskData = session.trainingTasksData[currentTaskIndex];

    if (taskData?.step3Answer) {
      setCurrentStep("final_decision");
    } else if (taskData?.step1Answer) {
      setCurrentStep("explore_explanation");
    } else {
      setCurrentStep("initial_guess");
    }

    setInitialGuess(taskData?.step1Answer ?? null);
    setFinalDecision(taskData?.step3Answer ?? null);
    setTaskStartTime(new Date().toISOString());
    setTaskInteractions([]);
    setTableRatingEdits(taskData?.interaction_table_rating_edits ?? 0);
    setGraphRatingEdits(taskData?.interactive_graph_rating_edits ?? 0);
    setSuggestionsClicked(
      taskData?.interaction_query_submissions?.click_suggestion?.suggestions_clicked ?? []
    );
    setTypedQueries(
      taskData?.interaction_query_submissions?.typed_query?.queries_submitted ?? []
    );
    setAttentionCheckAnswer(taskData?.attentionCheckAnswer ?? null);
    setAttentionCheckCompleted(Boolean(taskData?.attentionCheckAnswer));
  }, [currentTaskIndex, session.trainingTasksData]);

  // Record task interaction
  const recordTaskInteraction = (
    type: InteractionEvent["type"],
    data: Record<string, unknown>
  ) => {
    const interaction: InteractionEvent = {
      type,
      timestamp: new Date().toISOString(),
      data,
    };
    setTaskInteractions((prev) => [...prev, interaction]);
    recordInteraction(type, data);
  };

  // Handle chat log entries: record locally and async-save to DB
  const handleChatLogEntry = (entry: ChatLogEntry) => {
    // Record as a standard interaction event
    recordTaskInteraction("chat_message", {
      chatLogRole: entry.role,
      chatLogContent: entry.content,
      chatLogTimestamp: entry.timestamp,
      ...entry.metadata,
    });

    // Async fire-and-forget save to dedicated chat_logs column
    if (session.id) {
      const logEntry = {
        ...entry,
        scenarioId: trainingScenarioIds[currentTaskIndex],
        taskIndex: currentTaskIndex,
        step: currentStep,
      };
      fetch("/api/experiment/chat-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, entry: logEntry }),
      }).catch((err) => {
        console.error("Failed to save chat log entry:", err);
      });
    }
  };

  // Save current task data
  const saveTaskData = async () => {
    const taskData: TrainingTaskData = {
      scenarioId: trainingScenarioIds[currentTaskIndex],
      step1Answer: initialGuess,
      step3Answer: finalDecision,
      attentionCheckAnswer,
      interactions: taskInteractions,
      interaction_table_rating_edits: tableRatingEdits,
      interactive_graph_rating_edits: graphRatingEdits,
      interaction_query_submissions: {
        click_suggestion: {
          count: suggestionsClicked.length,
          suggestions_clicked: suggestionsClicked,
        },
        typed_query: {
          count: typedQueries.length,
          queries_submitted: typedQueries,
        },
      },
      startTime: taskStartTime,
      endTime: new Date().toISOString(),
    };

    const updatedTasks = [...session.trainingTasksData];
    updatedTasks[currentTaskIndex] = taskData;

    await saveAnswer("training_tasks_data", updatedTasks);
    updateSessionData({ trainingTasksData: updatedTasks });
    
    // Save attention check answer if provided
    if (attentionCheckAnswer !== null) {
      const isCorrect = attentionCheckAnswer === '4'; // Restaurant 4 is the correct answer
      await saveAnswer('attn_check_1', {
        answer: attentionCheckAnswer,
        isCorrect,
        timestamp: new Date().toISOString(),
      });
    }
  };

  // Handle step transitions
  const handleProceedFromExplore = () => {
    recordTaskInteraction("click", { action: "complete_exploration" });
    // Mark attention check as completed after second task's step 2
    if (currentTaskIndex === 1 && attentionCheckAnswer !== null) {
      setAttentionCheckCompleted(true);
    }
    setCurrentStep("final_decision");
  };

  const handleNextStep = async () => {
    if (currentStep === "initial_guess") {
      recordTaskInteraction("click", {
        action: "complete_initial_guess",
        answer: initialGuess,
      });
      setCurrentStep("explore_explanation");
    } else if (currentStep === "explore_explanation") {
      const isInteractiveCondition =
        displayStrategy !== "no_expl" && displayStrategy !== "static_list";
      const hasInteracted =
        tableRatingEdits > 0 ||
        graphRatingEdits > 0 ||
        suggestionsClicked.length > 0 ||
        typedQueries.length > 0;
      if (isInteractiveCondition && !hasInteracted) {
        setShowProceedConfirm(true);
        return;
      }
      handleProceedFromExplore();
    } else if (currentStep === "final_decision") {
      recordTaskInteraction("click", {
        action: "complete_final_decision",
        answer: finalDecision,
      });
      await saveTaskData();

      if (currentTaskIndex < trainingScenarioIds.length - 1) {
        setCurrentTaskIndex((prev) => prev + 1);
      } else {
        // All training tasks complete
        onNext();
      }
    }
  };

  // Handle back navigation within training
  const handleBack = () => {
    if (currentStep === "explore_explanation") {
      setCurrentStep("initial_guess");
    } else if (currentStep === "final_decision") {
      setCurrentStep("explore_explanation");
    } else if (currentTaskIndex > 0) {
      setCurrentTaskIndex((prev) => prev - 1);
      setCurrentStep("final_decision");
    } else {
      onBack();
    }
  };

  // Determine if can proceed
  const canProceed = () => {
    if (currentStep === "initial_guess") return initialGuess !== null;
    if (currentStep === "explore_explanation") {
      // Only require attention check answer on second task
      if (currentTaskIndex === 1 && !attentionCheckCompleted) {
        return attentionCheckAnswer !== null;
      }
      return true;
    }
    if (currentStep === "final_decision") return finalDecision !== null;
    return false;
  };

  if (!currentScenario || !currentScenarioData) {
    return <div>Loading scenario...</div>;
  }

  const aggregationStrategy = strategyMap[session.aggregationStrategy];

  return (
    <NextStep steps={onboardingTours}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div data-onboarding="page-header">
            <h1 className="text-xl font-bold text-gray-900 mb-1">
              Training Task {currentTaskIndex + 1} of{" "}
              {trainingScenarioIds.length}
            </h1>
            {currentStep === "initial_guess" && (
              <p className="text-gray-600 text-sm">
                Assume that there is a group of friends, different from the ones you have seen before.
              </p>
            )}
            {currentStep === "explore_explanation" && (
              <p className="text-gray-600 text-sm">
                {"Using the provided ratings, the software system made a recommendation to the group." +
                (displayStrategy !== "no_expl" &&
                  displayStrategy !== "static_list"
                  ? " Edit a few ratings to see how the recommendation changes."
                  : "")}
              </p>
            )}
            {currentStep === "final_decision" && (
              <p className="text-gray-600 text-sm">
                Given the advice of the recommender system, what is your final decision for the best restaurant to go to.
              </p>
            )}
          </div>
          <div className="text-sm text-gray-500 min-w-24">
            Step{" "}
            {currentStep === "initial_guess"
              ? 1
              : currentStep === "explore_explanation"
                ? 2
                : 3}{" "}
            of 3
          </div>
        </div>

        {/* Step 1: Initial Guess - Show only table */}
        {currentStep === "initial_guess" && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-gray-700 space-y-2">
              <p>
                Every month, a group decision is made by these friends to decide on a restaurant to have dinner together. To select a restaurant for the dinner next month, the group again has to take the same decision. In this decision, each group member explicitly rated three possible restaurants using a 5-star rating scale (1: the worst, 5: the best). The ratings given by group members are shown in the table below.
              </p>
              <p>
              <strong>{visitedRestaurantNames}</strong> have been visited in the previous months, in this specific order. These restaurants are not an option anymore, as the group has already eaten there previously.
              </p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <h3 className="font-medium text-yellow-800 mb-1 text-sm">
                Which restaurant will the system recommend for the group&apos;s
                next dinner, given the preferences in the table?
              </h3>
            </div>

            {/* Show only the table without explanation */}
            <InteractiveGroupRecommender
              strategy={aggregationStrategy}
              explanationStrategy="no_expl"
              sortBestToWorst={true}
              fadeNonContributing={displayStrategy === "interactive_graph"}
              scenario={currentScenario}
              hideExplanation={true}
            />

            {/* Radio selection */}
            <div className="bg-white border rounded-lg p-3">
              <h4 className="font-medium mb-3 text-sm">Select your answer:</h4>
              <RadioGroup
                value={initialGuess || ""}
                onValueChange={(value) => {
                  setInitialGuess(value);
                  recordTaskInteraction("click", {
                    action: "select_initial_guess",
                    value,
                  });
                }}
              >
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {availableRestaurants.map((restaurant) => (
                    <div
                      key={restaurant.id}
                      className="flex items-center space-x-2"
                    >
                      <RadioGroupItem
                        value={restaurant.name}
                        id={`initial-${restaurant.id}`}
                      />
                      <Label
                        htmlFor={`initial-${restaurant.id}`}
                        className="cursor-pointer"
                      >
                        {restaurant.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>
          </div>
        )}

        {/* Step 2: Explore Explanation */}
        {currentStep === "explore_explanation" && (
          <div className="space-y-4">
            <InteractiveGroupRecommender
              strategy={aggregationStrategy}
              explanationStrategy={displayStrategy}
              sortBestToWorst={true}
              fadeNonContributing={displayStrategy === "interactive_graph"}
              scenario={currentScenario}
              onResetRatingsRef={resetRatingsRef}
              onTableRatingChange={(event) => {
                setTableRatingEdits((prev) => prev + 1);
                recordTaskInteraction("rating_change", {
                  source: "table",
                  ...event,
                });
              }}
              onGraphRatingChange={(event) => {
                setGraphRatingEdits((prev) => prev + 1);
                recordTaskInteraction("rating_change", {
                  source: "graph",
                  ...event,
                });
              }}
              onSuggestionClick={(suggestion) => {
                setSuggestionsClicked((prev) => [...prev, suggestion]);
                recordTaskInteraction("chat_message", {
                  source: "suggestion",
                  query: suggestion,
                });
              }}
              onTypedQuerySubmit={(query) => {
                setTypedQueries((prev) => [...prev, query]);
                recordTaskInteraction("chat_message", {
                  source: "typed_query",
                  query,
                });
              }}
              onChatLogEntry={handleChatLogEntry}
            />
            
            {/* Attention Check - only shown in first training task */}
            {showAttentionCheck && attentionCheckQuestion && (
              <div className="bg-white border rounded-lg p-3">
                <h4 className="font-medium mb-3 text-sm">
                  {attentionCheckQuestion.text}
                </h4>
                <RadioGroup
                  value={attentionCheckAnswer || ''}
                  onValueChange={(value) => {
                    setAttentionCheckAnswer(value);
                    recordTaskInteraction('click', { action: 'attention_check', questionId: 'attn_check_1', value });
                  }}
                >
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {attentionCheckQuestion.choices?.map((choice) => (
                      <div key={choice.id} className="flex items-center space-x-2">
                        <RadioGroupItem value={choice.value} id={`attn-${choice.id}`} />
                        <Label htmlFor={`attn-${choice.id}`} className="cursor-pointer">
                          {choice.text}
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Final Decision */}
        {currentStep === "final_decision" && (
          <div className="space-y-4">

            <InteractiveGroupRecommender
              strategy={aggregationStrategy}
              explanationStrategy={displayStrategy}
              sortBestToWorst={true}
              fadeNonContributing={displayStrategy === "interactive_graph"}
              scenario={currentScenario}
              onResetRatingsRef={resetRatingsRef}
              onTableRatingChange={(event) => {
                setTableRatingEdits((prev) => prev + 1);
                recordTaskInteraction("rating_change", {
                  source: "table",
                  ...event,
                });
              }}
              onGraphRatingChange={(event) => {
                setGraphRatingEdits((prev) => prev + 1);
                recordTaskInteraction("rating_change", {
                  source: "graph",
                  ...event,
                });
              }}
              onSuggestionClick={(suggestion) => {
                setSuggestionsClicked((prev) => [...prev, suggestion]);
                recordTaskInteraction("chat_message", {
                  source: "suggestion",
                  query: suggestion,
                });
              }}
              onTypedQuerySubmit={(query) => {
                setTypedQueries((prev) => [...prev, query]);
                recordTaskInteraction("chat_message", {
                  source: "typed_query",
                  query,
                });
              }}
              onChatLogEntry={handleChatLogEntry}
            />

            {/* Radio selection for final decision */}
            <div className="bg-white border rounded-lg p-4">
              <h4 className="font-medium mb-4">
                Given the advice of the recommender system, what is your final
                decision?
              </h4>
              <RadioGroup
                value={finalDecision || ""}
                onValueChange={(value) => {
                  setFinalDecision(value);
                  recordTaskInteraction("click", {
                    action: "select_final_decision",
                    value,
                  });
                }}
              >
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {availableRestaurants.map((restaurant) => (
                    <div
                      key={restaurant.id}
                      className="flex items-center space-x-2"
                    >
                      <RadioGroupItem
                        value={restaurant.name}
                        id={`final-${restaurant.id}`}
                      />
                      <Label
                        htmlFor={`final-${restaurant.id}`}
                        className="cursor-pointer"
                      >
                        {restaurant.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>
          </div>
        )}

        {/* Navigation */}
        <NavigationButtons
          explanationStrategy={displayStrategy}
          currentStep={currentStep}
          onBack={handleBack}
          onNext={handleNextStep}
          canGoBack={true}
          canGoNext={canProceed()}
          isLoading={isLoading}
          onResetRatings={() => resetRatingsRef.current?.()}
          nextLabel={
            currentStep === "final_decision" &&
              currentTaskIndex === trainingScenarioIds.length - 1
              ? "Complete Training"
              : currentStep === "final_decision"
                ? "Next Task"
                : "Continue"
          }
        />
        {showProceedConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowProceedConfirm(false)}
            />
            <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Proceed without interaction?
              </h3>
              <p className="text-gray-600 mb-6">
                Do you really want to proceed without having interacted with the
                system?
              </p>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowProceedConfirm(false)}
                >
                  Stay
                </Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => {
                    setShowProceedConfirm(false);
                    handleProceedFromExplore();
                  }}
                >
                  Proceed
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </NextStep>
  );
}
