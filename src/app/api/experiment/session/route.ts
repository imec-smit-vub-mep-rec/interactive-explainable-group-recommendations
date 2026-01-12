import { NextRequest, NextResponse } from 'next/server';
import { sql, runMigrations, AggregationStrategy } from '@/lib/db';
import {
  generateSessionId,
  getBalancedExplanationModality,
  getBalancedAggregationStrategy,
  getTrainingScenarios,
  getTestScenarios,
} from '@/lib/experiment-utils';

// POST: Create a new session
export async function POST(request: NextRequest) {
  try {
    // Run migrations to ensure tables exist
    await runMigrations();
    
    const body = await request.json();
    const { prolificPid, prolificStudyId, prolificSessionId, reference } = body;
    
    // Generate session ID and get balanced assignments
    const sessionId = generateSessionId();
    const explanationModality = await getBalancedExplanationModality();
    const aggregationStrategy = await getBalancedAggregationStrategy();
    
    // Get randomized scenarios for this session
    const trainingScenarios = getTrainingScenarios(aggregationStrategy);
    const testScenarios = getTestScenarios(aggregationStrategy);
    
    // Create session in database
    await sql`
      INSERT INTO experiment_sessions (
        id,
        prolific_pid,
        prolific_study_id,
        prolific_session_id,
        reference,
        explanation_modality,
        aggregation_strategy,
        start_time
      ) VALUES (
        ${sessionId},
        ${prolificPid || null},
        ${prolificStudyId || null},
        ${prolificSessionId || null},
        ${reference || null},
        ${explanationModality},
        ${aggregationStrategy},
        NOW()
      )
    `;
    
    return NextResponse.json({
      success: true,
      session: {
        id: sessionId,
        explanationModality,
        aggregationStrategy,
        trainingScenarioIds: trainingScenarios.map(s => s.id),
        testScenarioIds: testScenarios.map(s => s.id),
        currentScreen: 0,
      },
    });
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create session' },
      { status: 500 }
    );
  }
}

// GET: Retrieve an existing session
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID required' },
        { status: 400 }
      );
    }
    
    const result = await sql`
      SELECT 
        id,
        prolific_pid,
        prolific_study_id,
        prolific_session_id,
        reference,
        start_time,
        end_time,
        is_completed,
        current_screen,
        explanation_modality,
        aggregation_strategy,
        onboarding_demographics_1_birth_year,
        onboarding_demographics_2_gender,
        training_tasks_data,
        preliminary_subjective_understanding_1_understand,
        preliminary_subjective_understanding_2_predict,
        objective_understanding_tasks_data,
        repeat_subjective_understanding_1_understand,
        repeat_subjective_understanding_2_predict,
        textual_debriefing,
        nasa_tlx_data,
        additional_feedback,
        screen_timings,
        raw_session_data
      FROM experiment_sessions
      WHERE id = ${sessionId}
    ` as Array<{
      id: string;
      prolific_pid: string | null;
      prolific_study_id: string | null;
      prolific_session_id: string | null;
      reference: string | null;
      start_time: Date;
      end_time: Date | null;
      is_completed: boolean;
      current_screen: number;
      explanation_modality: string;
      aggregation_strategy: AggregationStrategy;
      onboarding_demographics_1_birth_year: number | null;
      onboarding_demographics_2_gender: string | null;
      training_tasks_data: unknown;
      preliminary_subjective_understanding_1_understand: number | null;
      preliminary_subjective_understanding_2_predict: number | null;
      objective_understanding_tasks_data: unknown;
      repeat_subjective_understanding_1_understand: number | null;
      repeat_subjective_understanding_2_predict: number | null;
      textual_debriefing: string | null;
      nasa_tlx_data: unknown;
      additional_feedback: string | null;
      screen_timings: unknown;
      raw_session_data: unknown;
    }>;
    
    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }
    
    const session = result[0];
    
    // Get scenario IDs based on strategy
    const trainingScenarios = getTrainingScenarios(session.aggregation_strategy);
    const testScenarios = getTestScenarios(session.aggregation_strategy);
    
    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        prolificPid: session.prolific_pid,
        prolificStudyId: session.prolific_study_id,
        prolificSessionId: session.prolific_session_id,
        reference: session.reference,
        startTime: session.start_time,
        endTime: session.end_time,
        isCompleted: session.is_completed,
        currentScreen: session.current_screen,
        explanationModality: session.explanation_modality,
        aggregationStrategy: session.aggregation_strategy,
        demographics: {
          birthYear: session.onboarding_demographics_1_birth_year,
          gender: session.onboarding_demographics_2_gender,
        },
        trainingTasksData: session.training_tasks_data,
        trainingScenarioIds: trainingScenarios.map(s => s.id),
        preliminaryUnderstanding: {
          understand: session.preliminary_subjective_understanding_1_understand,
          predict: session.preliminary_subjective_understanding_2_predict,
        },
        objectiveTasksData: session.objective_understanding_tasks_data,
        testScenarioIds: testScenarios.map(s => s.id),
        repeatUnderstanding: {
          understand: session.repeat_subjective_understanding_1_understand,
          predict: session.repeat_subjective_understanding_2_predict,
        },
        textualDebriefing: session.textual_debriefing,
        nasaTlxData: session.nasa_tlx_data,
        additionalFeedback: session.additional_feedback,
        screenTimings: session.screen_timings,
        rawSessionData: session.raw_session_data,
      },
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch session' },
      { status: 500 }
    );
  }
}
