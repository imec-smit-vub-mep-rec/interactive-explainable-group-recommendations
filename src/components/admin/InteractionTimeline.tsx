import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export type InteractionEvent = {
  type: "rating_change" | "chat_message" | "click" | "view";
  timestamp: string;
  data: Record<string, unknown>;
};

const typeStyles: Record<InteractionEvent["type"], string> = {
  rating_change: "bg-blue-50 border-blue-200 text-blue-900",
  chat_message: "bg-green-50 border-green-200 text-green-900",
  click: "bg-gray-50 border-gray-200 text-gray-900",
  view: "bg-purple-50 border-purple-200 text-purple-900",
};

const formatTimestamp = (value?: string) => {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export default function InteractionTimeline({
  events,
}: {
  events: InteractionEvent[];
}) {
  if (!events || events.length === 0) {
    return <p className="text-sm text-muted-foreground">No interactions logged.</p>;
  }

  const sorted = [...events].sort((a, b) => {
    const aTime = new Date(a.timestamp).getTime();
    const bTime = new Date(b.timestamp).getTime();
    return aTime - bTime;
  });

  return (
    <div className="space-y-2">
      {sorted.map((event, index) => (
        <div
          key={`${event.timestamp}-${index}`}
          className={`rounded-md border p-2 ${typeStyles[event.type]}`}
        >
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="secondary">{event.type}</Badge>
            <span>{formatTimestamp(event.timestamp)}</span>
          </div>
          <Collapsible className="mt-2">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="px-2 text-xs">
                View details
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 rounded-md bg-white/70 p-2 text-xs">
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(event.data, null, 2)}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        </div>
      ))}
    </div>
  );
}
