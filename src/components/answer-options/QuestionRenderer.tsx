'use client';

import { Question, AnswerValue } from '@/lib/types';
import { MultipleChoice } from './MultipleChoice';
import { CheckboxQuestion } from './CheckboxQuestion';
import { TextInput } from './TextInput';
import { RatingScale } from './RatingScale';
import { NumberInput } from './NumberInput';
import { LikertGrid } from './LikertGrid';
import { SearchableSelect } from './SearchableSelect';

interface QuestionRendererProps {
  question: Question;
  value?: AnswerValue;
  onChange: (value: AnswerValue) => void;
  onAutoNext?: () => void;
}

export function QuestionRenderer({ question, value, onChange, onAutoNext }: QuestionRendererProps) {
  switch (question.type) {
    case 'multipleChoice':
      return (
        <MultipleChoice
          question={question.text}
          options={question.choices || []}
          value={value}
          onChange={onChange}
          required={question.required}
          onAutoNext={onAutoNext}
        />
      );
    
    case 'checkbox':
      return (
        <CheckboxQuestion
          question={question.text}
          options={question.choices || []}
          value={value as string[]}
          onChange={onChange}
          required={question.required}
        />
      );
    
    case 'textInput':
      return (
        <TextInput
          question={question.text}
          value={value as string}
          onChange={onChange}
          placeholder={question.placeholder}
          multiline={true}
          required={question.required}
        />
      );
    
    case 'textDisplay':
      return (
        <div className="text-center py-8">
          <p className="text-lg text-dark-purple">{question.text}</p>
        </div>
      );
    
    case 'rating':
      return (
        <RatingScale
          question={question.text}
          value={value as number}
          onChange={onChange}
          min={question.min}
          max={question.max}
          required={question.required}
          onAutoNext={onAutoNext}
        />
      );
    
    case 'number':
      return (
        <NumberInput
          question={question.text}
          value={value as number}
          onChange={onChange}
          placeholder={question.placeholder}
          required={question.required}
          min={question.min}
          max={question.max}
        />
      );
    
    case 'likertGrid':
      return (
        <LikertGrid
          question={question.text}
          statements={question.statements || []}
          scale={question.scale || []}
          scaleLabels={question.scaleLabels}
          questionIds={question.questionIds}
          value={value}
          onChange={onChange}
          required={question.required}
          onAutoNext={onAutoNext}
        />
      );
    
    case 'searchableSelect':
      return (
        <SearchableSelect
          question={question.text}
          options={question.choices || []}
          value={value}
          onChange={onChange}
          required={question.required}
          placeholder={question.placeholder}
          onAutoNext={onAutoNext}
        />
      );
    
    default:
      return <div>Unsupported question type</div>;
  }
}
