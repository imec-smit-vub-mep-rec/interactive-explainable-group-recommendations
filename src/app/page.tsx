"use client";

import { useState, useEffect } from "react";
import { Settings } from "lucide-react";
import InteractiveGroupRecommender from "@/components/InteractiveGroupRecommender";
import SettingsSidebar from "@/components/SettingsSidebar";
import { Scenario, getRandomScenario, getScenarioById, getRandomScenarioByType } from "@/lib/scenarios";

type AggregationStrategy = "LMS" | "ADD" | "APP";
type ExplanationStrategy =
  | "no_expl"
  | "text_expl"
  | "chat_expl"
  | "graph_expl"
  | "pie_expl"
  | "heatmap_expl"
  | "ordered_list_expl";

export default function Home() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [strategy, setStrategy] = useState<AggregationStrategy>("LMS");
  const [explanationStrategy, setExplanationStrategy] = useState<ExplanationStrategy>("no_expl");
  const [sortBestToWorst, setSortBestToWorst] = useState(false);
  const [fadeNonContributing, setFadeNonContributing] = useState(false);
  const [currentScenario, setCurrentScenario] = useState<Scenario>(getRandomScenario());

  // Handle query parameters and random scenario selection on page load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const scenarioParam = urlParams.get('scenario');
    
    if (scenarioParam) {
      const scenario = getScenarioById(scenarioParam);
      if (scenario) {
        setCurrentScenario(scenario);
      }
    } else {
      // Pick a random scenario for the current strategy if no scenario is specified
      const strategyType = strategy.toLowerCase() as "add" | "lms" | "app";
      setCurrentScenario(getRandomScenarioByType(strategyType));
    }
  }, []);

  // Auto-switch scenario when strategy changes
  useEffect(() => {
    const strategyType = strategy.toLowerCase() as "add" | "lms" | "app";
    // Only switch if current scenario doesn't match the new strategy
    if (currentScenario.type !== strategyType) {
      setCurrentScenario(getRandomScenarioByType(strategyType));
    }
  }, [strategy, currentScenario.type]);

  return (
    <div className="min-h-screen bg-gray-100 py-4">
      {/* Settings Icon */}
      <div className="fixed top-4 left-4 z-30">
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="p-3 bg-white rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
          title="Open Settings"
        >
          <Settings className="w-6 h-6 text-gray-600" />
        </button>
      </div>

      {/* Settings Sidebar */}
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

      {/* Main Content */}
      <div className={`transition-all duration-300 ${isSettingsOpen ? 'ml-96' : 'ml-0'}`}>
        <InteractiveGroupRecommender
          strategy={strategy}
          explanationStrategy={explanationStrategy}
          sortBestToWorst={sortBestToWorst}
          fadeNonContributing={fadeNonContributing}
          scenario={currentScenario}
        />
      </div>
    </div>
  );
}
