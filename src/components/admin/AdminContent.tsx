"use client";

import { useState, useEffect, useRef } from "react";
import { Settings, LogOut } from "lucide-react";
import { NextStep, useNextStep } from "nextstepjs";
import { useRouter } from "next/navigation";
import InteractiveGroupRecommender from "@/components/InteractiveGroupRecommender";
import SettingsSidebar from "@/components/SettingsSidebar";
import { Button } from "@/components/ui/button";
import {
  Scenario,
  getScenarioById,
  getRandomScenarioByType,
} from "@/lib/scenario_helpers";
import { ExplanationStrategy } from "@/lib/types";
import { onboardingTours, getTourForStrategy } from "@/lib/onboarding";

type AggregationStrategy = "LMS" | "ADD" | "APP";

export default function AdminContent() {
  const router = useRouter();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [strategy, setStrategy] = useState<AggregationStrategy>("LMS");
  const [explanationStrategy, setExplanationStrategy] =
    useState<ExplanationStrategy>("no_expl");
  const [sortBestToWorst, setSortBestToWorst] = useState(false);
  const [fadeNonContributing, setFadeNonContributing] = useState(false);
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const { startNextStep } = useNextStep();
  const prevExplanationStrategy = useRef<ExplanationStrategy | null>(null);

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.refresh();
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const scenarioParam = urlParams.get("scenario");

    if (scenarioParam) {
      const scenario = getScenarioById(scenarioParam);
      if (scenario) {
        setCurrentScenario(scenario);
      } else {
        const strategyType = strategy.toLowerCase() as "add" | "lms" | "app";
        setCurrentScenario(getRandomScenarioByType(strategyType));
      }
    } else {
      const strategyType = strategy.toLowerCase() as "add" | "lms" | "app";
      setCurrentScenario(getRandomScenarioByType(strategyType));
    }

    setIsInitialized(true);
  }, [strategy]);

  useEffect(() => {
    if (!isInitialized || !currentScenario) return;

    const strategyType = strategy.toLowerCase() as "add" | "lms" | "app";
    if (currentScenario.type !== strategyType) {
      setCurrentScenario(getRandomScenarioByType(strategyType));
    }
  }, [strategy, currentScenario, isInitialized]);

  useEffect(() => {
    if (!isInitialized || !currentScenario) return;

    const tourName = getTourForStrategy(explanationStrategy);

    if (
      tourName &&
      prevExplanationStrategy.current !== null &&
      prevExplanationStrategy.current !== explanationStrategy
    ) {
      setTimeout(() => {
        startNextStep(tourName);
      }, 300);
    }

    prevExplanationStrategy.current = explanationStrategy;
  }, [explanationStrategy, isInitialized, currentScenario, startNextStep]);

  return (
    <>
      <NextStep steps={onboardingTours}>
        <div className="min-h-screen bg-gray-100 py-4">
        {/* Settings Icon */}
        <div className="fixed top-4 left-4 z-30 flex gap-2">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-3 bg-white rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
            title="Open Settings"
          >
            <Settings className="w-6 h-6 text-gray-600" />
          </button>
          <Button
            onClick={handleLogout}
            variant="outline"
            className="p-3 bg-white rounded-lg shadow-lg hover:bg-gray-50"
            title="Logout"
          >
            <LogOut className="w-6 h-6 text-gray-600" />
          </Button>
        </div>

        {/* Settings Sidebar */}
        {currentScenario && (
          <SettingsSidebar
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            strategy={strategy}
            onStrategyChange={setStrategy}
            explanationStrategy={explanationStrategy}
            onExplanationStrategyChange={setExplanationStrategy}
            sortBestToWorst={sortBestToWorst}
            onSortBestToWorstChange={setSortBestToWorst}
            fadeNonContributing={fadeNonContributing}
            onFadeNonContributingChange={setFadeNonContributing}
            currentScenario={currentScenario}
            onScenarioChange={setCurrentScenario}
          />
        )}

        {/* Main Content */}
        <div
          className={`transition-all duration-300 ${
            isSettingsOpen ? "ml-96" : "ml-0"
          }`}
        >
          {!isInitialized || !currentScenario ? (
            <div className="flex items-center justify-center min-h-screen">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading scenario...</p>
              </div>
            </div>
          ) : (
            <InteractiveGroupRecommender
              strategy={strategy}
              explanationStrategy={explanationStrategy}
              sortBestToWorst={sortBestToWorst}
              fadeNonContributing={fadeNonContributing}
              scenario={currentScenario}
            />
          )}
        </div>
      </div>
      </NextStep>
    </>
  );
}
