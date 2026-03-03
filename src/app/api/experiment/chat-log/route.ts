import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// Max entry size to avoid Neon DB OOM (ExprContext memory limit)
const MAX_CONTENT_LENGTH = 32 * 1024; // 32KB
const MAX_ENTRY_BYTES = 100 * 1024; // 100KB total entry - reject larger to avoid OOM
const MIN_LOG_INTERVAL_MS = 400;

/**
 * Sanitize entry for DB: truncate content, strip large metadata.
 */
function sanitizeEntry(entry: Record<string, unknown>): Record<string, unknown> {
  const content =
    typeof entry.content === 'string'
      ? entry.content.length > MAX_CONTENT_LENGTH
        ? entry.content.slice(0, MAX_CONTENT_LENGTH) + '\n[...truncated]'
        : entry.content
      : String(entry.content ?? '').slice(0, MAX_CONTENT_LENGTH);

  const meta = entry.metadata as Record<string, unknown> | undefined;
  let metadata: Record<string, unknown> | undefined;
  if (meta && typeof meta === 'object') {
    // Strip toolResults (full data) - keep only toolResultsSummary or toolCalls
    const { toolResults, ...rest } = meta;
    metadata = rest;
    if (Array.isArray(meta.toolResultsSummary)) {
      metadata.toolResultsSummary = meta.toolResultsSummary;
    }
  }

  return {
    role: entry.role,
    content,
    timestamp: entry.timestamp,
    ...(entry.scenarioId != null && { scenarioId: entry.scenarioId }),
    ...(entry.taskIndex != null && { taskIndex: entry.taskIndex }),
    ...(entry.step != null && { step: entry.step }),
    ...(metadata && Object.keys(metadata).length > 0 && { metadata }),
  };
}

function getEntrySignature(entry: Record<string, unknown>): string {
  const metadata =
    entry.metadata && typeof entry.metadata === 'object'
      ? (entry.metadata as Record<string, unknown>)
      : undefined;
  const messageId =
    typeof metadata?.messageId === 'string' ? metadata.messageId : '';
  const errorName =
    typeof metadata?.errorName === 'string' ? metadata.errorName : '';
  return JSON.stringify({
    role: entry.role,
    content: entry.content,
    messageId,
    errorName,
  });
}

function parseIsoMs(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * POST: Append a single chat log entry to the session's chat_logs JSONB array.
 * Designed to be called fire-and-forget from the client so it doesn't block the UX.
 * Entries are sanitized/truncated to avoid DB OOM (Neon memory limits).
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

    const sanitized = sanitizeEntry(entry);
    const payload = JSON.stringify(sanitized);
    if (payload.length > MAX_ENTRY_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Entry too large after sanitization' },
        { status: 413 }
      );
    }

    const sessionRows = (await sql`
      SELECT
        chat_logs->-1 AS last_entry,
        chat_logs->-1->>'timestamp' AS last_timestamp
      FROM experiment_sessions
      WHERE id = ${sessionId}
      LIMIT 1
    `) as { last_entry: Record<string, unknown> | null; last_timestamp: string | null }[];
    if (sessionRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    const lastEntry = sessionRows[0].last_entry;
    const lastTimestampMs = parseIsoMs(sessionRows[0].last_timestamp);
    const now = Date.now();

    if (lastTimestampMs !== null && now - lastTimestampMs < MIN_LOG_INTERVAL_MS) {
      return NextResponse.json({ success: true, skipped: true, reason: 'throttled' });
    }

    if (lastEntry && getEntrySignature(lastEntry) === getEntrySignature(sanitized)) {
      return NextResponse.json({ success: true, skipped: true, reason: 'duplicate' });
    }

    // Atomically append the new entry to the chat_logs JSONB array.
    // COALESCE handles the case where chat_logs is NULL (for rows created before the migration).
    await sql`
      UPDATE experiment_sessions
      SET chat_logs = COALESCE(chat_logs, '[]'::jsonb) || ${payload}::jsonb
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
