'use client';

import { useState, useEffect, useRef } from 'react';
import { AnswerValue } from '@/lib/types';

interface Option {
  id: string;
  text: string;
  value: string;
}

interface SearchableSelectProps {
  question: string;
  options: Option[];
  value?: AnswerValue;
  onChange: (value: AnswerValue) => void;
  required?: boolean;
  placeholder?: string;
  onAutoNext?: () => void;
}

export function SearchableSelect({ 
  question, 
  options, 
  value, 
  onChange, 
  required = false,
  placeholder = "Search and select...",
  onAutoNext
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOption, setSelectedOption] = useState<Option | null>(null);
  const [filteredOptions, setFilteredOptions] = useState(options);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Reset state when question changes
  useEffect(() => {
    setIsOpen(false);
    setSearchTerm('');
    setSelectedOption(null);
  }, [question]);

  // Update from external value (allow empty string or falsy values to clear)
  useEffect(() => {
    if (value === '' || value === undefined || value === null) {
      setSelectedOption(null);
      setSearchTerm('');
      return;
    }
    const option = options.find(opt => opt.value === value);
    if (option) {
      setSelectedOption(option);
      setSearchTerm(option.text);
    }
  }, [value, options]);

  // Filter options based on search term
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredOptions(options);
    } else {
      const filtered = options.filter(option =>
        option.text.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredOptions(filtered);
    }
  }, [searchTerm, options]);

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Reset search term to selected option text if dropdown is closed without selection
        if (selectedOption) {
          setSearchTerm(selectedOption.text);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedOption]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSearchTerm = e.target.value;
    setSearchTerm(newSearchTerm);
    setIsOpen(true);
    
    // Clear selection if user is typing
    if (selectedOption && newSearchTerm !== selectedOption.text) {
      setSelectedOption(null);
      onChange('');
    }
  };

  const handleOptionSelect = (option: Option) => {
    setSelectedOption(option);
    setSearchTerm(option.text);
    setIsOpen(false);
    onChange(option.value);
    
    // Auto-advance after selection
    if (onAutoNext) {
      setTimeout(() => {
        onAutoNext();
      }, 500);
    }
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    if (selectedOption) {
      // Select all text when focusing
      setTimeout(() => {
        inputRef.current?.select();
      }, 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      if (selectedOption) {
        setSearchTerm(selectedOption.text);
      }
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-dark-purple">
        {question}
        {required && <span className="text-red-500 ml-1">*</span>}
      </h3>
      
      <div className="relative" ref={dropdownRef}>
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full px-4 py-3 border-2 border-dark-purple rounded-lg focus:border-maize focus:ring-maize focus:outline-none transition-colors"
        />
        
        {/* Dropdown arrow */}
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <svg
            className={`w-5 h-5 text-dark-purple transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Dropdown menu */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border-2 border-dark-purple rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleOptionSelect(option)}
                  className={`w-full px-4 py-3 text-left hover:bg-maize/20 transition-colors ${
                    selectedOption?.id === option.id ? 'bg-maize/30 font-semibold' : ''
                  }`}
                >
                  {option.text}
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-dark-purple/70">
                No countries found matching &quot;{searchTerm}&quot;
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
