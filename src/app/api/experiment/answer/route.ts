import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// Valid field names that can be updated
const VALID_FIELDS = [
  'current_screen',
  'onboarding_demographics_1_birth_year',
  'onboarding_demographics_2_gender',
  'training_tasks_data',
  'preliminary_subjective_understanding_1_understand',
  'preliminary_subjective_understanding_2_predict',
  'objective_understanding_tasks_data',
  'repeat_subjective_understanding_1_understand',
  'repeat_subjective_understanding_2_predict',
  'textual_debriefing',
  'nasa_tlx_data',
  'additional_feedback',
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
        
      case 'onboarding_demographics_1_birth_year':
        await sql`
          UPDATE experiment_sessions 
          SET onboarding_demographics_1_birth_year = ${value}
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
        
      case 'training_tasks_data':
        await sql`
          UPDATE experiment_sessions 
          SET training_tasks_data = ${JSON.stringify(value)}::jsonb
          WHERE id = ${sessionId}
        `;
        break;
        
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
        
      case 'screen_timings':
        await sql`
          UPDATE experiment_sessions 
          SET screen_timings = ${JSON.stringify(value)}::jsonb
          WHERE id = ${sessionId}
        `;
        break;
        
      case 'raw_session_data':
        await sql`
          UPDATE experiment_sessions 
          SET raw_session_data = ${JSON.stringify(value)}::jsonb
          WHERE id = ${sessionId}
        `;
        break;
        
      case 'attn_check_1':
        await sql`
          UPDATE experiment_sessions 
          SET attn_check_1 = ${JSON.stringify(value)}::jsonb
          WHERE id = ${sessionId}
        `;
        break;
        
      case 'attn_check_2':
        await sql`
          UPDATE experiment_sessions 
          SET attn_check_2 = ${JSON.stringify(value)}::jsonb
          WHERE id = ${sessionId}
        `;
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
    
    return NextResponse.json({
      success: true,
      message: `Field ${field} updated successfully`,
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
      
      await sql`
        UPDATE experiment_sessions 
        SET screen_timings = ${JSON.stringify(timings)}::jsonb
        WHERE id = ${sessionId}
      `;
    }
    
    return NextResponse.json({
      success: true,
      message: 'Updates saved successfully',
    });
  } catch (error) {
    console.error('Error saving updates:', error);
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
    case 'onboarding_demographics_1_birth_year':
      await sql`UPDATE experiment_sessions SET onboarding_demographics_1_birth_year = ${value as number} WHERE id = ${sessionId}`;
      break;
    case 'onboarding_demographics_2_gender':
      await sql`UPDATE experiment_sessions SET onboarding_demographics_2_gender = ${value as string} WHERE id = ${sessionId}`;
      break;
    case 'training_tasks_data':
      await sql`UPDATE experiment_sessions SET training_tasks_data = ${JSON.stringify(value)}::jsonb WHERE id = ${sessionId}`;
      break;
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
    case 'textual_debriefing':
      await sql`UPDATE experiment_sessions SET textual_debriefing = ${value as string} WHERE id = ${sessionId}`;
      break;
    case 'nasa_tlx_data':
      await sql`UPDATE experiment_sessions SET nasa_tlx_data = ${JSON.stringify(value)}::jsonb WHERE id = ${sessionId}`;
      break;
    case 'additional_feedback':
      await sql`UPDATE experiment_sessions SET additional_feedback = ${value as string} WHERE id = ${sessionId}`;
      break;
    case 'screen_timings':
      await sql`UPDATE experiment_sessions SET screen_timings = ${JSON.stringify(value)}::jsonb WHERE id = ${sessionId}`;
      break;
    case 'raw_session_data':
      await sql`UPDATE experiment_sessions SET raw_session_data = ${JSON.stringify(value)}::jsonb WHERE id = ${sessionId}`;
      break;
    case 'attn_check_1':
      await sql`UPDATE experiment_sessions SET attn_check_1 = ${JSON.stringify(value)}::jsonb WHERE id = ${sessionId}`;
      break;
    case 'attn_check_2':
      await sql`UPDATE experiment_sessions SET attn_check_2 = ${JSON.stringify(value)}::jsonb WHERE id = ${sessionId}`;
      break;
  }
}
