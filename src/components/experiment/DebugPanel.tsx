'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Bug, Trash2, RefreshCw, Copy, Check } from 'lucide-react';
import { STORAGE_KEYS, SCREEN_NAMES } from '@/lib/experiment-utils';
import type { SessionData } from './ExperimentFlow';

interface DebugPanelProps {
  session: SessionData | null;
  currentScreen: number;
  onRestart: () => void;
}

export function DebugPanel({ session, currentScreen, onRestart }: DebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Only show in debug mode
  if (process.env.NEXT_PUBLIC_DEBUG_MODE !== 'true') {
    return null;
  }

  const handleClearAndRestart = () => {
    // Clear all experiment-related localStorage
    localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
    localStorage.removeItem(STORAGE_KEYS.IS_COMPLETED);
    localStorage.removeItem(STORAGE_KEYS.SESSION_DATA);
    
    // Call the restart callback
    onRestart();
  };

  const handleCopySession = async () => {
    if (session) {
      await navigator.clipboard.writeText(JSON.stringify(session, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Toggle Button */}
      <div className="flex flex-col items-end gap-2">
        {isExpanded && (
          <div className="bg-gray-900 text-white rounded-lg shadow-xl p-4 max-w-md max-h-96 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-yellow-400 flex items-center gap-2">
                <Bug className="w-4 h-4" />
                Debug Panel
              </h3>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopySession}
                  className="h-7 px-2 text-gray-300 hover:text-white hover:bg-gray-700"
                  title="Copy session data"
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Session Info */}
            <div className="space-y-3 text-sm">
              <div className="bg-gray-800 rounded p-2">
                <div className="text-gray-400 text-xs mb-1">Session ID</div>
                <div className="font-mono text-xs break-all">
                  {session?.id || 'No session'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-800 rounded p-2">
                  <div className="text-gray-400 text-xs mb-1">Screen</div>
                  <div className="font-medium">
                    {currentScreen} - {SCREEN_NAMES[currentScreen]}
                  </div>
                </div>
                <div className="bg-gray-800 rounded p-2">
                  <div className="text-gray-400 text-xs mb-1">Completed</div>
                  <div className={`font-medium ${session?.isCompleted ? 'text-green-400' : 'text-gray-300'}`}>
                    {session?.isCompleted ? 'Yes' : 'No'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-800 rounded p-2">
                  <div className="text-gray-400 text-xs mb-1">Explanation</div>
                  <div className="font-medium text-blue-400">
                    {session?.explanationModality || 'N/A'}
                  </div>
                </div>
                <div className="bg-gray-800 rounded p-2">
                  <div className="text-gray-400 text-xs mb-1">Strategy</div>
                  <div className="font-medium text-purple-400 uppercase">
                    {session?.aggregationStrategy || 'N/A'}
                  </div>
                </div>
              </div>

              {session?.prolificPid && (
                <div className="bg-gray-800 rounded p-2">
                  <div className="text-gray-400 text-xs mb-1">Prolific PID</div>
                  <div className="font-mono text-xs">{session.prolificPid}</div>
                </div>
              )}

              <div className="bg-gray-800 rounded p-2">
                <div className="text-gray-400 text-xs mb-1">Training Scenarios</div>
                <div className="font-mono text-xs">
                  {session?.trainingScenarioIds?.join(', ') || 'N/A'}
                </div>
              </div>

              <div className="bg-gray-800 rounded p-2">
                <div className="text-gray-400 text-xs mb-1">Test Scenarios</div>
                <div className="font-mono text-xs">
                  {session?.testScenarioIds?.join(', ') || 'N/A'}
                </div>
              </div>

              <div className="bg-gray-800 rounded p-2">
                <div className="text-gray-400 text-xs mb-1">Demographics</div>
                <div className="text-xs">
                  Birth Year: {session?.demographics?.birthYear || 'N/A'} | 
                  Gender: {session?.demographics?.gender || 'N/A'}
                </div>
              </div>

              <div className="bg-gray-800 rounded p-2">
                <div className="text-gray-400 text-xs mb-1">Training Tasks Completed</div>
                <div className="font-medium">
                  {session?.trainingTasksData?.filter(t => t?.endTime).length || 0} / {session?.trainingScenarioIds?.length || 0}
                </div>
              </div>

              <div className="bg-gray-800 rounded p-2">
                <div className="text-gray-400 text-xs mb-1">Test Tasks Completed</div>
                <div className="font-medium">
                  {session?.objectiveTasksData?.filter(t => t?.endTime).length || 0} / {session?.testScenarioIds?.length || 0}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 pt-4 border-t border-gray-700 space-y-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClearAndRestart}
                className="w-full flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Clear Session & Restart
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
                className="w-full flex items-center justify-center gap-2 bg-gray-700 border-gray-600 hover:bg-gray-600"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Page
              </Button>
            </div>
          </div>
        )}

        <Button
          onClick={() => setIsExpanded(!isExpanded)}
          className="bg-yellow-500 hover:bg-yellow-600 text-black rounded-full w-12 h-12 p-0 shadow-lg"
          title="Debug Panel"
        >
          {isExpanded ? (
            <ChevronDown className="w-6 h-6" />
          ) : (
            <Bug className="w-6 h-6" />
          )}
        </Button>
      </div>
    </div>
  );
}
