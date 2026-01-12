"use client";

import React from "react";
import { X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  scenarios,
  Scenario,
  getRandomScenario,
  getScenariosByType,
  getRandomScenarioByType,
} from "@/lib/scenarios";
import { ExplanationStrategy } from "@/lib/types";

type AggregationStrategy = "LMS" | "ADD" | "APP";

interface SettingsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  strategy: AggregationStrategy;
  onStrategyChange: (strategy: AggregationStrategy) => void;
  explanationStrategy: ExplanationStrategy;
  onExplanationStrategyChange: (strategy: ExplanationStrategy) => void;
  sortBestToWorst: boolean;
  onSortBestToWorstChange: (value: boolean) => void;
  fadeNonContributing: boolean;
  onFadeNonContributingChange: (value: boolean) => void;
  currentScenario: Scenario;
  onScenarioChange: (scenario: Scenario) => void;
}

// Helper functions to get strategy labels
const getAggregationStrategyLabel = (strategy: AggregationStrategy) => {
  const labels = {
    LMS: "Least Misery (LMS)",
    ADD: "Additive (ADD)",
    APP: "Approval Voting (APP)",
  };
  return labels[strategy];
};

const getExplanationStrategyLabel = (strategy: ExplanationStrategy) => {
  const labels = {
    no_expl: "No Explanation",
    static_list: "Static List",
    interactive_list: "Interactive List",
    conversational: "Conversational",
    ordered_list_expl: "Ordered List Explanation",
    graph_expl: "Graph Explanation",
    text_expl: "Text Explanation",
    chat_expl: "Conversational Explanation (Legacy)",
    chat_expl_basic: "Conversational Explanation (Basic)",
    chat_expl_with_tools: "Conversational Explanation (With Tools)",
    chat_expl_with_tools_graph: "Conversational Explanation (With Tools + Graph)",
    pie_expl: "Pie Chart Explanation",
    heatmap_expl: "Heatmap Explanation",
  };
  return labels[strategy];
};

export default function SettingsSidebar({
  isOpen,
  onClose,
  strategy,
  onStrategyChange,
  explanationStrategy,
  onExplanationStrategyChange,
  sortBestToWorst,
  onSortBestToWorstChange,
  fadeNonContributing,
  onFadeNonContributingChange,
  currentScenario,
  onScenarioChange,
}: SettingsSidebarProps) {
  if (!isOpen) return null;

  // Get scenarios filtered by current strategy
  const strategyType = strategy.toLowerCase() as "add" | "lms" | "app";
  const availableScenarios = getScenariosByType(strategyType);

  return (
    <>
      {/* Sidebar */}
      <div className="fixed top-0 left-0 h-full w-96 bg-white shadow-xl z-50 overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-800">Settings</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Current Settings Summary */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Current Settings
            </h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>
                <span className="font-medium">Scenario:</span>{" "}
                {currentScenario.name}
              </p>
              <p>
                <span className="font-medium">Strategy:</span>{" "}
                {getAggregationStrategyLabel(strategy)}
              </p>
              <p>
                <span className="font-medium">Explanation:</span>{" "}
                {getExplanationStrategyLabel(explanationStrategy)}
              </p>
              <p>
                <span className="font-medium">Options:</span>{" "}
                {sortBestToWorst ? "Sorted" : "Original order"}
                {fadeNonContributing && ", Fade non-contributing"}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Scenario Selection */}
            <div>
              <h4 className="text-md font-semibold mb-3">Scenario</h4>
              <Select
                value={currentScenario.id}
                onValueChange={(value) => {
                  if (value === "random") {
                    const randomScenario =
                      getRandomScenarioByType(strategyType);
                    onScenarioChange(randomScenario);
                  } else {
                    const scenario = availableScenarios.find(
                      (s) => s.id === value
                    );
                    if (scenario) {
                      onScenarioChange(scenario);
                    }
                  }
                }}
              >
                <SelectTrigger className="w-full py-6">
                  <SelectValue placeholder="Select scenario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="random">
                    <div className="flex flex-col text-left">
                      <span className="font-medium">🎲 Random Scenario</span>
                      <span className="text-sm text-muted-foreground">
                        Pick a random scenario
                      </span>
                    </div>
                  </SelectItem>
                  {availableScenarios.map((scenario) => (
                    <SelectItem key={scenario.id} value={scenario.id}>
                      <div className="flex flex-col text-left">
                        <span className="font-medium">{scenario.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {scenario.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Aggregation Strategy Selection */}
            <div>
              <h4 className="text-md font-semibold mb-3">
                Aggregation Strategy
              </h4>
              <Select
                value={strategy}
                onValueChange={(value) =>
                  onStrategyChange(value as AggregationStrategy)
                }
              >
                <SelectTrigger className="w-full py-6">
                  <SelectValue placeholder="Select aggregation strategy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LMS">
                    <div className="flex flex-col text-left">
                      <span className="font-medium">Least Misery (LMS)</span>
                      <span className="text-sm text-muted-foreground">
                        Minimize the lowest rating
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="ADD">
                    <div className="flex flex-col text-left">
                      <span className="font-medium">Additive (ADD)</span>
                      <span className="text-sm text-muted-foreground">
                        Maximize total rating sum
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="APP">
                    <div className="flex flex-col text-left">
                      <span className="font-medium">Approval Voting (APP)</span>
                      <span className="text-sm text-muted-foreground">
                        Maximize votes above 3
                      </span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Explanation Strategy Selection */}
            <div>
              <h4 className="text-md font-semibold mb-3">
                Explanation Strategy
              </h4>
              <Select
                value={explanationStrategy}
                onValueChange={(value) =>
                  onExplanationStrategyChange(value as ExplanationStrategy)
                }
              >
                <SelectTrigger className="w-full py-6">
                  <SelectValue placeholder="Select explanation strategy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Experiment</SelectLabel>
                    <SelectItem value="no_expl">
                      <div className="flex flex-col text-left">
                        <span className="font-medium">No Explanation</span>
                        <span className="text-sm text-muted-foreground">
                          Show only the recommendation without explanation (no interactivity in table)
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="static_list">
                      <div className="flex flex-col text-left">
                        <span className="font-medium">Static List</span>
                        <span className="text-sm text-muted-foreground">
                          Show ordered list explanation (no interactivity in table)
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="interactive_list">
                      <div className="flex flex-col text-left">
                        <span className="font-medium">Interactive List</span>
                        <span className="text-sm text-muted-foreground">
                          Show ordered list explanation with table interactivity
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="conversational">
                      <div className="flex flex-col text-left">
                        <span className="font-medium">Conversational</span>
                        <span className="text-sm text-muted-foreground">
                          Basic conversational interface for explanations (without tools or bar chart)
                        </span>
                      </div>
                    </SelectItem>
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Other Explanation Modalities</SelectLabel>
                    <SelectItem value="text_expl">
                      <div className="flex flex-col text-left">
                        <span className="font-medium">Text Explanation</span>
                        <span className="text-sm text-muted-foreground">
                          Show recommendation with textual explanation
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="chat_expl">
                      <div className="flex flex-col text-left">
                        <span className="font-medium">
                          Conversational Explanation (Legacy)
                        </span>
                        <span className="text-sm text-muted-foreground">
                          Show interactive conversational interface with explanation (legacy version)
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="chat_expl_basic">
                      <div className="flex flex-col text-left">
                        <span className="font-medium">
                          Conversational Explanation (Basic)
                        </span>
                        <span className="text-sm text-muted-foreground">
                          Read-only conversational interface for explanations only
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="chat_expl_with_tools">
                      <div className="flex flex-col text-left">
                        <span className="font-medium">
                          Conversational Explanation (With Tools)
                        </span>
                        <span className="text-sm text-muted-foreground">
                          Interactive conversational interface with tool calling and rating updates
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="chat_expl_with_tools_graph">
                      <div className="flex flex-col text-left">
                        <span className="font-medium">
                          Conversational Explanation (With Tools + Graph)
                        </span>
                        <span className="text-sm text-muted-foreground">
                          Interactive conversational interface with tools and bar chart visualization
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="graph_expl">
                      <div className="flex flex-col text-left">
                        <span className="font-medium">Graph Explanation</span>
                        <span className="text-sm text-muted-foreground">
                          Show interactive graph with visual explanation
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="pie_expl">
                      <div className="flex flex-col text-left">
                        <span className="font-medium">Pie Chart Explanation</span>
                        <span className="text-sm text-muted-foreground">
                          Show interactive pie charts for each restaurant
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="heatmap_expl">
                      <div className="flex flex-col text-left">
                        <span className="font-medium">Heatmap Explanation</span>
                        <span className="text-sm text-muted-foreground">
                          Show interactive heatmap of all person-restaurant
                          ratings
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="ordered_list_expl">
                      <div className="flex flex-col text-left">
                        <span className="font-medium">
                          Ordered List Explanation
                        </span>
                        <span className="text-sm text-muted-foreground">
                          Show restaurants ranked by score with contextual
                          explanations
                        </span>
                      </div>
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Display Options */}
            <div>
              <h4 className="text-md font-semibold mb-3">Display Options</h4>
              <div className="space-y-3">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sortBestToWorst}
                    onChange={(e) => onSortBestToWorstChange(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div>
                    <span className="font-medium text-gray-900">
                      Sort best to worst
                    </span>
                    <p className="text-sm text-gray-600">
                      Sort restaurants by group score (best to worst)
                    </p>
                  </div>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fadeNonContributing}
                    onChange={(e) =>
                      onFadeNonContributingChange(e.target.checked)
                    }
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div>
                    <span className="font-medium text-gray-900">
                      Fade non-contributing users
                    </span>
                    <p className="text-sm text-gray-600">
                      Reduce opacity of bars that don't contribute to the group
                      score
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
