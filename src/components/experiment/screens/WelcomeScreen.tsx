'use client';

import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { NavigationButtons } from '../NavigationButtons';
import { Button } from '@/components/ui/button';
import type { InteractionEvent } from '@/lib/db';
import type { SessionData } from '../ExperimentFlow';

interface WelcomeScreenProps {
  session?: SessionData;
  saveAnswer: (field: string, value: unknown, sessionIdOverride?: string) => Promise<void>;
  updateSessionData: (updates: Partial<SessionData>) => void;
  recordInteraction: (type: InteractionEvent['type'], data: Record<string, unknown>) => void;
  isLoading: boolean;
  onNext: () => void;
  onBack: () => void;
  onCancelParticipation?: () => void;
  onCreateSession?: (recaptchaToken?: string) => Promise<SessionData | null>;
  hasSession?: boolean;
}

export function WelcomeScreen({
  session,
  saveAnswer,
  updateSessionData,
  isLoading,
  onNext,
  recordInteraction,
  onCancelParticipation,
  onCreateSession,
  hasSession,
}: WelcomeScreenProps) {
  const [hasReadInfo, setHasReadInfo] = useState(false);
  const [agreesToParticipate, setAgreesToParticipate] = useState(false);
  const [isAtLeast18, setIsAtLeast18] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [recaptchaError, setRecaptchaError] = useState<string | null>(null);
  const [isRecaptchaReady, setIsRecaptchaReady] = useState(false);
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '';

  useEffect(() => {
    if (!recaptchaSiteKey) return;
    if (typeof window === 'undefined') return;

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src^="https://www.google.com/recaptcha/api.js"]'
    );

    if (existingScript) {
      if ((window as typeof window & { grecaptcha?: { ready: (cb: () => void) => void } }).grecaptcha) {
        (window as typeof window & { grecaptcha?: { ready: (cb: () => void) => void } }).grecaptcha?.ready(() => {
          setIsRecaptchaReady(true);
        });
      }
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${recaptchaSiteKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      (window as typeof window & { grecaptcha?: { ready: (cb: () => void) => void } }).grecaptcha?.ready(() => {
        setIsRecaptchaReady(true);
      });
    };
    script.onerror = () => {
      setRecaptchaError('Failed to load reCAPTCHA.');
    };
    document.head.appendChild(script);
  }, [recaptchaSiteKey]);

  const executeRecaptcha = async (): Promise<string | null> => {
    if (!recaptchaSiteKey) {
      setRecaptchaError('reCAPTCHA site key is missing. Please set NEXT_PUBLIC_RECAPTCHA_SITE_KEY.');
      return null;
    }
    if (!isRecaptchaReady) {
      setRecaptchaError('reCAPTCHA is still loading. Please try again.');
      return null;
    }

    const grecaptcha = (window as typeof window & {
      grecaptcha?: { execute: (key: string, options: { action: string }) => Promise<string> };
    }).grecaptcha;

    if (!grecaptcha) {
      setRecaptchaError('reCAPTCHA is not available. Please refresh the page.');
      return null;
    }

    try {
      const token = await grecaptcha.execute(recaptchaSiteKey, { action: 'start_experiment' });
      setRecaptchaToken(token);
      setRecaptchaError(null);
      recordInteraction('click', { action: 'recaptcha_execute', tokenPresent: Boolean(token) });
      return token;
    } catch (error) {
      console.error('reCAPTCHA execution failed:', error);
      setRecaptchaError('reCAPTCHA failed. Please try again.');
      return null;
    }
  };

  const allConsented = hasReadInfo && agreesToParticipate && isAtLeast18;

  const handleCheckboxChange = (field: string, checked: boolean) => {
    if (field === 'hasReadInfo') setHasReadInfo(checked);
    if (field === 'agreesToParticipate') setAgreesToParticipate(checked);
    if (field === 'isAtLeast18') setIsAtLeast18(checked);
    recordInteraction('click', { action: `consent_checkbox_${field}`, checked });
  };

  const handleStartExperiment = async () => {
    if (!allConsented) return;
    const token = await executeRecaptcha();
    if (!token) return;
    
    setIsCreatingSession(true);
    recordInteraction('click', { action: 'start_experiment' });
    
    try {
      // Create session if it doesn't exist yet
      let createdSession = session || null;
      if (!hasSession && onCreateSession) {
        createdSession = await onCreateSession(token);
      }
      const sessionId = createdSession?.id || session?.id;
      if (sessionId) {
        await saveAnswer('recaptcha_token', token, sessionId);
        updateSessionData({ recaptchaToken: token });
      }
      // Move to next screen (demographics)
      onNext();
    } catch (error) {
      console.error('Error starting experiment:', error);
      alert('Failed to start experiment. Please try again.');
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleCancelParticipation = () => {
    recordInteraction('click', { action: 'cancel_participation' });
    onCancelParticipation?.();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Welcome to the Study
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Thank you for participating in this research study about group recommendation systems.
          Before we begin, please read and acknowledge the informed consent document.
        </p>
      </div>

      {/* Informed Consent Section */}
      <div className="bg-blue-50 rounded-lg p-6 border border-blue-200 space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Informed Consent
        </h2>
        <p className="text-gray-700 leading-relaxed">
          The purpose of this study is to analyse different ways to present group recommendations to users. The study is conducted by Ulysse Maes (Doctoral Researcher at IMEC-SMIT, Vrije Universiteit Brussel), Cedric Waterschoot (Postdoctoral Researcher at Maastricht University, DACS) and Francesco Barile (Assistant Professor at Maastricht University, DACS).
        </p>
        <p className="text-gray-700 leading-relaxed">
          Your participation in this research study is voluntary. You may choose not to participate. If you decide to participate in this research survey, you may withdraw at any time. If you do not complete the survey, we will treat it as a withdrawal and your answers thus far will not be used.
        </p>
        <p className="text-gray-700 leading-relaxed">
          The procedure involves evaluating several depicted scenarios and answering to a survey. You will be asked to optionally provide demographic info (age group and gender). These are only collected for representativeness check, and not used for further analyses. No further personal data will be stored.
          You will be asked to interact with a group recommendation system and answer questions about it.
          You will be asked to answer approximately 10 questions about the system, and 5 questions about your experience with the system.
          The whole experiment should have a duration of about 15-20 minutes.
        </p>
        <p className="text-gray-700 leading-relaxed">
          If you have any question about the research study, please contact Ulysse Maes (<a href="mailto:ulysse.jan.l.maes@vub.be" className="text-blue-600 hover:underline">ulysse.jan.l.maes@vub.be</a>), Cedric Waterschoot (<a href="mailto:cedric.waterschoot@maastrichtuniversity.nl" className="text-blue-600 hover:underline">cedric.waterschoot@maastrichtuniversity.nl</a>) or Francesco Barile (<a href="mailto:f.barile@maastrichtuniversity.nl" className="text-blue-600 hover:underline">f.barile@maastrichtuniversity.nl</a>).
        </p>
        <p className="text-gray-700 leading-relaxed">
          This research has been reviewed by Ethics Review Committee Inner City faculties (ERCIC) of Maastricht University.
        </p>
      </div>

      {/* Consent Checkboxes */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Electronic Consent</h3>
        <p className="text-gray-600 mb-4">Please select your choices below. All three are required to participate.</p>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="consent-read"
              checked={hasReadInfo}
              onCheckedChange={(checked: boolean) => handleCheckboxChange('hasReadInfo', checked)}
              className="mt-1"
            />
            <Label
              htmlFor="consent-read"
              className="text-gray-700 cursor-pointer leading-relaxed"
            >
              I have read the information above
            </Label>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox
              id="consent-agree"
              checked={agreesToParticipate}
              onCheckedChange={(checked: boolean) => handleCheckboxChange('agreesToParticipate', checked)}
              className="mt-1"
            />
            <Label
              htmlFor="consent-agree"
              className="text-gray-700 cursor-pointer leading-relaxed"
            >
              I voluntarily agree to participate
            </Label>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox
              id="consent-age"
              checked={isAtLeast18}
              onCheckedChange={(checked: boolean) => handleCheckboxChange('isAtLeast18', checked)}
              className="mt-1"
            />
            <Label
              htmlFor="consent-age"
              className="text-gray-700 cursor-pointer leading-relaxed"
            >
              I am at least 18 years old
            </Label>
          </div>
        </div>
      </div>

      {/* reCAPTCHA (v3) */}
      <div className="space-y-2">
        {!recaptchaSiteKey && (
          <p className="text-sm text-red-600">
            reCAPTCHA site key is missing. Please set `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`.
          </p>
        )}
        {recaptchaError && (
          <p className="text-sm text-red-600">{recaptchaError}</p>
        )}
      </div>

      {/* Navigation */}
      <div className="space-y-3">
        <NavigationButtons
          onNext={handleStartExperiment}
          canGoNext={allConsented && !isCreatingSession && !!recaptchaSiteKey}
          isLoading={isLoading || isCreatingSession}
          nextLabel={isCreatingSession ? 'Starting...' : 'Start Experiment'}
          showBack={false}
        />
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancelParticipation}
          >
            Cancel participation
          </Button>
        </div>
      </div>
    </div>
  );
}
