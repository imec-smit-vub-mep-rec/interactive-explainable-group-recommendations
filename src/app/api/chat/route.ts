import { google } from '@ai-sdk/google';
import { streamText, tool } from 'ai';
import { z } from 'zod';

// Define the data structures
const PersonSchema = z.object({
  name: z.string(),
  pattern: z.string(),
  color: z.string(),
});

const RestaurantSchema = z.object({
  id: z.number(),
  name: z.string(),
  visited: z.boolean(),
});

const AggregationStrategySchema = z.enum(['LMS', 'ADD', 'APP']);

const RestaurantRecommendationDataSchema = z.object({
  people: z.array(PersonSchema),
  restaurants: z.array(RestaurantSchema),
  ratings: z.array(z.array(z.number())),
  strategy: AggregationStrategySchema,
  groupScores: z.array(z.number()),
  recommendedRestaurantIndices: z.array(z.number()),
});


export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = await streamText({
    model: google('gemini-1.5-flash'),
    messages,
    tools: {
      explainCurrentResult: tool({
        description: 'Explain the current restaurant recommendation result based on the given data',
        inputSchema: z.object({}),
        execute: async () => {
          const lastUser = [...messages].reverse().find((m: any) => m.role === 'user');
          const textParts: string[] = (lastUser?.parts || [])
            .filter((p: any) => p.type === 'text' && typeof p.text === 'string')
            .map((p: any) => p.text);
          const full = textParts.join('\n');
          const jsonMatch = full.match(/CONTEXT_JSON:\s*([\s\S]*?)\n---/);
          if (!jsonMatch) return 'No context found in the message.';
          let data: any;
          try {
            data = JSON.parse(jsonMatch[1]);
          } catch {
            return 'Invalid context JSON provided.';
          }
          const { people, restaurants, ratings, strategy, groupScores, recommendedRestaurantIndices } = data;

          const recommendedRestaurants = recommendedRestaurantIndices.map((i: number) => restaurants[i].name);

          let explanation = `Current recommendation using ${strategy} strategy:\n\n`;
          explanation += `Recommended restaurants: ${recommendedRestaurants.join(', ')}\n\n`;

          switch (strategy) {
            case 'LMS':
              explanation += `Strategy: Least Misery Strategy - minimizes the lowest rating among group members.\n`;
              break;
            case 'ADD':
              explanation += `Strategy: Additive Strategy - maximizes the total rating sum across all group members.\n`;
              break;
            case 'APP':
              explanation += `Strategy: Approval Voting Strategy - maximizes the number of votes above 3.\n`;
              break;
          }

          explanation += `\nScores for recommended restaurants:\n`;
          recommendedRestaurantIndices.forEach((index: number) => {
            const restaurant = restaurants[index];
            const score = groupScores[index];
            explanation += `- ${restaurant.name}: ${score}\n`;
          });

          explanation += `\nIndividual ratings for recommended restaurants:\n`;
          recommendedRestaurantIndices.forEach((index: number) => {
            const restaurant = restaurants[index];
            explanation += `\n${restaurant.name}:\n`;
            people.forEach((person: any, personIndex: number) => {
              const rating = ratings[personIndex][index];
              explanation += `  ${person.name}: ${rating}/5\n`;
            });
          });

          return explanation;
        },
      }),
      alterMatrixAndExplainResult: tool({
        description: 'Simulate changes to the rating matrix and explain how it would affect the recommendation',
        inputSchema: z.object({
          changes: z.array(z.object({
            personName: z.string(),
            restaurantName: z.string(),
            newRating: z.number().min(1).max(5),
          })),
        }),
        execute: async ({ changes }) => {
          const lastUser = [...messages].reverse().find((m: any) => m.role === 'user');
          const textParts: string[] = (lastUser?.parts || [])
            .filter((p: any) => p.type === 'text' && typeof p.text === 'string')
            .map((p: any) => p.text);
          const full = textParts.join('\n');
          const jsonMatch = full.match(/CONTEXT_JSON:\s*([\s\S]*?)\n---/);
          if (!jsonMatch) return 'No context found in the message.';
          let data: any;
          try {
            data = JSON.parse(jsonMatch[1]);
          } catch {
            return 'Invalid context JSON provided.';
          }
          const { people, restaurants, ratings, strategy } = data;

          const newRatings = ratings.map((row: number[]) => [...row]);

          changes.forEach((change: any) => {
            const personIndex = people.findIndex((p: any) => p.name === change.personName);
            const restaurantIndex = restaurants.findIndex((r: any) => r.name === change.restaurantName);

            if (personIndex !== -1 && restaurantIndex !== -1) {
              newRatings[personIndex][restaurantIndex] = change.newRating;
            }
          });

          const newGroupScores = restaurants.map((_: any, restaurantIndex: number) => {
            const restaurantRatings = newRatings.map((personRatings: number[]) => personRatings[restaurantIndex]);

            switch (strategy) {
              case 'LMS':
                return Math.min(...restaurantRatings);
              case 'ADD':
                return restaurantRatings.reduce((sum: number, rating: number) => sum + rating, 0);
              case 'APP':
                return restaurantRatings.filter((rating: number) => rating > 3).length;
              default:
                return Math.min(...restaurantRatings);
            }
          });

          const candidates = restaurants
            .map((restaurant: any, index: number) => ({ index, visited: restaurant.visited, score: newGroupScores[index] }))
            .filter((r: any) => !r.visited);

          const bestScore = candidates.length > 0 ? Math.max(...candidates.map((c: any) => c.score)) : 0;
          const newRecommendedIndices = candidates.filter((c: any) => c.score === bestScore).map((c: any) => c.index);

          const newRecommendedRestaurants = newRecommendedIndices.map((i: number) => restaurants[i].name);

          let explanation = `Simulation results after applying changes:\n\n`;
          explanation += `Changes made:\n`;
          changes.forEach((change: any) => {
            explanation += `- ${change.personName}'s rating for ${change.restaurantName}: ${change.newRating}/5\n`;
          });

          explanation += `\nNew recommendation: ${newRecommendedRestaurants.join(', ')}\n\n`;

          explanation += `New scores for all restaurants:\n`;
          restaurants.forEach((restaurant: any, index: number) => {
            if (!restaurant.visited) {
              const oldScore = data.groupScores[index];
              const newScore = newGroupScores[index];
              const change = newScore - oldScore;
              const changeStr = change > 0 ? `+${change}` : change.toString();
              explanation += `- ${restaurant.name}: ${newScore} (${changeStr})\n`;
            }
          });

          return explanation;
        },
      }),
    },
    toolChoice: 'auto',
    system: `You are a helpful assistant that explains restaurant recommendation results and answers questions about how changes would affect recommendations.

You can only answer questions related to restaurant recommendations and the group decision-making process. You have access to tools that can:
1. Explain the current recommendation result
2. Simulate changes to ratings and show how they would affect the recommendation

Always use the tools to provide accurate, data-driven answers. Never make up information or answer questions unrelated to restaurant recommendations.

The system uses three aggregation strategies:
- LMS (Least Misery): Minimizes the lowest rating among group members
- ADD (Additive): Maximizes the total rating sum across all group members  
- APP (Approval Voting): Maximizes the number of votes above 3

The group members are: Darcy, Alex, Jess, Jackie, Freddy
The restaurants are: Rest 1, Rest 2, Rest 3, Rest 4, Rest 5, Rest 6, Rest 7, Rest 8, Rest 9, Rest 10

Rest 5, Rest 7, and Rest 9 have been previously visited and are excluded from recommendations.

When a user asks about changing ratings, use the alterMatrixAndExplainResult tool with the appropriate changes.
When a user asks to explain the current result, use the explainCurrentResult tool.`,
  });

  return result.toUIMessageStreamResponse();
}
