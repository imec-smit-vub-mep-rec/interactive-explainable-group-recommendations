import { neon } from '@neondatabase/serverless';

// Initialize SQL connection only on server side
// In Next.js, this module should only be imported in API routes or server components
let sql: ReturnType<typeof neon>;

if (typeof window === 'undefined') {
  // Server-side only - safe to access process.env
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    const errorMsg = 'DATABASE_URL environment variable is not set. ' +
      'Please ensure DATABASE_URL is set in your .env.local file.';
    console.error('[db.ts]', errorMsg);
    throw new Error(errorMsg);
  }

  // Trim and validate the connection string
  const connectionString = databaseUrl.trim();

  if (!connectionString || connectionString.length === 0) {
    const errorMsg = 'DATABASE_URL environment variable is empty after trimming.';
    console.error('[db.ts]', errorMsg);
    throw new Error(errorMsg);
  }

  // Validate the connection string format
  if (!connectionString.startsWith('postgresql://') && !connectionString.startsWith('postgres://')) {
    console.warn('[db.ts] DATABASE_URL does not appear to be a valid PostgreSQL connection string');
  }

  try {
    // Pass the connection string explicitly
    sql = neon(connectionString);
    console.log('[db.ts] Database connection initialized successfully');
  } catch (error) {
    console.error('[db.ts] Error creating neon connection:', error);
    console.error('[db.ts] Connection string (first 50 chars):', connectionString.substring(0, 50));
    throw new Error(
      `Failed to create database connection: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
} else {
  // Client-side - create a dummy function that throws a helpful error
  sql = (() => {
    throw new Error(
      'Database connection cannot be used on the client side. ' +
      'The db module should only be imported in server-side code (API routes, server components).'
    );
  }) as unknown as ReturnType<typeof neon>;
}

export { sql };

// Type definitions for database operations
export type ExplanationModality = 'no_expl' | 'static_list' | 'interactive_list' | 'conversational' | 'interactive_graph';
export type AggregationStrategy = 'lms' | 'add' | 'app';
export type Gender = 'male' | 'female' | 'other';

export interface ExperimentSession {
  id: string;
  prolific_pid: string | null;
  prolific_study_id: string | null;
  prolific_session_id: string | null;
  reference: string | null;
  
  start_time: Date;
  end_time: Date | null;
  is_completed: boolean;
  current_screen: number;
  
  explanation_modality: ExplanationModality;
  aggregation_strategy: AggregationStrategy;
  
  onboarding_demographics_1_birth_year: number | null;
  onboarding_demographics_2_gender: Gender | null;
  
  training_tasks_data: TrainingTaskData[];
  
  preliminary_subjective_understanding_1_understand: number | null;
  preliminary_subjective_understanding_2_predict: number | null;
  
  objective_understanding_tasks_data: ObjectiveTaskData[];
  
  repeat_subjective_understanding_1_understand: number | null;
  repeat_subjective_understanding_2_predict: number | null;
  
  textual_debriefing: string | null;
  
  nasa_tlx_data: NasaTlxData;
  
  additional_feedback: string | null;
  
  screen_timings: ScreenTiming[];
  raw_session_data: Record<string, unknown>;
}

export interface TrainingTaskData {
  scenarioId: string;
  step1Answer: string | null; // User's initial guess
  step3Answer: string | null; // User's final decision after seeing explanation
  interactions: InteractionEvent[];
  startTime: string;
  endTime: string | null;
}

export interface ObjectiveTaskData {
  scenarioId: string;
  questionId: string;
  taskType: 'model_simulation' | 'counterfactual' | 'error_detection';
  userAnswer: string | null;
  isCorrect: boolean | null;
  isAttentionCheck: boolean;
  interactions: InteractionEvent[];
  startTime: string;
  endTime: string | null;
}

export interface NasaTlxData {
  mental_demand?: number;
  physical_demand?: number;
  temporal_demand?: number;
  performance?: number;
  effort?: number;
  frustration?: number;
}

export interface ScreenTiming {
  screenIndex: number;
  screenName: string;
  startTime: string;
  endTime: string | null;
  interactions: InteractionEvent[];
}

export interface InteractionEvent {
  type: 'rating_change' | 'chat_message' | 'click' | 'view';
  timestamp: string;
  data: Record<string, unknown>;
}

// Helper function to run migrations
export async function runMigrations() {
  // Create enum types if they don't exist
  await sql`
    DO $$ BEGIN
      CREATE TYPE explanation_modality_enum AS ENUM ('no_expl', 'static_list', 'interactive_list', 'conversational', 'interactive_graph');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
    
    -- Add 'interactive_graph' to existing enum if it doesn't exist (for existing databases)
    DO $$ 
    BEGIN
      ALTER TYPE explanation_modality_enum ADD VALUE 'interactive_graph';
    EXCEPTION
      WHEN duplicate_object THEN 
        RAISE NOTICE 'Value interactive_graph already exists in explanation_modality_enum';
    END $$;
  `;

  await sql`
    DO $$ BEGIN
      CREATE TYPE aggregation_strategy_enum AS ENUM ('lms', 'add', 'app');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `;

  await sql`
    DO $$ BEGIN
      CREATE TYPE gender_enum AS ENUM ('male', 'female', 'other');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `;

  // Create the experiment_sessions table
  await sql`
    CREATE TABLE IF NOT EXISTS experiment_sessions (
      id VARCHAR(255) PRIMARY KEY,
      prolific_pid VARCHAR(48),
      prolific_study_id VARCHAR(48),
      prolific_session_id VARCHAR(48),
      reference VARCHAR(255),
      
      start_time TIMESTAMPTZ DEFAULT NOW(),
      end_time TIMESTAMPTZ,
      is_completed BOOLEAN DEFAULT FALSE,
      current_screen INTEGER DEFAULT 0,
      
      explanation_modality explanation_modality_enum NOT NULL,
      aggregation_strategy aggregation_strategy_enum NOT NULL,
      
      onboarding_demographics_1_birth_year INTEGER,
      onboarding_demographics_2_gender gender_enum,
      
      training_tasks_data JSONB DEFAULT '[]',
      
      preliminary_subjective_understanding_1_understand INTEGER,
      preliminary_subjective_understanding_2_predict INTEGER,
      
      objective_understanding_tasks_data JSONB DEFAULT '[]',
      
      repeat_subjective_understanding_1_understand INTEGER,
      repeat_subjective_understanding_2_predict INTEGER,
      
      textual_debriefing TEXT,
      
      nasa_tlx_data JSONB DEFAULT '{}',
      
      additional_feedback TEXT,
      
      screen_timings JSONB DEFAULT '[]',
      raw_session_data JSONB DEFAULT '{}'
    )
  `;
}
