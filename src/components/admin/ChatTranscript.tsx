import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export type ChatLogRecord = {
  role: "user" | "assistant" | "error";
  content: string;
  timestamp: string;
  scenarioId?: string;
  taskIndex?: number;
  step?: string;
  metadata?: Record<string, unknown>;
};

const formatTimestamp = (value?: string) => {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const roleStyles: Record<ChatLogRecord["role"], string> = {
  user: "bg-blue-50 border-blue-200",
  assistant: "bg-gray-50 border-gray-200",
  error: "bg-red-50 border-red-200",
};

const roleBadges: Record<ChatLogRecord["role"], string> = {
  user: "User",
  assistant: "Assistant",
  error: "Error",
};

export default function ChatTranscript({ logs }: { logs: ChatLogRecord[] }) {
  if (!logs || logs.length === 0) {
    return <p className="text-sm text-muted-foreground">No chat logs found.</p>;
  }

  const sorted = [...logs].sort((a, b) => {
    const aTime = new Date(a.timestamp).getTime();
    const bTime = new Date(b.timestamp).getTime();
    return aTime - bTime;
  });

  return (
    <div className="space-y-3">
      {sorted.map((log, index) => {
        const align =
          log.role === "user" ? "justify-end text-right" : "justify-start";
        return (
          <article
            key={`${log.timestamp}-${index}`}
            className={`flex ${align}`}
            aria-label={`${roleBadges[log.role]} message`}
          >
            <div
              className={`max-w-[85%] rounded-lg border p-3 ${roleStyles[log.role]}`}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">{roleBadges[log.role]}</Badge>
                <span>{formatTimestamp(log.timestamp)}</span>
                {typeof log.taskIndex === "number" && (
                  <span>Task {log.taskIndex + 1}</span>
                )}
                {log.scenarioId && <span>Scenario {log.scenarioId}</span>}
                {log.step && <span>Step: {log.step}</span>}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{log.content}</p>

              {log.metadata && Object.keys(log.metadata).length > 0 && (
                <Collapsible className="mt-2">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="px-2 text-xs">
                      View metadata
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 rounded-md bg-white/70 p-2 text-xs">
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
