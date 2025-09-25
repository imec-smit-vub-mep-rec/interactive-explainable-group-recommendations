'use client';

import React, { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { Conversation, ConversationContent, ConversationEmptyState } from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageAvatar } from '@/components/ai-elements/message';
import { 
  PromptInput, 
  PromptInputBody, 
  PromptInputTextarea, 
  PromptInputToolbar, 
  PromptInputSubmit 
} from '@/components/ai-elements/prompt-input';
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion';

interface Person {
  name: string;
  pattern: string;
  color: string;
}

interface Restaurant {
  id: number;
  name: string;
  visited: boolean;
}

type AggregationStrategy = 'LMS' | 'ADD' | 'APP';

interface TextChatProps {
  people: Person[];
  restaurants: Restaurant[];
  ratings: number[][];
  strategy: AggregationStrategy;
  groupScores: number[];
  recommendedRestaurantIndices: number[];
}

// Starter suggestions for users
const suggestions = [
  "Why was this restaurant recommended?",
  "What if Alex's rating for Rest 4 increased to 5?",
  "What should change so that Rest 1 becomes the top choice?",
  "How would the recommendation change with ADD strategy?",
  "What if Darcy changed their rating for Rest 2 to 5?",
  "Explain the current recommendation strategy",
  "What if we used APP strategy instead?",
  "Show me the individual ratings for the recommended restaurant"
];

export default function TextChat({
  people,
  restaurants,
  ratings,
  strategy,
  groupScores,
  recommendedRestaurantIndices,
}: TextChatProps) {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status } = useChat();

  const handleSubmit = (message: any, event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim()) return;
    const context = {
      people,
      restaurants,
      ratings,
      strategy,
      groupScores,
      recommendedRestaurantIndices,
    };
    const text = `CONTEXT_JSON: ${JSON.stringify(context)}\n---\n${input}`;
    sendMessage({ text });
    setInput('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSuggestionClick = (suggestion: string) => {
    const context = {
      people,
      restaurants,
      ratings,
      strategy,
      groupScores,
      recommendedRestaurantIndices,
    };
    const text = `CONTEXT_JSON: ${JSON.stringify(context)}\n---\n${suggestion}`;
    sendMessage({ text });
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">Ask about the recommendation</h3>
        <p className="text-sm text-gray-600">
          Ask questions like "What should change so that Rest 1 would become the preferred option?" 
          or "What if Alex's rating for Rest 4 would increase to 5?"
        </p>
      </div>
      
      {/* Show suggestions when there are no messages */}
      {messages.length === 0 && (
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-3">Try these example questions:</p>
          <Suggestions>
            {suggestions.map((suggestion) => (
              <Suggestion
                key={suggestion}
                suggestion={suggestion}
                onClick={handleSuggestionClick}
              />
            ))}
          </Suggestions>
        </div>
      )}
      
      <Conversation className="h-96 border rounded-lg">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState 
              title="No messages yet"
              description="Click on a suggestion above or type your own question to get started"
            />
          ) : (
            messages.map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageAvatar 
                  src={message.role === 'user' ? '/user-avatar.png' : '/assistant-avatar.png'}
                  name={message.role === 'user' ? 'You' : 'Assistant'}
                />
                <MessageContent>
                  {'parts' in message
                    ? message.parts?.map((p: any, i: number) => (
                        <div key={i}>{p.type === 'text' ? p.text : null}</div>
                      ))
                    : (message as any).content}
                </MessageContent>
              </Message>
            ))
          )}
        </ConversationContent>
      </Conversation>

      <div className="mt-4">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea
              value={input}
              onChange={handleInputChange}
              placeholder="Ask about the restaurant recommendation..."
              disabled={status === 'streaming'}
            />
            <PromptInputToolbar>
              <PromptInputSubmit disabled={status === 'streaming'} />
            </PromptInputToolbar>
          </PromptInputBody>
        </PromptInput>
      </div>
    </div>
  );
}