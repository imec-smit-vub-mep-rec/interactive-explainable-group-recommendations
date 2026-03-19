import { sql, ExplanationModality, AggregationStrategy } from './db';
import { scenarios } from './data/test_scenarios';
import { Scenario } from './types';

export const GROUP_CODES: Record<string, { aggregationStrategy: AggregationStrategy; explanationModality: ExplanationModality }> = {
  ADNO: { aggregationStrategy: 'add', explanationModality: 'no_expl' },
  ADST: { aggregationStrategy: 'add', explanationModality: 'static_list' },
  ADIN: { aggregationStrategy: 'add', explanationModality: 'interactive_list' },
  ADCO: { aggregationStrategy: 'add', explanationModality: 'conversational' },
  ADBC: { aggregationStrategy: 'add', explanationModality: 'interactive_bar_chart' },
  ADGR: { aggregationStrategy: 'add', explanationModality: 'interactive_bar_chart' },
  APNO: { aggregationStrategy: 'app', explanationModality: 'no_expl' },
  APST: { aggregationStrategy: 'app', explanationModality: 'static_list' },
  APIN: { aggregationStrategy: 'app', explanationModality: 'interactive_list' },
  APCO: { aggregationStrategy: 'app', explanationModality: 'conversational' },
  APBC: { aggregationStrategy: 'app', explanationModality: 'interactive_bar_chart' },
  APGR: { aggregationStrategy: 'app', explanationModality: 'interactive_bar_chart' },
  LMNO: { aggregationStrategy: 'lms', explanationModality: 'no_expl' },
  LMST: { aggregationStrategy: 'lms', explanationModality: 'static_list' },
  LMIN: { aggregationStrategy: 'lms', explanationModality: 'interactive_list' },
  LMCO: { aggregationStrategy: 'lms', explanationModality: 'conversational' },
  LMBC: { aggregationStrategy: 'lms', explanationModality: 'interactive_bar_chart' },
  LMGR: { aggregationStrategy: 'lms', explanationModality: 'interactive_bar_chart' }, // deprecated
};

/**
 * Resolve a group code to its aggregation strategy and explanation modality.
 * Returns null if the code is not recognized.
 */
export function resolveGroupCode(code: string | null | undefined): { aggregationStrategy: AggregationStrategy; explanationModality: ExplanationModality } | null {
  if (!code) return null;
  return GROUP_CODES[code.toUpperCase()] ?? null;
}

export function generateSessionId(): string {
  return crypto.randomUUID();
}

// Get balanced assignment for explanation modality
export async function getBalancedExplanationModality(): Promise<ExplanationModality> {
  const modalities: ExplanationModality[] = ['no_expl', 'static_list', 'interactive_list', 'conversational', 'interactive_bar_chart'];

  try {
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

    return minModalities[Math.floor(Math.random() * minModalities.length)];
  } catch {
    return modalities[Math.floor(Math.random() * modalities.length)];
  }
}

export async function getBalancedAggregationStrategy(): Promise<AggregationStrategy> {
  const strategies: AggregationStrategy[] = ['lms', 'add', 'app'];

  try {
    const counts = await sql`
      SELECT aggregation_strategy, COUNT(*) as count
      FROM experiment_sessions
      GROUP BY aggregation_strategy
    ` as Array<{ aggregation_strategy: string; count: string | number }>;
    
    const countMap = new Map<string, number>();
    for (const row of counts) {
      countMap.set(row.aggregation_strategy, parseInt(String(row.count)));
    }

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

    return minStrategies[Math.floor(Math.random() * minStrategies.length)];
  } catch {
    return strategies[Math.floor(Math.random() * strategies.length)];
  }
}

export function getTrainingScenarios(aggregationStrategy: AggregationStrategy): Scenario[] {
  const strategyType = aggregationStrategy as 'lms' | 'add' | 'app';

  const trainingScenarios = scenarios.filter(
    s => s.type === strategyType && s.questions.length === 0
  );

  return shuffleArray(trainingScenarios).slice(0, 3);
}

export function getTestScenarios(aggregationStrategy: AggregationStrategy): Scenario[] {
  const strategyType = aggregationStrategy as 'lms' | 'add' | 'app';

  const testScenarios = scenarios.filter(
    s => s.type === strategyType && s.questions.length > 0
  );

  const byTaskType = {
    model_simulation: testScenarios.filter(s => s.questions.some(q => q.task === 'model_simulation')),
    counterfactual: testScenarios.filter(s => s.questions.some(q => q.task === 'counterfactual')),
    error_detection: testScenarios.filter(s => s.questions.some(q => q.task === 'error_detection')),
  };

  const modelSimulation = shuffleArray(byTaskType.model_simulation).slice(0, 2);
  const counterfactual = shuffleArray(byTaskType.counterfactual).slice(0, 2);
  const errorDetection = shuffleArray(byTaskType.error_detection).slice(0, 2);

  const firstThree = shuffleArray([
    modelSimulation[0],
    counterfactual[0],
    errorDetection[0],
  ]);

  const remainingThree = shuffleArray([
    modelSimulation[1],
    counterfactual[1],
    errorDetection[1],
  ]);

  return [...firstThree, ...remainingThree];
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export const SCREENS = {
  WELCOME: 0,
  DEMOGRAPHICS: 1,
  INSTRUCTIONS: 2,
  TRAINING: 3,
  PRELIMINARY_UNDERSTANDING: 4,
  OBJECTIVE_TEST: 5,
  REPEAT_UNDERSTANDING: 6,
  DEBRIEFING: 7,
  NASA_TLX: 8,
  FEEDBACK: 9,
  THANK_YOU: 10,
  ATTENTION_FAIL: 11,
} as const;

export const SCREEN_NAMES: Record<number, string> = {
  0: 'welcome',
  1: 'demographics',
  2: 'instructions',
  3: 'training',
  4: 'preliminary_understanding',
  5: 'objective_test',
  6: 'repeat_understanding',
  7: 'debriefing',
  8: 'nasa_tlx',
  9: 'feedback',
  10: 'thank_you',
  11: 'attention_fail',
};

export const TOTAL_SCREENS = 12;

export const STORAGE_KEYS = {
  SESSION_ID: 'experiment_session_id',
  IS_COMPLETED: 'experiment_is_completed',
  SESSION_DATA: 'experiment_session_data',
} as const;

export const PROLIFIC_CONFIG = {
  COMPLETION_URL: process.env.NEXT_PUBLIC_PROLIFIC_REDIRECT_URL || 'https://app.prolific.com/submissions',
  CANCEL_URL: process.env.NEXT_PUBLIC_PROLIFIC_CANCEL_URL || 'https://app.prolific.com/submissions',
};
