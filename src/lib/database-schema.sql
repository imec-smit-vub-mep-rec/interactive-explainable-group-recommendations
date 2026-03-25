-- Experiment Sessions Database Schema
-- Run this in Neon PostgreSQL console to set up the database

-- Create enum types
DO $$ BEGIN
  CREATE TYPE explanation_modality_enum AS ENUM ('no_expl', 'static_list', 'interactive_list', 'conversational', 'interactive_graph', 'interactive_bar_chart'); -- interactive_graph is deprecated
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add 'interactive_bar_chart' to existing enum if it doesn't exist (for existing databases)
DO $$ 
BEGIN
  ALTER TYPE explanation_modality_enum ADD VALUE 'interactive_bar_chart';
EXCEPTION
  WHEN duplicate_object THEN 
    RAISE NOTICE 'Value interactive_bar_chart already exists in explanation_modality_enum';
END $$;

DO $$ BEGIN
  CREATE TYPE aggregation_strategy_enum AS ENUM ('lms', 'add', 'app');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE gender_enum AS ENUM ('male', 'female', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create the main experiment sessions table
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
  
  -- Demographics (saved immediately when answered)
  onboarding_demographics_1_age_range VARCHAR(20),
  onboarding_demographics_2_gender gender_enum,
  
  -- Training tasks (JSONB for flexible storage)
  -- Structure: [{ scenarioId, step1Answer, step3Answer, interactions, startTime, endTime }]
  training_tasks_data JSONB DEFAULT '[]',
  
  -- Subjective understanding (7-point likert)
  preliminary_subjective_understanding_1_understand INTEGER,
  preliminary_subjective_understanding_2_predict INTEGER,
  
  -- Objective understanding test data
  -- Structure: [{ scenarioId, questionId, taskType, userAnswer, isCorrect, isAttentionCheck, interactions, startTime, endTime }]
  objective_understanding_tasks_data JSONB DEFAULT '[]',
  
  -- Repeat subjective understanding
  repeat_subjective_understanding_1_understand INTEGER,
  repeat_subjective_understanding_2_predict INTEGER,

  -- Subjective satisfaction
  subjective_satisfaction_1_recommendations INTEGER,
  subjective_satisfaction_2_explanations INTEGER,
  subjective_satisfaction_3_interactivity INTEGER,
  
  -- Debriefing
  textual_debriefing TEXT,
  
  -- NASA-TLX data
  -- Structure: { mental_demand, physical_demand, temporal_demand, performance, effort, frustration }
  nasa_tlx_data JSONB DEFAULT '{}',
  
  -- Feedback
  additional_feedback TEXT,

  -- Reverse shibboleth (bot trap) and reCAPTCHA
  reverse_shibboleth_response TEXT,
  recaptcha_token TEXT,
  is_bot BOOLEAN DEFAULT FALSE,
  
  -- Screen timings and all interaction data
  -- Structure: [{ screenIndex, screenName, startTime, endTime, interactions }]
  screen_timings JSONB DEFAULT '[]',
  
  -- Chat conversation logs (queries, responses, errors with timestamps)
  -- Structure: [{ role: 'user'|'assistant'|'error', content, timestamp, scenarioId, taskIndex, step, metadata }]
  chat_logs JSONB DEFAULT '[]',
  
  -- Raw session data with all user interactions backup
  raw_session_data JSONB DEFAULT '{}',
  
  -- Attention checks
  -- Structure: { answer, isCorrect, timestamp }
  attn_check_1 JSONB DEFAULT NULL,
  attn_check_2 JSONB DEFAULT NULL,
  is_attention_fail BOOLEAN DEFAULT FALSE
);

-- Add attention check columns to existing tables (run if table already exists)
DO $$ 
BEGIN
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

-- Add bot protection columns to existing tables (run if table already exists)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'experiment_sessions' AND column_name = 'reverse_shibboleth_response') THEN
    ALTER TABLE experiment_sessions ADD COLUMN reverse_shibboleth_response TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'experiment_sessions' AND column_name = 'recaptcha_token') THEN
    ALTER TABLE experiment_sessions ADD COLUMN recaptcha_token TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'experiment_sessions' AND column_name = 'is_bot') THEN
    ALTER TABLE experiment_sessions ADD COLUMN is_bot BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'experiment_sessions' AND column_name = 'subjective_satisfaction_1_recommendations') THEN
    ALTER TABLE experiment_sessions ADD COLUMN subjective_satisfaction_1_recommendations INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'experiment_sessions' AND column_name = 'subjective_satisfaction_2_explanations') THEN
    ALTER TABLE experiment_sessions ADD COLUMN subjective_satisfaction_2_explanations INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'experiment_sessions' AND column_name = 'subjective_satisfaction_3_interactivity') THEN
    ALTER TABLE experiment_sessions ADD COLUMN subjective_satisfaction_3_interactivity INTEGER;
  END IF;
END $$;

-- Add chat_logs column to existing tables (run if table already exists)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'experiment_sessions' AND column_name = 'chat_logs') THEN
    ALTER TABLE experiment_sessions ADD COLUMN chat_logs JSONB DEFAULT '[]';
  END IF;
END $$;

-- Migrate birth_year INTEGER column to age_range VARCHAR (run if table already exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'experiment_sessions' AND column_name = 'onboarding_demographics_1_birth_year') THEN
    ALTER TABLE experiment_sessions RENAME COLUMN onboarding_demographics_1_birth_year TO onboarding_demographics_1_age_range;
    ALTER TABLE experiment_sessions ALTER COLUMN onboarding_demographics_1_age_range TYPE VARCHAR(20) USING onboarding_demographics_1_age_range::VARCHAR;
  END IF;
END $$;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_experiment_sessions_prolific_pid ON experiment_sessions(prolific_pid);
CREATE INDEX IF NOT EXISTS idx_experiment_sessions_is_completed ON experiment_sessions(is_completed);
CREATE INDEX IF NOT EXISTS idx_experiment_sessions_explanation_modality ON experiment_sessions(explanation_modality);
CREATE INDEX IF NOT EXISTS idx_experiment_sessions_aggregation_strategy ON experiment_sessions(aggregation_strategy);
CREATE INDEX IF NOT EXISTS idx_experiment_sessions_start_time ON experiment_sessions(start_time);
