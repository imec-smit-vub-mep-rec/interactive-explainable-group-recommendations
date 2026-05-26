"use client";

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ExternalLink, XCircle } from 'lucide-react';
import { PROLIFIC_CONFIG } from '@/lib/experiment-utils';

const REDIRECT_DELAY_MS = 5000;

export function AttentionFailScreen() {
  const searchParams = useSearchParams();
  const [secondsRemaining, setSecondsRemaining] = useState(
    Math.ceil(REDIRECT_DELAY_MS / 1000)
  );

  const getRedirectUrl = () => {
    const failedAttentionCc =
      searchParams.get('FACC') || searchParams.get('cc');

    // Default to env URL, but allow overriding just the `cc` query param.
    if (!failedAttentionCc) return PROLIFIC_CONFIG.FAILED_ATTENTION_CHECK_URL;

    try {
      const url = new URL(PROLIFIC_CONFIG.FAILED_ATTENTION_CHECK_URL);
      url.searchParams.set('cc', failedAttentionCc);
      return url.toString();
    } catch {
      // If env var isn't a valid URL for some reason, fall back to Prolific's
      // standard completion endpoint.
      return `https://app.prolific.com/submissions/complete?cc=${encodeURIComponent(
        failedAttentionCc
      )}`;
    }
  };

  const redirectToProlific = () => {
    window.location.href = getRedirectUrl();
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    const timeout = setTimeout(redirectToProlific, REDIRECT_DELAY_MS);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div className="space-y-8 text-center">
      <div className="flex justify-center">
        <div className="bg-red-100 rounded-full p-4">
          <XCircle className="w-16 h-16 text-red-600" />
        </div>
      </div>

      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">
          Sorry, you failed the attention checks
        </h1>
        <p className="text-lg text-gray-600 max-w-md mx-auto">
          Your participation in this study cannot continue. You will be redirected to
          Prolific in {secondsRemaining} second{secondsRemaining === 1 ? '' : 's'}.
        </p>
      </div>

      <div className="space-y-4">
        <Button
          onClick={redirectToProlific}
          className="bg-purple-600 hover:bg-purple-700 text-white"
        >
          Return to Prolific now
          <ExternalLink className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
