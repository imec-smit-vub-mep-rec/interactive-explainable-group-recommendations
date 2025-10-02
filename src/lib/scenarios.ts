export interface Person {
  name: string;
  pattern: string;
  color: string;
}

export interface Restaurant {
  id: number;
  name: string;
  visited: boolean;
  visitedOrder?: number;
}

export interface Scenario {
  id: string;
  type: "add" | "lms" | "app";
  name: string;
  description: string;
  ratings: number[][];
  restaurants: Restaurant[];
}

export const people: Person[] = [
  { name: "Darcy", pattern: "solid", color: "#6B7280" },
  { name: "Alex", pattern: "dotted", color: "#3B82F6" },
  { name: "Jess", pattern: "horizontal", color: "#10B981" },
  { name: "Jackie", pattern: "vertical", color: "#F59E0B" },
  { name: "Freddy", pattern: "diagonal", color: "#EF4444" },
];

// Import the strategy-based scenarios
import strategyScenarios from './strategy_scenarios';

export const scenarios: Scenario[] = strategyScenarios.map((scenario: any) => ({
  id: scenario.id,
  type: scenario.type,
  name: getScenarioName(scenario.id, scenario.type),
  description: getScenarioDescription(scenario.id, scenario.type),
  ratings: scenario.ratings,
  restaurants: scenario.restaurants
}));

// Helper function to generate scenario names
function getScenarioName(id: string, type: string): string {
  const typeNames = {
    add: "Additive Strategy",
    lms: "Least Misery Strategy", 
    app: "Approval Voting Strategy"
  };
  return `${typeNames[type as keyof typeof typeNames]} - ${id.toUpperCase()}`;
}

// Helper function to generate scenario descriptions
function getScenarioDescription(id: string, type: string): string {
  const typeDescriptions = {
    add: "This scenario is optimized for the Additive strategy, where the total sum of ratings is maximized.",
    lms: "This scenario is optimized for the Least Misery strategy, where the minimum rating is maximized.",
    app: "This scenario is optimized for the Approval Voting strategy, where the number of ratings above 3 is maximized."
  };
  return typeDescriptions[type as keyof typeof typeDescriptions];
}

export function getRandomScenario(): Scenario {
  const randomIndex = Math.floor(Math.random() * scenarios.length);
  return scenarios[randomIndex];
}

export function getRandomScenarioByType(type: "add" | "lms" | "app"): Scenario {
  const scenariosOfType = scenarios.filter(scenario => scenario.type === type);
  const randomIndex = Math.floor(Math.random() * scenariosOfType.length);
  return scenariosOfType[randomIndex];
}

export function getScenarioById(id: string): Scenario | undefined {
  return scenarios.find(scenario => scenario.id === id);
}

export function getScenariosByType(type: "add" | "lms" | "app"): Scenario[] {
  return scenarios.filter(scenario => scenario.type === type);
}

export function getVisitedOrder(scenario: Scenario): string[] {
  return scenario.restaurants
    .filter(restaurant => restaurant.visited && restaurant.visitedOrder !== undefined)
    .sort((a, b) => (a.visitedOrder || 0) - (b.visitedOrder || 0))
    .map(restaurant => restaurant.name);
}
