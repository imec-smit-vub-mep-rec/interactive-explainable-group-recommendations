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

  reverse_shibboleth_response: string | null;
  recaptcha_token: string | null;
  
  screen_timings: ScreenTiming[];
  raw_session_data: Record<string, unknown>;

  attn_check_1?: Record<string, unknown> | null;
  attn_check_2?: Record<string, unknown> | null;
  is_attention_fail?: boolean;
}

export interface TrainingTaskData {
  scenarioId: string;
  step1Answer: string | null; // User's initial guess
  step3Answer: string | null; // User's final decision after seeing explanation
  attentionCheckAnswer?: string | null;
  interactions: InteractionEvent[];
  interaction_table_rating_edits: number;
  interactive_graph_rating_edits: number;
  interaction_query_submissions: {
    click_suggestion: {
      count: number;
      suggestions_clicked: string[];
    };
    typed_query: {
      count: number;
      queries_submitted: string[];
    };
  };
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
  attentionCheckAnswer?: string | null;
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
  `;
  
  // Add 'interactive_graph' to existing enum if it doesn't exist (for existing databases)
  // This is a separate call because we can't have multiple commands in a prepared statement
  await sql`
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

      reverse_shibboleth_response TEXT,
      recaptcha_token TEXT,
      
      screen_timings JSONB DEFAULT '[]',
      raw_session_data JSONB DEFAULT '{}',

      attn_check_1 JSONB DEFAULT NULL,
      attn_check_2 JSONB DEFAULT NULL,
      is_attention_fail BOOLEAN DEFAULT FALSE
    )
  `;

  await sql`
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'experiment_sessions' AND column_name = 'reverse_shibboleth_response') THEN
        ALTER TABLE experiment_sessions ADD COLUMN reverse_shibboleth_response TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'experiment_sessions' AND column_name = 'recaptcha_token') THEN
        ALTER TABLE experiment_sessions ADD COLUMN recaptcha_token TEXT;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'experiment_sessions' AND column_name = 'attn_check_1') THEN
        ALTER TABLE experiment_sessions ADD COLUMN attn_check_1 JSONB DEFAULT NULL;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'experiment_sessions' AND column_name = 'attn_check_2') THEN
        ALTER TABLE experiment_sessions ADD COLUMN attn_check_2 JSONB DEFAULT NULL;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'experiment_sessions' AND column_name = 'is_attention_fail') THEN
        ALTER TABLE experiment_sessions ADD COLUMN is_attention_fail BOOLEAN DEFAULT FALSE;
      END IF;
    END $$;
  `;
}
