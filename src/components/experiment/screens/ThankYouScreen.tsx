'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, ExternalLink, Loader2 } from 'lucide-react';
import { PROLIFIC_CONFIG } from '@/lib/experiment-utils';
import type { InteractionEvent } from '@/lib/db';
import type { SessionData } from '../ExperimentFlow';

interface ThankYouScreenProps {
  session: SessionData;
  saveAnswer: (field: string, value: unknown, sessionIdOverride?: string) => Promise<void>;
  updateSessionData: (updates: Partial<SessionData>) => void;
  recordInteraction: (type: InteractionEvent['type'], data: Record<string, unknown>) => void;
  isLoading: boolean;
  onNext: () => void;
  onBack: () => void;
  onComplete: () => Promise<void>;
}

export function ThankYouScreen({
  session,
  isLoading,
  onComplete,
}: ThankYouScreenProps) {
  const [isCompleting, setIsCompleting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(session.isCompleted || false);
  
  const hasProlific = !!session.prolificPid;

  // Auto-complete on mount if not already completed
  useEffect(() => {
    const completeSession = async () => {
      if (!isCompleted && !isCompleting) {
        setIsCompleting(true);
        await onComplete();
        setIsCompleted(true);
        setIsCompleting(false);
      }
    };
    
    completeSession();
  }, []);

  const handleProlificRedirect = () => {
    window.location.href = PROLIFIC_CONFIG.COMPLETION_URL;
  };

  return (
    <div className="space-y-8 text-center">
      {/* Completion Status */}
      {isCompleting ? (
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />
          <p className="text-lg text-gray-600">Saving your responses...</p>
        </div>
      ) : (
        <>
          {/* Success Icon */}
          <div className="flex justify-center">
            <div className="bg-green-100 rounded-full p-4">
              <CheckCircle className="w-16 h-16 text-green-600" />
            </div>
          </div>

          {/* Thank You Message */}
          <div className="space-y-4">
            <h1 className="text-3xl font-bold text-gray-900">
              Thank You!
            </h1>
            <p className="text-lg text-gray-600 max-w-md mx-auto">
              You have successfully completed the experiment. Your responses have been saved.
            </p>
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-lg p-6 max-w-md mx-auto">
            <h2 className="font-semibold text-gray-800 mb-4">Experiment Summary</h2>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Session ID:</span>
                <span className="font-mono text-xs">{session.id.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span>Condition:</span>
                <span className="capitalize">{session.explanationModality.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span>Strategy:</span>
                <span className="uppercase">{session.aggregationStrategy}</span>
              </div>
            </div>
          </div>

          {/* Prolific Redirect or Close Message */}
          {hasProlific ? (
            <div className="space-y-4">
              <p className="text-gray-600">
                Please click the button below to complete your submission on Prolific.
              </p>
              <Button
                onClick={handleProlificRedirect}
                className="bg-purple-600 hover:bg-purple-700 text-white"
                disabled={isLoading}
              >
                Return to Prolific
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-600">
                You can now close this window.
              </p>
              <p className="text-sm text-gray-500">
                Thank you for participating in our research.
              </p>
            </div>
          )}

          {/* Research Info */}
          <div className="text-sm text-gray-500 pt-4 border-t">
            <p>
              If you have any questions about this study, please contact the research team.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
