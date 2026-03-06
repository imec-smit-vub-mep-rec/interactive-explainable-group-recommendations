'use client';

import { Button } from '@/components/ui/button';
import { ExplanationStrategy } from '@/lib/types';
import { ChevronLeft, ChevronRight, Loader2, RotateCcw } from 'lucide-react';

interface NavigationButtonsProps {
  explanationStrategy?: ExplanationStrategy;
  currentStep?: string;
  onBack?: () => void;
  onNext: () => void;
  canGoBack?: boolean;
  canGoNext?: boolean;
  isLoading?: boolean;
  nextLabel?: string;
  backLabel?: string;
  showBack?: boolean;
  onResetRatings?: () => void;
}

export function NavigationButtons({
  explanationStrategy,
  currentStep,
  onBack,
  onNext,
  canGoBack = true,
  canGoNext = true,
  isLoading = false,
  nextLabel = 'Next',
  backLabel = 'Back',
  showBack = true,
  onResetRatings,
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

      {/* Reset Button - Only show for interactive explanation methods */}
      {(currentStep === "explore_explanation" || currentStep === "final_decision") && (explanationStrategy === "interactive_bar_chart" ||

        explanationStrategy === "pie_expl" ||
        explanationStrategy === "heatmap_expl" ||
        explanationStrategy === "chat_expl_with_tools" ||
        explanationStrategy === "chat_expl_with_tools_graph") && (
          <div className="flex justify-center" data-onboarding="footer-actions">
            <button
              onClick={() => {
                onResetRatings?.();
              }}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors font-medium flex items-center"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset to initial values
            </button>
          </div>
        )}
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
