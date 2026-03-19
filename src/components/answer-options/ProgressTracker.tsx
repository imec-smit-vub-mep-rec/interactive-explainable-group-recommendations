"use client";

import { Progress } from "@/components/ui/progress";

interface ProgressTrackerProps {
  current: number;
  total: number;
  className?: string;
}

export function ProgressTracker({
  current,
  total,
  className = "",
}: ProgressTrackerProps) {
  const progress = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className={`w-full ${className} flex flex-row`}>
      <Progress value={progress} className="h-2 bg-ivory [&>div]:bg-maize" />
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-dark-purple">
          {/* Question {current} - {inBlock ? `${current + inBlock - 1}` : ''} of {total} */}
        </span>
        <span className="text-sm text-dark-purple/70">
          {Math.round(progress)}%
        </span>
      </div>
    </div>
  );
}
