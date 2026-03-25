import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// Size limits for JSONB columns (protect against Neon memory limits)
const MAX_TRAINING_TASKS_BYTES = 512 * 1024;   // 512KB
const MAX_SCREEN_TIMINGS_BYTES = 512 * 1024;   // 512KB
const MAX_RAW_SESSION_BYTES = 256 * 1024;      // 256KB

// Valid field names that can be updated
const VALID_FIELDS = [
  'current_screen',
  'onboarding_demographics_1_age_range',
  'onboarding_demographics_2_gender',
  'training_tasks_data',
  'preliminary_subjective_understanding_1_understand',
  'preliminary_subjective_understanding_2_predict',
  'objective_understanding_tasks_data',
  'repeat_subjective_understanding_1_understand',
  'repeat_subjective_understanding_2_predict',
  'subjective_satisfaction_1_recommendations',
  'subjective_satisfaction_2_explanations',
  'subjective_satisfaction_3_interactivity',
  'textual_debriefing',
  'nasa_tlx_data',
  'additional_feedback',
  'reverse_shibboleth_response',
  'recaptcha_token',
  'screen_timings',
  'raw_session_data',
  'attn_check_1',
  'attn_check_2',
] as const;

type ValidField = typeof VALID_FIELDS[number];

// POST: Save an answer for a specific field
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, field, value, screenIndex } = body;
    let isAttentionFail = false;
    let didUpdateAttentionCheck = false;
    
    console.log('[POST /api/experiment/answer] Received request:', { sessionId, field, value: typeof value === 'object' ? JSON.stringify(value) : value, screenIndex });
    
    if (!sessionId) {
      console.log('[POST /api/experiment/answer] Error: Session ID required');
      return NextResponse.json(
        { success: false, error: 'Session ID required' },
        { status: 400 }
      );
    }
    
    if (!field || !VALID_FIELDS.includes(field as ValidField)) {
      console.log('[POST /api/experiment/answer] Error: Invalid field:', field, '| Valid fields:', VALID_FIELDS);
      return NextResponse.json(
        { success: false, error: `Invalid field: ${field}` },
        { status: 400 }
      );
    }
    
    // Build and execute the update query based on field type
    // Using parameterized queries for security
    switch (field) {
      case 'current_screen':
        await sql`
          UPDATE experiment_sessions 
          SET current_screen = ${value}
          WHERE id = ${sessionId}
        `;
        break;
        
      case 'onboarding_demographics_1_age_range':
        await sql`
          UPDATE experiment_sessions 
          SET onboarding_demographics_1_age_range = ${value}
          WHERE id = ${sessionId}
        `;
        break;
        
      case 'onboarding_demographics_2_gender':
        await sql`
          UPDATE experiment_sessions 
          SET onboarding_demographics_2_gender = ${value}
          WHERE id = ${sessionId}
        `;
        break;
        
      case 'training_tasks_data': {
        const payload = JSON.stringify(value);
        if (payload.length > MAX_TRAINING_TASKS_BYTES) {
          console.log('[POST /api/experiment/answer] Payload too large:', field, payload.length);
          return NextResponse.json(
            { success: false, error: 'Payload too large', field },
            { status: 413 }
          );
        }
        await sql`
          UPDATE experiment_sessions 
          SET training_tasks_data = ${payload}::jsonb
          WHERE id = ${sessionId}
        `;
        break;
      }
        
      case 'preliminary_subjective_understanding_1_understand':
        await sql`
          UPDATE experiment_sessions 
          SET preliminary_subjective_understanding_1_understand = ${value}
          WHERE id = ${sessionId}
        `;
        break;
        
      case 'preliminary_subjective_understanding_2_predict':
        await sql`
          UPDATE experiment_sessions 
          SET preliminary_subjective_understanding_2_predict = ${value}
          WHERE id = ${sessionId}
        `;
        break;
        
      case 'objective_understanding_tasks_data':
        await sql`
          UPDATE experiment_sessions 
          SET objective_understanding_tasks_data = ${JSON.stringify(value)}::jsonb
          WHERE id = ${sessionId}
        `;
        break;
        
      case 'repeat_subjective_understanding_1_understand':
        await sql`
          UPDATE experiment_sessions 
          SET repeat_subjective_understanding_1_understand = ${value}
          WHERE id = ${sessionId}
        `;
        break;
        
      case 'repeat_subjective_understanding_2_predict':
        await sql`
          UPDATE experiment_sessions 
          SET repeat_subjective_understanding_2_predict = ${value}
          WHERE id = ${sessionId}
        `;
        break;

      case 'subjective_satisfaction_1_recommendations':
        await sql`
          UPDATE experiment_sessions 
          SET subjective_satisfaction_1_recommendations = ${value}
          WHERE id = ${sessionId}
        `;
        break;

      case 'subjective_satisfaction_2_explanations':
        await sql`
          UPDATE experiment_sessions 
          SET subjective_satisfaction_2_explanations = ${value}
          WHERE id = ${sessionId}
        `;
        break;

      case 'subjective_satisfaction_3_interactivity':
        await sql`
          UPDATE experiment_sessions 
          SET subjective_satisfaction_3_interactivity = ${value}
          WHERE id = ${sessionId}
        `;
        break;
        
      case 'textual_debriefing':
        await sql`
          UPDATE experiment_sessions 
          SET textual_debriefing = ${value}
          WHERE id = ${sessionId}
        `;
        break;
        
      case 'nasa_tlx_data':
        await sql`
          UPDATE experiment_sessions 
          SET nasa_tlx_data = ${JSON.stringify(value)}::jsonb
          WHERE id = ${sessionId}
        `;
        break;
        
      case 'additional_feedback':
        await sql`
          UPDATE experiment_sessions 
          SET additional_feedback = ${value}
          WHERE id = ${sessionId}
        `;
        break;

      case 'reverse_shibboleth_response':
        await sql`
          UPDATE experiment_sessions 
          SET reverse_shibboleth_response = ${value}
          WHERE id = ${sessionId}
        `;
        break;

      case 'recaptcha_token':
        await sql`
          UPDATE experiment_sessions 
          SET recaptcha_token = ${value}
          WHERE id = ${sessionId}
        `;
        break;
        
      case 'screen_timings': {
        const payload = JSON.stringify(value);
        if (payload.length > MAX_SCREEN_TIMINGS_BYTES) {
          console.log('[POST /api/experiment/answer] Payload too large:', field, payload.length);
          return NextResponse.json(
            { success: false, error: 'Payload too large', field },
            { status: 413 }
          );
        }
        await sql`
          UPDATE experiment_sessions 
          SET screen_timings = ${payload}::jsonb
          WHERE id = ${sessionId}
        `;
        break;
      }
        
      case 'raw_session_data': {
        const payload = JSON.stringify(value);
        if (payload.length > MAX_RAW_SESSION_BYTES) {
          console.log('[POST /api/experiment/answer] Payload too large:', field, payload.length);
          return NextResponse.json(
            { success: false, error: 'Payload too large', field },
            { status: 413 }
          );
        }
        await sql`
          UPDATE experiment_sessions 
          SET raw_session_data = ${payload}::jsonb
          WHERE id = ${sessionId}
        `;
        break;
      }
        
      case 'attn_check_1':
        await sql`
          UPDATE experiment_sessions 
          SET attn_check_1 = ${JSON.stringify(value)}::jsonb
          WHERE id = ${sessionId}
        `;
        didUpdateAttentionCheck = true;
        break;
        
      case 'attn_check_2':
        await sql`
          UPDATE experiment_sessions 
          SET attn_check_2 = ${JSON.stringify(value)}::jsonb
          WHERE id = ${sessionId}
        `;
        didUpdateAttentionCheck = true;
        break;
    }
    
    // Also update the current screen if provided
    if (typeof screenIndex === 'number' && field !== 'current_screen') {
      await sql`
        UPDATE experiment_sessions 
        SET current_screen = ${screenIndex}
        WHERE id = ${sessionId}
      `;
    }
    
    if (didUpdateAttentionCheck) {
      const [row] = await sql`
        SELECT attn_check_1, attn_check_2, is_attention_fail
        FROM experiment_sessions
        WHERE id = ${sessionId}
      ` as Array<{
        attn_check_1: { isCorrect?: boolean } | null;
        attn_check_2: { isCorrect?: boolean } | null;
        is_attention_fail: boolean | null;
      }>;

      const failures = [row?.attn_check_1, row?.attn_check_2].filter(
        (check) => check?.isCorrect === false
      ).length;

      if (failures >= 2) {
        await sql`
          UPDATE experiment_sessions
          SET is_attention_fail = TRUE
          WHERE id = ${sessionId}
        `;
        isAttentionFail = true;
      } else {
        isAttentionFail = Boolean(row?.is_attention_fail);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Field ${field} updated successfully`,
      isAttentionFail,
    });
  } catch (error) {
    console.error('Error saving answer:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save answer' },
      { status: 500 }
    );
  }
}

// PATCH: Update multiple fields at once (for screen transitions)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, updates, screenTiming } = body;
    
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID required' },
        { status: 400 }
      );
    }
    
    // Process each update
    for (const [field, value] of Object.entries(updates || {})) {
      if (!VALID_FIELDS.includes(field as ValidField)) {
        continue; // Skip invalid fields
      }
      
      await processFieldUpdate(sessionId, field as ValidField, value);
    }
    
    // Add screen timing if provided
    if (screenTiming) {
      const existingTimings = await sql`
        SELECT screen_timings FROM experiment_sessions WHERE id = ${sessionId}
      ` as Array<{ screen_timings: unknown }>;
      
      const timings = (existingTimings[0]?.screen_timings as unknown[]) || [];
      timings.push(screenTiming);
      
      const payload = JSON.stringify(timings);
      if (payload.length > MAX_SCREEN_TIMINGS_BYTES) {
        console.log('[PATCH /api/experiment/answer] screen_timings payload too large:', payload.length);
        return NextResponse.json(
          { success: false, error: 'Payload too large', field: 'screen_timings' },
          { status: 413 }
        );
      }
      
      await sql`
        UPDATE experiment_sessions 
        SET screen_timings = ${payload}::jsonb
        WHERE id = ${sessionId}
      `;
    }
    
    return NextResponse.json({
      success: true,
      message: 'Updates saved successfully',
    });
  } catch (error) {
    console.error('Error saving updates:', error);
    if (error instanceof Error && error.message.startsWith('Payload too large')) {
      return NextResponse.json(
        { success: false, error: error.message, field: 'updates' },
        { status: 413 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to save updates' },
      { status: 500 }
    );
  }
}

// Helper function to process field updates
async function processFieldUpdate(sessionId: string, field: ValidField, value: unknown) {
  switch (field) {
    case 'current_screen':
      await sql`UPDATE experiment_sessions SET current_screen = ${value as number} WHERE id = ${sessionId}`;
      break;
    case 'onboarding_demographics_1_age_range':
      await sql`UPDATE experiment_sessions SET onboarding_demographics_1_age_range = ${value as string} WHERE id = ${sessionId}`;
      break;
    case 'onboarding_demographics_2_gender':
      await sql`UPDATE experiment_sessions SET onboarding_demographics_2_gender = ${value as string} WHERE id = ${sessionId}`;
      break;
    case 'training_tasks_data': {
      const payload = JSON.stringify(value);
      if (payload.length > MAX_TRAINING_TASKS_BYTES) {
        throw new Error(`Payload too large for training_tasks_data: ${payload.length}`);
      }
      await sql`UPDATE experiment_sessions SET training_tasks_data = ${payload}::jsonb WHERE id = ${sessionId}`;
      break;
    }
    case 'preliminary_subjective_understanding_1_understand':
      await sql`UPDATE experiment_sessions SET preliminary_subjective_understanding_1_understand = ${value as number} WHERE id = ${sessionId}`;
      break;
    case 'preliminary_subjective_understanding_2_predict':
      await sql`UPDATE experiment_sessions SET preliminary_subjective_understanding_2_predict = ${value as number} WHERE id = ${sessionId}`;
      break;
    case 'objective_understanding_tasks_data':
      await sql`UPDATE experiment_sessions SET objective_understanding_tasks_data = ${JSON.stringify(value)}::jsonb WHERE id = ${sessionId}`;
      break;
    case 'repeat_subjective_understanding_1_understand':
      await sql`UPDATE experiment_sessions SET repeat_subjective_understanding_1_understand = ${value as number} WHERE id = ${sessionId}`;
      break;
    case 'repeat_subjective_understanding_2_predict':
      await sql`UPDATE experiment_sessions SET repeat_subjective_understanding_2_predict = ${value as number} WHERE id = ${sessionId}`;
      break;
    case 'subjective_satisfaction_1_recommendations':
      await sql`UPDATE experiment_sessions SET subjective_satisfaction_1_recommendations = ${value as number} WHERE id = ${sessionId}`;
      break;
    case 'subjective_satisfaction_2_explanations':
      await sql`UPDATE experiment_sessions SET subjective_satisfaction_2_explanations = ${value as number} WHERE id = ${sessionId}`;
      break;
    case 'subjective_satisfaction_3_interactivity':
      await sql`UPDATE experiment_sessions SET subjective_satisfaction_3_interactivity = ${value as number} WHERE id = ${sessionId}`;
      break;
    case 'textual_debriefing':
      await sql`UPDATE experiment_sessions SET textual_debriefing = ${value as string} WHERE id = ${sessionId}`;
      break;
    case 'nasa_tlx_data':
      await sql`UPDATE experiment_sessions SET nasa_tlx_data = ${JSON.stringify(value)}::jsonb WHERE id = ${sessionId}`;
      break;
    case 'additional_feedback':
      await sql`UPDATE experiment_sessions SET additional_feedback = ${value as string} WHERE id = ${sessionId}`;
      break;
    case 'reverse_shibboleth_response':
      await sql`UPDATE experiment_sessions SET reverse_shibboleth_response = ${value as string} WHERE id = ${sessionId}`;
      break;
    case 'recaptcha_token':
      await sql`UPDATE experiment_sessions SET recaptcha_token = ${value as string} WHERE id = ${sessionId}`;
      break;
    case 'screen_timings': {
      const payload = JSON.stringify(value);
      if (payload.length > MAX_SCREEN_TIMINGS_BYTES) {
        throw new Error(`Payload too large for screen_timings: ${payload.length}`);
      }
      await sql`UPDATE experiment_sessions SET screen_timings = ${payload}::jsonb WHERE id = ${sessionId}`;
      break;
    }
    case 'raw_session_data': {
      const payload = JSON.stringify(value);
      if (payload.length > MAX_RAW_SESSION_BYTES) {
        throw new Error(`Payload too large for raw_session_data: ${payload.length}`);
      }
      await sql`UPDATE experiment_sessions SET raw_session_data = ${payload}::jsonb WHERE id = ${sessionId}`;
      break;
    }
    case 'attn_check_1':
      await sql`UPDATE experiment_sessions SET attn_check_1 = ${JSON.stringify(value)}::jsonb WHERE id = ${sessionId}`;
      break;
    case 'attn_check_2':
      await sql`UPDATE experiment_sessions SET attn_check_2 = ${JSON.stringify(value)}::jsonb WHERE id = ${sessionId}`;
      break;
  }
}
