import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const SCALE = [1, 2, 3, 4, 5, 6, 7];
const SCALE_LABELS = {
  1: 'Strongly Disagree',
  4: 'Neutral',
  7: 'Strongly Agree',
};

interface UnderstandingQuestionProps {
  idPrefix: string;
  label: string;
  value: number | null;
  onChange: (value: number) => void;
}

export function UnderstandingQuestion({
  idPrefix,
  label,
  value,
  onChange,
}: UnderstandingQuestionProps) {
  return (
    <div className="space-y-8">
      <Label className="text-lg font-medium text-gray-900">{label}</Label>
      <RadioGroup
        value={value?.toString() || ''}
        onValueChange={(selected) => onChange(parseInt(selected))}
        className="flex flex-col space-y-3 mt-4"
      >
        <div className="flex items-start justify-between">
          {SCALE.map((scaleValue) => (
            <div key={scaleValue} className="flex flex-col items-center">
              <RadioGroupItem value={scaleValue.toString()} id={`${idPrefix}-${scaleValue}`} />
              <Label
                htmlFor={`${idPrefix}-${scaleValue}`}
                className="mt-2 text-sm text-gray-600 cursor-pointer"
              >
                {scaleValue}
              </Label>
              {SCALE_LABELS[scaleValue as keyof typeof SCALE_LABELS] && (
                <span className="text-xs text-gray-400 mt-1 text-center max-w-16">
                  {SCALE_LABELS[scaleValue as keyof typeof SCALE_LABELS]}
                </span>
              )}
            </div>
          ))}
        </div>
      </RadioGroup>
    </div>
  );
}
