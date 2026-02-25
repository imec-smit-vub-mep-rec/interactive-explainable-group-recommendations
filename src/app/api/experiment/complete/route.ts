import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

const MAX_SCREEN_TIMINGS_BYTES = 512 * 1024; // 512KB - must match answer route

// POST: Mark a session as complete
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, finalScreenTiming } = body;
    
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID required' },
        { status: 400 }
      );
    }
    
    // If there's a final screen timing, add it first
    if (finalScreenTiming) {
      const existingTimings = await sql`
        SELECT screen_timings FROM experiment_sessions WHERE id = ${sessionId}
      ` as Array<{ screen_timings: unknown }>;
      
      const timings = (existingTimings[0]?.screen_timings as unknown[]) || [];
      timings.push(finalScreenTiming);
      
      const payload = JSON.stringify(timings);
      if (payload.length > MAX_SCREEN_TIMINGS_BYTES) {
        console.log('[POST /api/experiment/complete] screen_timings payload too large:', payload.length);
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
    
    // Mark session as complete
    await sql`
      UPDATE experiment_sessions 
      SET 
        is_completed = true,
        end_time = NOW()
      WHERE id = ${sessionId}
    `;
    
    // Get the session to return Prolific info
    const result = await sql`
      SELECT prolific_pid, prolific_study_id
      FROM experiment_sessions
      WHERE id = ${sessionId}
    ` as Array<{ prolific_pid: string | null; prolific_study_id: string | null }>;
    
    const session = result[0];
    
    return NextResponse.json({
      success: true,
      message: 'Session marked as complete',
      hasProlific: !!session?.prolific_pid,
      prolificPid: session?.prolific_pid,
      prolificStudyId: session?.prolific_study_id,
    });
  } catch (error) {
    console.error('Error completing session:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to complete session' },
      { status: 500 }
    );
  }
}
