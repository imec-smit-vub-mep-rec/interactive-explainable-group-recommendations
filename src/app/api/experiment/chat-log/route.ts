import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

/**
 * POST: Append a single chat log entry to the session's chat_logs JSONB array.
 * Designed to be called fire-and-forget from the client so it doesn't block the UX.
 *
 * Body: { sessionId: string, entry: ChatLogRecord }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, entry } = body;

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'sessionId is required' },
        { status: 400 }
      );
    }

    if (!entry || typeof entry !== 'object' || !entry.role || !entry.content || !entry.timestamp) {
      return NextResponse.json(
        { success: false, error: 'entry must include role, content, and timestamp' },
        { status: 400 }
      );
    }

    // Atomically append the new entry to the chat_logs JSONB array.
    // COALESCE handles the case where chat_logs is NULL (for rows created before the migration).
    await sql`
      UPDATE experiment_sessions
      SET chat_logs = COALESCE(chat_logs, '[]'::jsonb) || ${JSON.stringify(entry)}::jsonb
      WHERE id = ${sessionId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[POST /api/experiment/chat-log] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
