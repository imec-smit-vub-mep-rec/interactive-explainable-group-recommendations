import { sql, ExplanationModality, AggregationStrategy } from './db';
import { scenarios } from './data/scenarios';
import { Scenario } from './types';

// Generate a random UUID
export function generateSessionId(): string {
  return crypto.randomUUID();
}

// Get balanced assignment for explanation modality
export async function getBalancedExplanationModality(): Promise<ExplanationModality> {
  const modalities: ExplanationModality[] = ['no_expl', 'static_list', 'interactive_list', 'conversational'];
  
  try {
    // Count sessions per modality
    const counts = await sql`
      SELECT explanation_modality, COUNT(*) as count
      FROM experiment_sessions
      GROUP BY explanation_modality
    ` as Array<{ explanation_modality: string; count: string | number }>;
    
    const countMap = new Map<string, number>();
    for (const row of counts) {
      countMap.set(row.explanation_modality, parseInt(String(row.count)));
    }
    
    // Find modality with lowest count
    let minCount = Infinity;
    let minModalities: ExplanationModality[] = [];
    
    for (const modality of modalities) {
      const count = countMap.get(modality) || 0;
      if (count < minCount) {
        minCount = count;
        minModalities = [modality];
      } else if (count === minCount) {
        minModalities.push(modality);
      }
    }
    
    // Random selection among lowest count modalities
    return minModalities[Math.floor(Math.random() * minModalities.length)];
  } catch {
    // If query fails, return random
    return modalities[Math.floor(Math.random() * modalities.length)];
  }
}

// Get balanced assignment for aggregation strategy
export async function getBalancedAggregationStrategy(): Promise<AggregationStrategy> {
  const strategies: AggregationStrategy[] = ['lms', 'add', 'app'];
  
  try {
    // Count sessions per strategy
    const counts = await sql`
      SELECT aggregation_strategy, COUNT(*) as count
      FROM experiment_sessions
      GROUP BY aggregation_strategy
    ` as Array<{ aggregation_strategy: string; count: string | number }>;
    
    const countMap = new Map<string, number>();
    for (const row of counts) {
      countMap.set(row.aggregation_strategy, parseInt(String(row.count)));
    }
    
    // Find strategy with lowest count
    let minCount = Infinity;
    let minStrategies: AggregationStrategy[] = [];
    
    for (const strategy of strategies) {
      const count = countMap.get(strategy) || 0;
      if (count < minCount) {
        minCount = count;
        minStrategies = [strategy];
      } else if (count === minCount) {
        minStrategies.push(strategy);
      }
    }
    
    // Random selection among lowest count strategies
    return minStrategies[Math.floor(Math.random() * minStrategies.length)];
  } catch {
    // If query fails, return random
    return strategies[Math.floor(Math.random() * strategies.length)];
  }
}

// Get training scenarios for a given aggregation strategy (scenarios without questions)
export function getTrainingScenarios(aggregationStrategy: AggregationStrategy): Scenario[] {
  const strategyType = aggregationStrategy as 'lms' | 'add' | 'app';
  
  // Filter scenarios by type and those without questions (training scenarios)
  const trainingScenarios = scenarios.filter(
    s => s.type === strategyType && s.questions.length === 0
  );
  
  // Shuffle and return first 3 training scenarios
  return shuffleArray(trainingScenarios).slice(0, 3);
}

// Get test scenarios for a given aggregation strategy (scenarios with questions)
export function getTestScenarios(aggregationStrategy: AggregationStrategy): Scenario[] {
  const strategyType = aggregationStrategy as 'lms' | 'add' | 'app';
  
  // Filter scenarios by type and those with questions
  const testScenarios = scenarios.filter(
    s => s.type === strategyType && s.questions.length > 0
  );
  
  // Need to select 6 scenarios: 2 for each task type
  const byTaskType = {
    model_simulation: testScenarios.filter(s => s.questions.some(q => q.task === 'model_simulation')),
    counterfactual: testScenarios.filter(s => s.questions.some(q => q.task === 'counterfactual')),
    error_detection: testScenarios.filter(s => s.questions.some(q => q.task === 'error_detection')),
  };
  
  // Select 2 from each, shuffle, and combine
  const selected: Scenario[] = [
    ...shuffleArray(byTaskType.model_simulation).slice(0, 2),
    ...shuffleArray(byTaskType.counterfactual).slice(0, 2),
    ...shuffleArray(byTaskType.error_detection).slice(0, 2),
  ];
  
  // Shuffle the final selection
  return shuffleArray(selected);
}

// Fisher-Yates shuffle
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Screen definitions
export const SCREENS = {
  WELCOME: 0,
  DEMOGRAPHICS: 1,
  TRAINING: 2,
  PRELIMINARY_UNDERSTANDING: 3,
  OBJECTIVE_TEST: 4,
  REPEAT_UNDERSTANDING: 5,
  DEBRIEFING: 6,
  NASA_TLX: 7,
  FEEDBACK: 8,
  THANK_YOU: 9,
} as const;

export const SCREEN_NAMES: Record<number, string> = {
  0: 'welcome',
  1: 'demographics',
  2: 'training',
  3: 'preliminary_understanding',
  4: 'objective_test',
  5: 'repeat_understanding',
  6: 'debriefing',
  7: 'nasa_tlx',
  8: 'feedback',
  9: 'thank_you',
};

export const TOTAL_SCREENS = 10;

// LocalStorage keys
export const STORAGE_KEYS = {
  SESSION_ID: 'experiment_session_id',
  IS_COMPLETED: 'experiment_is_completed',
  SESSION_DATA: 'experiment_session_data',
} as const;

// Prolific configuration
export const PROLIFIC_CONFIG = {
  COMPLETION_URL: 'https://app.prolific.com/submissions/complete?cc=XXXXXXXX', // Replace XXXXXXXX with actual code
};
