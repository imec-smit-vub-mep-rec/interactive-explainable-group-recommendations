'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SCREENS, SCREEN_NAMES, STORAGE_KEYS, TOTAL_SCREENS } from '@/lib/experiment-utils';
import { ProgressTracker } from '@/components/survey/ProgressTracker';

// Screen components
import { WelcomeScreen } from './screens/WelcomeScreen';
import { DemographicsScreen } from './screens/DemographicsScreen';
import { InstructionsScreen } from './screens/InstructionsScreen';
import { TrainingScreen } from './screens/TrainingScreen';
import { PreliminaryUnderstandingScreen } from './screens/PreliminaryUnderstandingScreen';
import { ObjectiveTestScreen } from './screens/ObjectiveTestScreen';
import { RepeatUnderstandingScreen } from './screens/RepeatUnderstandingScreen';
import { DebriefingScreen } from './screens/DebriefingScreen';
import { NasaTlxScreen } from './screens/NasaTlxScreen';
import { FeedbackScreen } from './screens/FeedbackScreen';
import { ThankYouScreen } from './screens/ThankYouScreen';
import { AttentionFailScreen } from './screens/AttentionFailScreen';
import { DebugPanel } from './DebugPanel';

import type { ExplanationModality, AggregationStrategy, ScreenTiming, InteractionEvent, TrainingTaskData, ObjectiveTaskData, NasaTlxData } from '@/lib/db';

export interface SessionData {
  id: string;
  explanationModality: ExplanationModality;
  aggregationStrategy: AggregationStrategy;
  trainingScenarioIds: string[];
  testScenarioIds: string[];
  currentScreen: number;
  prolificPid?: string;
  prolificStudyId?: string;
  isCompleted?: boolean;
  isAttentionFail?: boolean;
  isBot?: boolean;
  
  // Collected data
  demographics?: {
    ageRange: string | null;
    gender: string | null;
  };
  trainingTasksData: TrainingTaskData[];
  preliminaryUnderstanding?: {
    understand: number | null;
    predict: number | null;
  };
  objectiveTasksData: ObjectiveTaskData[];
  repeatUnderstanding?: {
    understand: number | null;
    predict: number | null;
  };
  textualDebriefing?: string;
  nasaTlxData: NasaTlxData;
  additionalFeedback?: string;
  recaptchaToken?: string;
  reverseShibbolethResponse?: string;
  screenTimings: ScreenTiming[];
}

interface ExperimentFlowProps {
  initialSession?: SessionData;
  searchParams?: URLSearchParams;
}

export function ExperimentFlow({ initialSession, searchParams }: ExperimentFlowProps) {
  const [session, setSession] = useState<SessionData | null>(initialSession || null);
  const [currentScreen, setCurrentScreen] = useState(initialSession?.currentScreen || SCREENS.WELCOME);
  const [screenStartTime, setScreenStartTime] = useState<string>(new Date().toISOString());
  const [currentInteractions, setCurrentInteractions] = useState<InteractionEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const isNavigatingRef = useRef(false);

  // Save session to localStorage whenever it changes
  useEffect(() => {
    if (session) {
      localStorage.setItem(STORAGE_KEYS.SESSION_DATA, JSON.stringify(session));
    }
  }, [session]);

  // Create session function - called from WelcomeScreen after consent
  const createSession = useCallback(async (recaptchaToken?: string): Promise<SessionData | null> => {
    if (session) {
      return session; // Session already exists
    }

    setIsLoading(true);
    
    try {
      // Extract Prolific parameters from URL
      const prolificPid = searchParams?.get('PROLIFIC_PID') || null;
      const prolificStudyId = searchParams?.get('STUDY_ID') || null;
      const prolificSessionId = searchParams?.get('SESSION_ID') || null;
      const reference = searchParams?.get('ref') || null;
      const groupCode = searchParams?.get('group') || null;
      
      const response = await fetch('/api/experiment/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prolificPid,
          prolificStudyId,
          prolificSessionId,
          reference,
          recaptchaToken: recaptchaToken || null,
          groupCode,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create session');
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to create session');
      }
      
      const newSession: SessionData = {
        id: data.session.id,
        explanationModality: data.session.explanationModality,
        aggregationStrategy: data.session.aggregationStrategy,
        trainingScenarioIds: data.session.trainingScenarioIds,
        testScenarioIds: data.session.testScenarioIds,
        currentScreen: SCREENS.WELCOME, // Stay on welcome, onNext will move to demographics
        prolificPid: prolificPid || undefined,
        prolificStudyId: prolificStudyId || undefined,
        isCompleted: false,
        isAttentionFail: false,
        isBot: data.session.isBot || false,
        trainingTasksData: [],
        objectiveTasksData: [],
        nasaTlxData: {},
        screenTimings: [],
      };
      
      // Store session ID in localStorage
      localStorage.setItem(STORAGE_KEYS.SESSION_ID, newSession.id);
      localStorage.setItem(STORAGE_KEYS.SESSION_DATA, JSON.stringify(newSession));
      
      setSession(newSession);
      // Don't change screen here - let onNext handle navigation
      return newSession;
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [session, searchParams]);

  // Track screen start time
  useEffect(() => {
    setScreenStartTime(new Date().toISOString());
    setCurrentInteractions([]);
  }, [currentScreen]);

  // Save answer to database
  const saveAnswer = useCallback(async (field: string, value: unknown, sessionIdOverride?: string) => {
    const targetSessionId = sessionIdOverride || session?.id;
    if (!targetSessionId) return; // Can't save without session
    
    try {
      const response = await fetch('/api/experiment/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: targetSessionId,
          field,
          value,
          screenIndex: currentScreen,
        }),
      });
      
      if (!response.ok) {
        console.error('Failed to save answer');
        return;
      }

      const data = await response.json();
      if (data?.isAttentionFail) {
        setSession(prev => prev ? { ...prev, isAttentionFail: true } : prev);
        setCurrentScreen(SCREENS.ATTENTION_FAIL);
      }
    } catch (error) {
      console.error('Error saving answer:', error);
    }
  }, [session, currentScreen]);

  // Record interaction
  const recordInteraction = useCallback((type: InteractionEvent['type'], data: Record<string, unknown>) => {
    const interaction: InteractionEvent = {
      type,
      timestamp: new Date().toISOString(),
      data,
    };
    setCurrentInteractions(prev => [...prev, interaction]);
  }, []);

  // Navigate to next screen
  const goToNextScreen = useCallback(async () => {
    if (currentScreen >= TOTAL_SCREENS - 1) return;
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    setIsLoading(true);

    try {
    // Save screen timing if session exists
    if (session) {
      const screenTiming: ScreenTiming = {
        screenIndex: currentScreen,
        screenName: SCREEN_NAMES[currentScreen],
        startTime: screenStartTime,
        endTime: new Date().toISOString(),
        interactions: currentInteractions,
      };
      
      try {
        // Save screen timing and current screen
        await fetch('/api/experiment/answer', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: session.id,
            updates: { current_screen: currentScreen + 1 },
            screenTiming,
          }),
        });
        
        // Update local state
        setSession(prev => prev ? {
          ...prev,
          currentScreen: currentScreen + 1,
          screenTimings: [...prev.screenTimings, screenTiming],
        } : null);
        setCurrentScreen(prev => prev + 1);
      } catch (error) {
        console.error('Error navigating:', error);
      } finally {
        setIsLoading(false);
      }
    } else {
      // No session yet, just move to next screen
      setCurrentScreen(prev => prev + 1);
      setIsLoading(false);
    }
    } finally {
      isNavigatingRef.current = false;
    }
  }, [currentScreen, screenStartTime, currentInteractions, session]);

  // Update session data locally
  const updateSessionData = useCallback((updates: Partial<SessionData>) => {
    setSession(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  useEffect(() => {
    if (session?.isAttentionFail) {
      setCurrentScreen(SCREENS.ATTENTION_FAIL);
    }
  }, [session?.isAttentionFail]);

  // Complete the experiment
  const completeExperiment = useCallback(async () => {
    if (!session) return;
    
    setIsLoading(true);
    
    // Save final screen timing
    const screenTiming: ScreenTiming = {
      screenIndex: currentScreen,
      screenName: SCREEN_NAMES[currentScreen],
      startTime: screenStartTime,
      endTime: new Date().toISOString(),
      interactions: currentInteractions,
    };
    
    try {
      await fetch('/api/experiment/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          finalScreenTiming: screenTiming,
        }),
      });
      
      // Update localStorage
      localStorage.setItem(STORAGE_KEYS.IS_COMPLETED, 'true');
      
      setSession(prev => prev ? { ...prev, isCompleted: true } : null);
    } catch (error) {
      console.error('Error completing experiment:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentScreen, screenStartTime, currentInteractions, session]);

  // Render current screen
  const renderScreen = () => {
    const baseProps = {
      saveAnswer,
      updateSessionData,
      recordInteraction,
      isLoading,
      onNext: goToNextScreen,
      onBack: undefined,
    };

    switch (currentScreen) {
      case SCREENS.WELCOME:
        return (
          <WelcomeScreen
            session={session || undefined}
            {...baseProps}
            onCreateSession={createSession}
            onCancelParticipation={() => {
              setCurrentScreen(SCREENS.THANK_YOU);
            }}
            hasSession={!!session}
          />
        );
      
      case SCREENS.DEMOGRAPHICS:
        if (!session) {
          return <div>Please complete the consent form first.</div>;
        }
        return <DemographicsScreen session={session} {...baseProps} />;
      
      case SCREENS.INSTRUCTIONS:
        if (!session) {
          return <div>Please complete the consent form first.</div>;
        }
        return <InstructionsScreen session={session} {...baseProps} />;
      
      case SCREENS.TRAINING:
        if (!session) {
          return <div>Session not initialized. Please start from the beginning.</div>;
        }
        return <TrainingScreen session={session} {...baseProps} />;
      
      case SCREENS.PRELIMINARY_UNDERSTANDING:
        if (!session) {
          return <div>Session not initialized. Please start from the beginning.</div>;
        }
        return <PreliminaryUnderstandingScreen session={session} {...baseProps} />;
      
      case SCREENS.OBJECTIVE_TEST:
        if (!session) {
          return <div>Session not initialized. Please start from the beginning.</div>;
        }
        return <ObjectiveTestScreen session={session} {...baseProps} />;
      
      case SCREENS.REPEAT_UNDERSTANDING:
        if (!session) {
          return <div>Session not initialized. Please start from the beginning.</div>;
        }
        return <RepeatUnderstandingScreen session={session} {...baseProps} />;
      
      case SCREENS.DEBRIEFING:
        if (!session) {
          return <div>Session not initialized. Please start from the beginning.</div>;
        }
        return <DebriefingScreen session={session} {...baseProps} />;
      
      case SCREENS.NASA_TLX:
        if (!session) {
          return <div>Session not initialized. Please start from the beginning.</div>;
        }
        return <NasaTlxScreen session={session} {...baseProps} />;
      
      case SCREENS.FEEDBACK:
        if (!session) {
          return <div>Session not initialized. Please start from the beginning.</div>;
        }
        return <FeedbackScreen session={session} {...baseProps} />;
      
      case SCREENS.THANK_YOU:
        return (
          <ThankYouScreen
            session={session || undefined}
            {...baseProps}
            onComplete={completeExperiment}
          />
        );
      
      case SCREENS.ATTENTION_FAIL:
        return <AttentionFailScreen />;
      
      default:
        return <div>Unknown screen</div>;
    }
  };

  // Don't show progress on welcome or thank you screens
  const showProgress = currentScreen > SCREENS.WELCOME && currentScreen < SCREENS.THANK_YOU;

  // Debug mode: restart experiment with new session
  const handleDebugRestart = useCallback(() => {
    // Reset local state
    setSession(null);
    setCurrentScreen(SCREENS.WELCOME);
    setScreenStartTime(new Date().toISOString());
    setCurrentInteractions([]);
    
    // Reload the page to start fresh
    window.location.reload();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-4">
        {showProgress && (
          <div className="mb-4">
            <ProgressTracker
              current={currentScreen}
              total={TOTAL_SCREENS - 1} // Don't count thank you
            />
          </div>
        )}
        
        <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
          {renderScreen()}
        </div>
      </div>
      
      {/* Debug Panel - only visible when NEXT_PUBLIC_DEBUG_MODE=true */}
      <DebugPanel
        session={session}
        currentScreen={currentScreen}
        onRestart={handleDebugRestart}
      />
    </div>
  );
}
