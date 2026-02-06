import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/admin-auth";

type SessionSummary = {
  id: string;
  prolific_pid: string | null;
  start_time: Date;
  end_time: Date | null;
  is_completed: boolean;
  current_screen: number;
  explanation_modality: string;
  aggregation_strategy: string;
  is_attention_fail: boolean | null;
  is_bot: boolean | null;
};

const parseDateParam = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAdminAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("id");

    if (sessionId) {
      const result = (await sql`
        SELECT *
        FROM experiment_sessions
        WHERE id = ${sessionId}
      `) as Array<Record<string, unknown>>;

      if (result.length === 0) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ session: result[0] });
    }

    const fromParam = parseDateParam(searchParams.get("from"));
    const toParam = parseDateParam(searchParams.get("to"));
    const completedParam = searchParams.get("completed");
    const modalityParam = searchParams.get("modality");
    const strategyParam = searchParams.get("strategy");
    const prolificPidParam = searchParams.get("prolificPid");

    const sessions = (await sql`
      SELECT
        id,
        prolific_pid,
        start_time,
        end_time,
        is_completed,
        current_screen,
        explanation_modality,
        aggregation_strategy,
        is_attention_fail,
        is_bot
      FROM experiment_sessions
      ORDER BY start_time DESC
    `) as SessionSummary[];

    const filtered = sessions.filter((session) => {
      if (fromParam && session.start_time < fromParam) return false;
      if (toParam && session.start_time > toParam) return false;

      if (completedParam === "true" && !session.is_completed) return false;
      if (completedParam === "false" && session.is_completed) return false;

      if (modalityParam && session.explanation_modality !== modalityParam) {
        return false;
      }

      if (strategyParam && session.aggregation_strategy !== strategyParam) {
        return false;
      }

      if (
        prolificPidParam &&
        !session.prolific_pid?.toLowerCase().includes(prolificPidParam.toLowerCase())
      ) {
        return false;
      }

      return true;
    });

    return NextResponse.json({ sessions: filtered });
  } catch (error) {
    console.error("[GET /api/admin/sessions] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
