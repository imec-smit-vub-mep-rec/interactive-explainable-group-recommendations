# Restaurant Recommendation Chatbot Setup

## Overview

This chatbot allows users to ask questions about restaurant recommendations and get explanations about how changes would affect the results. It uses Google Gemini via the Vercel AI SDK.

## Features

- **Explain Current Results**: Ask questions like "Why was Rest 1 recommended?"
- **Simulate Changes**: Ask "What if Alex's rating for Rest 4 increased to 5?"
- **Strategy Analysis**: Understand how different aggregation strategies work
- **Interactive Chat**: Real-time conversation with the AI assistant
- **Starter Suggestions**: Click on pre-made example questions to get started quickly
- **Streaming Responses**: Real-time response generation with live updates

## Setup Instructions

### 1. Environment Variables

Create a `.env.local` file in the project root with your Google API key:

```bash
# Google Gemini API Key
# Get your API key from: https://makersuite.google.com/app/apikey
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here
```

### 2. Install Dependencies

The required packages are already installed:
- `@ai-sdk/google` - Google Gemini integration
- `@ai-sdk/react` - React hooks for AI
- `ai` - Core AI SDK
- `zod` - Schema validation

### 3. Run the Application

```bash
npm run dev
```

## How to Use

1. **Select Text Explanation**: Choose "Text Explanation" from the explanation strategy options
2. **Use Starter Suggestions**: Click on any of the pre-made suggestion buttons to quickly ask common questions
3. **Ask Custom Questions**: Use the chat interface to ask your own questions like:
   - "What should change so that Rest 1 would become the preferred option?"
   - "What if Alex's rating for Rest 4 would increase to 5?"
   - "Explain why Rest 2 was recommended"
   - "What would happen if we switched to ADD strategy?"

## Technical Details

### Server Component (`/api/chat/route.ts`)
- Uses Google Gemini 1.5 Flash model
- Implements two tools:
  - `explainCurrentResult`: Explains the current recommendation
  - `alterMatrixAndExplainResult`: Simulates changes and shows results
- Restricts responses to restaurant recommendation topics only

### Client Component (`TextChat.tsx`)
- Uses AI Elements for UI components
- Handles streaming responses
- Integrates with the restaurant recommendation system
- Provides real-time chat interface

### Integration
- The chatbot is integrated into the `TextExplanation` component
- Receives current state data (ratings, strategy, recommendations)
- Only appears when "Text Explanation" is selected

## Example Questions

- "Why was Rest 1 recommended over Rest 2?"
- "What if Darcy's rating for Rest 3 changed from 1 to 5?"
- "How would the recommendation change if we used ADD strategy instead?"
- "What's the lowest rating that any group member gave to the recommended restaurant?"
- "If Jess changed her rating for Rest 4 to 5, would it become the top choice?"
