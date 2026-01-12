'use client';

import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface NavigationButtonsProps {
  onBack?: () => void;
  onNext: () => void;
  canGoBack?: boolean;
  canGoNext?: boolean;
  isLoading?: boolean;
  nextLabel?: string;
  backLabel?: string;
  showBack?: boolean;
}

export function NavigationButtons({
  onBack,
  onNext,
  canGoBack = true,
  canGoNext = true,
  isLoading = false,
  nextLabel = 'Next',
  backLabel = 'Back',
  showBack = true,
}: NavigationButtonsProps) {
  return (
    <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
      <div>
        {showBack && onBack && (
          <Button
            variant="outline"
            onClick={onBack}
            disabled={!canGoBack || isLoading}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            {backLabel}
          </Button>
        )}
      </div>
      
      <Button
        onClick={onNext}
        disabled={!canGoNext || isLoading}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            {nextLabel}
            <ChevronRight className="w-4 h-4" />
          </>
        )}
      </Button>
    </div>
  );
}
