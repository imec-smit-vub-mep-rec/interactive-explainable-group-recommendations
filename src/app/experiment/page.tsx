'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ExperimentFlow, SessionData } from '@/components/experiment/ExperimentFlow';
import { STORAGE_KEYS, SCREENS } from '@/lib/experiment-utils';
import { Loader2 } from 'lucide-react';

function ExperimentContent() {
  const searchParams = useSearchParams();
  const [session, setSession] = useState<SessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        // Check if session already exists in localStorage
        const existingSessionId = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
        const isCompleted = localStorage.getItem(STORAGE_KEYS.IS_COMPLETED) === 'true';
        
        if (existingSessionId) {
          // Try to restore existing session
          const response = await fetch(`/api/experiment/session?sessionId=${existingSessionId}`);
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.success) {
              // Session exists, restore it
              const restoredSession: SessionData = {
                id: data.session.id,
                explanationModality: data.session.explanationModality,
                aggregationStrategy: data.session.aggregationStrategy,
                trainingScenarioIds: data.session.trainingScenarioIds,
                testScenarioIds: data.session.testScenarioIds,
                currentScreen: data.session.currentScreen,
                prolificPid: data.session.prolificPid,
                prolificStudyId: data.session.prolificStudyId,
                isCompleted: data.session.isCompleted,
                demographics: data.session.demographics,
                trainingTasksData: data.session.trainingTasksData || [],
                preliminaryUnderstanding: data.session.preliminaryUnderstanding,
                objectiveTasksData: data.session.objectiveTasksData || [],
                repeatUnderstanding: data.session.repeatUnderstanding,
                textualDebriefing: data.session.textualDebriefing,
                nasaTlxData: data.session.nasaTlxData || {},
                additionalFeedback: data.session.additionalFeedback,
                reverseShibbolethResponse: data.session.reverseShibbolethResponse,
                recaptchaToken: data.session.recaptchaToken,
                screenTimings: data.session.screenTimings || [],
              };
              
              // If completed, show thank you screen
              if (restoredSession.isCompleted || isCompleted) {
                restoredSession.currentScreen = SCREENS.THANK_YOU;
                restoredSession.isCompleted = true;
              }
              
              setSession(restoredSession);
              setIsLoading(false);
              return;
            }
          }
        }
        
        // No existing session - don't create one yet, wait for consent
        // Session will be created when user clicks "Start Experiment"
        setIsLoading(false);
      } catch (err) {
        console.error('Error checking session:', err);
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        setIsLoading(false);
      }
    };
    
    checkExistingSession();
  }, [searchParams]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto" />
          <p className="text-lg text-gray-600">Loading experiment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md p-8 bg-white rounded-lg shadow-lg">
          <div className="text-red-500 text-5xl">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900">Error</h1>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // If no session exists, show welcome screen to get consent first
  // Pass searchParams so session can be created with Prolific info when consent is given
  if (!session) {
    return <ExperimentFlow searchParams={searchParams} />;
  }

  return <ExperimentFlow initialSession={session} />;
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto" />
        <p className="text-lg text-gray-600">Loading experiment...</p>
      </div>
    </div>
  );
}

export default function ExperimentPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ExperimentContent />
    </Suspense>
  );
}
