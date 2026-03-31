"use client";

import { Button } from '@/components/ui/button';
import { ExternalLink, XCircle } from 'lucide-react';
import { PROLIFIC_CONFIG } from '@/lib/experiment-utils';

interface AttentionFailScreenProps {
  attentionCheckAnswer?: string | null;
}

export function AttentionFailScreen({ attentionCheckAnswer }: AttentionFailScreenProps) {
  const attentionCheckAnswerLabel = attentionCheckAnswer
    ? `Restaurant ${attentionCheckAnswer}`
    : 'no restaurant';

  const handleProlificRedirect = () => {
    window.location.href = PROLIFIC_CONFIG.CANCEL_URL;
  };

  return (
    <div className="space-y-8 text-center">
      <div className="flex justify-center">
        <div className="bg-red-100 rounded-full p-4">
          <XCircle className="w-16 h-16 text-red-600" />
        </div>
      </div>

      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">
          You did not pass the initial attention check
        </h1>
        <p className="text-lg text-gray-600 max-w-md mx-auto">
          The attention check was on the previous page and asked you to indicate restaurant 4: &quot;This is an attention check. Please indicate restaurant 4&quot;.<br />
          {' '}You indicated {attentionCheckAnswerLabel}.
        </p>
        <p className="text-lg text-gray-600 max-w-md mx-auto">
          Your participation has ended and you can return to Prolific using the button below.
        </p>
      </div>

      <div className="space-y-4">
        <Button
          onClick={handleProlificRedirect}
          className="bg-purple-600 hover:bg-purple-700 text-white"
        >
          Return to Prolific
          <ExternalLink className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
