'use client';

import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { NavigationButtons } from '../NavigationButtons';
import { FileText, ExternalLink } from 'lucide-react';
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
  onCreateSession,
  hasSession,
}: WelcomeScreenProps) {
  const [hasConsented, setHasConsented] = useState(false);
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

  const handleConsentChange = (checked: boolean) => {
    setHasConsented(checked);
    recordInteraction('click', { action: 'consent_checkbox', checked });
  };

  const handlePdfClick = () => {
    recordInteraction('click', { action: 'view_consent_pdf' });
  };

  const handleStartExperiment = async () => {
    if (!hasConsented) return;
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
      <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
        <div className="flex items-start gap-4">
          <div className="bg-blue-100 rounded-full p-3">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Informed Consent
            </h2>
            <p className="text-gray-600 mb-4">
              Please read the informed consent document carefully. This document explains
              the purpose of the study, what you will be asked to do, and your rights as
              a participant.
            </p>
            <a
              href="/informed_consent.pdf"
              target="_blank"
              rel="noopener noreferrer"
              onClick={handlePdfClick}
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
            >
              <FileText className="w-4 h-4" />
              View Informed Consent Document (PDF)
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Study Overview */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">
          What to Expect
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">Duration</h3>
            <p className="text-gray-600 text-sm">
              This study takes approximately 20-30 minutes to complete.
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">Tasks</h3>
            <p className="text-gray-600 text-sm">
              You will interact with a restaurant recommendation system and answer questions about it.
            </p>
          </div>
        </div>
      </div>

      {/* Consent Checkbox */}
      <div className="border-t pt-6">
        <div className="flex items-start gap-3">
          <Checkbox
            id="consent"
            checked={hasConsented}
            onCheckedChange={handleConsentChange}
            className="mt-1"
          />
          <Label
            htmlFor="consent"
            className="text-gray-700 cursor-pointer leading-relaxed"
          >
            I have read and understood the informed consent document. I agree to participate
            in this study and understand that I can withdraw at any time without penalty.
          </Label>
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
      <NavigationButtons
        onNext={handleStartExperiment}
        canGoNext={hasConsented && !isCreatingSession && !!recaptchaSiteKey}
        isLoading={isLoading || isCreatingSession}
        nextLabel={isCreatingSession ? 'Starting...' : 'Start Experiment'}
        showBack={false}
      />
    </div>
  );
}
