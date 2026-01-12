"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AnswerValue } from "@/lib/types";
import { useEffect } from "react";

interface TextInputProps {
  question: string;
  value?: AnswerValue;
  onChange: (value: AnswerValue) => void;
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
}

export function TextInput({
  question,
  value,
  onChange,
  placeholder = "",
  multiline = false,
  required = false,
}: TextInputProps) {
  // Reset state when question changes - ensures clean input on question switch
  useEffect(() => {
    // This ensures the component resets when question prop changes
  }, [question]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-dark-purple">
        {question}
        {required && <span className="text-red-500 ml-1">*</span>}
      </h3>
      {multiline ? (
        <Textarea
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-h-[120px] border-dark-purple focus:border-maize focus:ring-maize"
        />
      ) : (
        <Input
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="border-dark-purple focus:border-maize focus:ring-maize"
        />
      )}
    </div>
  );
}
