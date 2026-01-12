"use client";

import { useState, useEffect, useMemo } from "react";
import { NextStep, useNextStep } from "nextstepjs";
import { NavigationButtons } from "../NavigationButtons";
import InteractiveGroupRecommender from "@/components/InteractiveGroupRecommender";
import { scenarios as allScenarios } from "@/lib/data/scenarios";
import { createScenarioFromData } from "@/lib/scenario_helpers";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import type { InteractionEvent, TrainingTaskData } from "@/lib/db";
import type { SessionData } from "../ExperimentFlow";
import type { ExplanationStrategy } from "@/lib/types";

// Define onboarding tour steps
const onboardingSteps = [
  {
    tour: "training-onboarding",
    steps: [
      {
        icon: "👋",
        title: "Welcome to the Training!",
        content:
          "This training will help you understand how the recommendation system works. Let's walk through the interface.",
        selector: '[data-onboarding="page-header"]',
        side: "bottom" as const,
        showControls: true,
        showSkip: true,
      },
      {
        icon: "📊",
        title: "Ratings Table",
        content:
          "This table shows how each group member rated the restaurants. Each row is a person, and each column is a restaurant. Ratings are from 1 (worst) to 5 (best).",
        selector:
          '[data-onboarding="ratings-table"], [data-onboarding="interactive-table"]',
        side: "bottom" as const,
        showControls: true,
        showSkip: true,
      },
      {
        icon: "🔘",
        title: "Visited Restaurants",
        content:
          "Grey columns indicate restaurants the group has already visited. The system will recommend from the unvisited restaurants.",
        selector: '[data-onboarding="grey-rows"]',
        side: "right" as const,
        showControls: true,
        showSkip: true,
      },
      {
        icon: "🎯",
        title: "System Recommendation",
        content:
          "Based on the ratings and the aggregation strategy, the system recommends the best restaurant for the group. This is shown in the explanation area below the table.",
        selector: '[data-onboarding="footer-actions"]',
        side: "top" as const,
        showControls: true,
        showSkip: false,
      },
    ],
  },
];

interface TrainingScreenProps {
  session: SessionData;
  saveAnswer: (field: string, value: unknown) => Promise<void>;
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

  // NextStep hook for onboarding tour
  const { startNextStep } = useNextStep();

  // Get training scenario IDs from session
  const trainingScenarioIds = session.trainingScenarioIds;

  // Start onboarding tour on first task, step 2 (explore_explanation)
  useEffect(() => {
    if (
      currentTaskIndex === 0 &&
      currentStep === "explore_explanation" &&
      !hasShownOnboarding
    ) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        startNextStep("training-onboarding");
        setHasShownOnboarding(true);
        recordInteraction("view", { action: "onboarding_started" });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [
    currentTaskIndex,
    currentStep,
    hasShownOnboarding,
    startNextStep,
    recordInteraction,
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

  // Get non-visited restaurants for radio options
  const availableRestaurants = useMemo(() => {
    if (!currentScenario) return [];
    return currentScenario.restaurants.filter((r) => !r.visited);
  }, [currentScenario]);

  // Strategy mapping
  const strategyMap: Record<string, "LMS" | "ADD" | "APP"> = {
    lms: "LMS",
    add: "ADD",
    app: "APP",
  };

  // Reset state when task changes
  useEffect(() => {
    setCurrentStep("initial_guess");
    setInitialGuess(null);
    setFinalDecision(null);
    setTaskStartTime(new Date().toISOString());
    setTaskInteractions([]);
  }, [currentTaskIndex]);

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

  // Save current task data
  const saveTaskData = async () => {
    const taskData: TrainingTaskData = {
      scenarioId: trainingScenarioIds[currentTaskIndex],
      step1Answer: initialGuess,
      step3Answer: finalDecision,
      interactions: taskInteractions,
      startTime: taskStartTime,
      endTime: new Date().toISOString(),
    };

    const updatedTasks = [...session.trainingTasksData];
    updatedTasks[currentTaskIndex] = taskData;

    await saveAnswer("training_tasks_data", updatedTasks);
    updateSessionData({ trainingTasksData: updatedTasks });
  };

  // Handle step transitions
  const handleNextStep = async () => {
    if (currentStep === "initial_guess") {
      recordTaskInteraction("click", {
        action: "complete_initial_guess",
        answer: initialGuess,
      });
      setCurrentStep("explore_explanation");
    } else if (currentStep === "explore_explanation") {
      recordTaskInteraction("click", { action: "complete_exploration" });
      setCurrentStep("final_decision");
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
    if (currentStep === "explore_explanation") return true;
    if (currentStep === "final_decision") return finalDecision !== null;
    return false;
  };

  if (!currentScenario || !currentScenarioData) {
    return <div>Loading scenario...</div>;
  }

  // Get explanation strategy for display
  const displayStrategy = session.explanationModality as ExplanationStrategy;
  const aggregationStrategy = strategyMap[session.aggregationStrategy];

  return (
    <NextStep steps={onboardingSteps}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">
              Training Task {currentTaskIndex + 1} of{" "}
              {trainingScenarioIds.length}
            </h1>
            <p className="text-gray-600 text-sm">
              {currentStep === "initial_guess" &&
                "The following tasks are to make you familiar with the system and the task."}
              {currentStep === "explore_explanation" &&
                "Using the provided ratings, the software system made a recommendation to the group." +
                  (displayStrategy !== "no_expl" &&
                  displayStrategy !== "static_list"
                    ? " Edit a few ratings to see how the recommendation changes."
                    : "")}
              {currentStep === "final_decision" &&
                "Given the advice of the recommender system, what is your final decision for the best restaurant to go to."}
            </p>
          </div>
          <div className="text-sm text-gray-500">
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
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <h3 className="font-medium text-yellow-800 mb-1 text-sm">
                Which restaurant would you think is best for the group&apos;s
                next dinner, given the preferences in the table?
              </h3>
            </div>

            {/* Show only the table without explanation */}
            <InteractiveGroupRecommender
              strategy={aggregationStrategy}
              explanationStrategy="no_expl"
              sortBestToWorst={true}
              fadeNonContributing={false}
              scenario={currentScenario}
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
              fadeNonContributing={false}
              scenario={currentScenario}
            />
          </div>
        )}

        {/* Step 3: Final Decision */}
        {currentStep === "final_decision" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  recordTaskInteraction("click", { action: "reset_to_initial" })
                }
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset to Initial Values
              </Button>
            </div>

            <InteractiveGroupRecommender
              strategy={aggregationStrategy}
              explanationStrategy={displayStrategy}
              sortBestToWorst={true}
              fadeNonContributing={false}
              scenario={currentScenario}
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
          onBack={handleBack}
          onNext={handleNextStep}
          canGoBack={true}
          canGoNext={canProceed()}
          isLoading={isLoading}
          nextLabel={
            currentStep === "final_decision" &&
            currentTaskIndex === trainingScenarioIds.length - 1
              ? "Complete Training"
              : currentStep === "final_decision"
              ? "Next Task"
              : "Continue"
          }
        />
      </div>
    </NextStep>
  );
}
