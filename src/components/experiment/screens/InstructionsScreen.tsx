'use client';

import { NavigationButtons } from '../NavigationButtons';
import type { InteractionEvent } from '@/lib/db';
import type { SessionData } from '../ExperimentFlow';

interface InstructionsScreenProps {
  session: SessionData;
  saveAnswer: (field: string, value: unknown, sessionIdOverride?: string) => Promise<void>;
  updateSessionData: (updates: Partial<SessionData>) => void;
  recordInteraction: (type: InteractionEvent['type'], data: Record<string, unknown>) => void;
  isLoading: boolean;
  onNext: () => void;
  onBack?: () => void;
}

export function InstructionsScreen({
  isLoading,
  onNext,
  onBack,
}: InstructionsScreenProps) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Study Overview
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Please read the following instructions carefully before proceeding.
        </p>
      </div>

      {/* Instructions Content */}
      <div className="bg-blue-50 rounded-lg p-6 border border-blue-200 space-y-5">
        <p className="text-gray-700 leading-relaxed">
          In the next steps, you will be presented with <strong>three different scenarios</strong> containing the preferences of a group of 5 users concerning 10 different restaurants.
        </p>

        <div className="space-y-3">
          <p className="text-gray-700 leading-relaxed font-medium">
            For each scenario and based on the user preferences, you will complete the following activities:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-gray-700 leading-relaxed pl-2">
            <li>
              Given three restaurants previously visited by the group, we will ask you to <strong>suggest the next restaurant</strong> for the group to visit, excluding the previous three.
            </li>
            <li>
              You will <strong>check the recommended restaurant</strong> given by a software system which creates recommendations to groups based on the preferences of group members.
            </li>
            <li>
              Activity Nr. 1 is presented again, giving you the <strong>opportunity to change your answer</strong> if you prefer to do so, taking into consideration the output of the software system.
            </li>
          </ol>
        </div>

        <div className="border-t border-blue-200 pt-4 space-y-3">
          <p className="text-gray-700 leading-relaxed">
            After you have answered the previously mentioned questions, the <strong>second part of the survey</strong> will start. This second part contains an exit survey with 6 single-choice questions, each one also containing group members&apos; preferences about restaurants and potential recommendations.
            After 3 questions, you will be presented with a breather screen. Feel free to take a short break here. Grab a glass of water or a cup of coffee if you like.
          </p>
          <p className="text-gray-700 leading-relaxed">
            Before and after this exit survey, you are asked two questions where you <strong>rate your experience</strong> with the software system.
          </p>
        </div>

        <div className="bg-yellow-50 border border-yellow-300 rounded-md p-4 mt-4">
          <p className="text-yellow-800 font-medium">
            Please carefully read the description of each scenario and then answer the related questions.
          </p>
        </div>
      </div>

      {/* Navigation */}
      <NavigationButtons
        onBack={onBack}
        onNext={onNext}
        canGoBack={true}
        canGoNext={true}
        isLoading={isLoading}
        nextLabel="Begin Training"
      />
    </div>
  );
}
