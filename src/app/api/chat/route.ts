import { google } from "@ai-sdk/google";
import { cerebras } from "@ai-sdk/cerebras";
import { streamText, convertToModelMessages, tool } from "ai";
import { z } from "zod";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

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

const AggregationStrategySchema = z.enum(["LMS", "ADD", "APP"]);

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
  const context = messages[messages.length - 1].metadata?.context;

  // Parse and validate context for this request
  let currentContext: z.infer<typeof RestaurantRecommendationDataSchema> | null = null;
  if (context) {
    try {
      currentContext = RestaurantRecommendationDataSchema.parse(context);
    } catch (error) {
      console.error("Invalid context provided:", error);
    }
  }

  const LMS =
    "LMS (Least Misery): Minimizes the lowest rating among group members";
  const ADD = "ADD (Additive): Maximizes the total rating sum";
  const APP = "APP (Approval Voting): Maximizes the number of votes above 3";
  const strategy = {
    LMS,
    ADD,
    APP,
  }[currentContext?.strategy || "LMS"];

  const systemPrompt = `You are a helpful assistant that explains restaurant recommendation results and answers questions about how changes would affect recommendations.

You can only answer questions related to restaurant recommendations and the group decision-making process.
You can:
1. Explain the current recommendation result
2. Simulate changes to ratings and show how they would affect the recommendation
3. Update ratings in the table when users request changes

The system currently uses a specific aggregation strategy: ${strategy}

The group members are: ${currentContext?.people.map((p) => p.name).join(", ")}
The restaurants are: ${currentContext?.restaurants
    .map((r) => r.name)
    .join(", ")}

${currentContext?.restaurants
  .filter((r) => r.visited)
  .map((r) => r.name)
  .join(
    ", "
  )} have been previously visited and are excluded from recommendations.

When a user asks about changing ratings, you can simulate the changes and show how they would affect the recommendation.
When a user asks to explain the current result, you can explain the current recommendation result based on the scores and the aggregation strategy.

For rating changes, follow this natural flow:
1. EXPLANATION REQUESTS: When users ask "why is X recommended?" or "how to make Y preferred?", provide a detailed explanation
2. COUNTERFACTUAL SUGGESTIONS: When users ask "how to make X preferred?", suggest specific minimal changes and ask "Would you like me to simulate this change?"
3. CONFIRMATION REQUESTS: Only when users explicitly confirm (say "yes", "do it", "simulate", etc.), then execute the tool calls
4. DIRECT REQUESTS: When users directly ask to change ratings ("change X's rating to Y"), execute immediately without asking for confirmation

CRITICAL: You must actually EXECUTE the tool calls when confirmed, not just describe them.

Available tools:
- updateRating: For single rating changes
- updateMultipleRatings: For multiple rating changes (including "all of person X's ratings" or "all ratings for restaurant Y")

CONVERSATION FLOW EXAMPLES:

**Explanation Request:**
User: "Why is Rest 1 recommended?"
You: Provide detailed explanation of current scores, strategy, and reasoning.

**Counterfactual Request:**
User: "How to make Rest 3 preferred?"
You: Analyze current situation, suggest minimal changes (e.g., "To make Rest 3 preferred, we could increase Alex's rating for Rest 3 from 2 to 4. This would change the group score from X to Y. Would you like me to simulate this change?")

ANALYSIS GUIDANCE:
- Look at current group scores and identify the highest scoring restaurant
- For "how to make X preferred", find the minimal change needed to make X's score equal or exceed the current top score
- Consider the aggregation strategy (LMS: minimum rating, ADD: sum of ratings, APP: count of ratings > 3)
- Suggest the most impactful single change first, then mention alternatives if needed

**Confirmation Response:**
User: "Yes" / "Do it" / "Simulate it"
You: Execute the tool call and show results.

**Direct Request:**
User: "Change Alex's rating for Rest 3 to 4"
You: Execute immediately without asking for confirmation.

IMPORTANT: When using the tools:
- Use exact person and restaurant names as they appear in the context
- Only update ratings for restaurants that haven't been visited (visited restaurants are excluded from recommendations)
- Rating values must be integers between 1 and 5
- For requests like "change all X's ratings to Y", use updateMultipleRatings with all restaurants for that person
- For requests like "change all X's ratings to be at least Y", use updateMultipleRatings with updateMode: 'set_minimum'
- For requests like "change X's rating for A to Y and Z's rating for B to W", use updateMultipleRatings
- For single changes, use updateRating
- If a user asks to reset ratings, direct them to use the "Reset to Initial Values" button in the interface
- Always explain the impact of the change after updating ratings

DO NOT just describe what you would do - ACTUALLY DO IT by calling the tools!

Answer questions in a friendly and concise manner.
You can use markdown to format your answers more clearly.


${
  currentContext
    ? `Current context data:
- Strategy: ${currentContext.strategy}
- People: ${currentContext.people.map((p) => p.name).join(", ")}
- Restaurants: ${currentContext.restaurants.map((r) => r.name).join(", ")}
- Recommended restaurants: ${currentContext.recommendedRestaurantIndices
        .map((i) => currentContext!.restaurants[i].name)
        .join(", ")}
- Current ratings (Users × Restaurants):
${currentContext.ratings
  .map((userRatings, userIndex) => {
    const userName =
      currentContext!.people[userIndex]?.name || `User ${userIndex + 1}`;
    const ratingsRow = userRatings
      .map((rating, restaurantIndex) => {
        const restaurantName =
          currentContext!.restaurants[restaurantIndex]?.name ||
          `Rest ${restaurantIndex + 1}`;
        return `${restaurantName}: ${rating}`;
      })
      .join(" | ");
    return `${userName}: ${ratingsRow}`;
  })
  .join("\n")}

- Group scores per restaurant: ${currentContext.groupScores
        .map((score, i) => `${currentContext!.restaurants[i].name}: ${score}`)
        .join(", ")}`
    : "No context data available."
}
 `;

  // console.log(systemPrompt);

  const result = streamText({
    model: cerebras(process.env.NEXT_PUBLIC_CEREBRAS_MODEL || ""), //google("gemini-2.5-flash"),
    messages: convertToModelMessages(messages),
    system: systemPrompt,
    tools: {
      resetRatings: tool({
        description: 'Reset all ratings to their original values from the scenario. Use this when the user asks to reset or restore the original ratings.',
        inputSchema: z.object({}),
        execute: async () => {
          if (!currentContext) {
            return {
              success: false,
              message: "No context data available to reset ratings.",
            };
          }

          // Get the original ratings from the scenario
          // For now, we'll need to get this from the context or pass it separately
          // This is a limitation of the current implementation
          return {
            success: false,
            message: "Reset functionality requires access to original scenario data. Please use the 'Reset to Initial Values' button in the interface.",
          };
        },
      }),
      updateMultipleRatings: tool({
        description: 'Update multiple ratings at once. Use this for any multiple rating changes, including "all of person X\'s ratings" or "all ratings for restaurant Y". The tool will intelligently handle bulk updates.',
        inputSchema: z.object({
          updates: z.array(z.object({
            personName: z.string().describe('The name of the person whose rating to update'),
            restaurantName: z.string().describe('The name of the restaurant to update the rating for'),
            newRating: z.number().min(1).max(5).describe('The new rating value (1-5)'),
            updateMode: z.enum(['set_exact', 'set_minimum']).optional().default('set_exact').describe('set_exact: set to exact value, set_minimum: only update if current rating is below newRating'),
          })).min(1).describe('Array of rating updates to perform'),
        }),
        execute: async ({ updates }) => {
          if (!currentContext) {
            return {
              success: false,
              message: "No context data available to update ratings.",
            };
          }

          const results = [];
          const errors = [];
          let updatedRatings = currentContext.ratings.map(personRatings => [...personRatings]);

          // Process each update
          for (const update of updates) {
            // Find person index (case-insensitive)
            const personIndex = currentContext.people.findIndex(p => 
              p.name.toLowerCase() === update.personName.toLowerCase()
            );
            if (personIndex === -1) {
              errors.push(`Person "${update.personName}" not found. Available people: ${currentContext.people.map(p => p.name).join(", ")}`);
              continue;
            }

            // Find restaurant index (case-insensitive)
            const restaurantIndex = currentContext.restaurants.findIndex(r => 
              r.name.toLowerCase() === update.restaurantName.toLowerCase()
            );
            if (restaurantIndex === -1) {
              errors.push(`Restaurant "${update.restaurantName}" not found. Available restaurants: ${currentContext.restaurants.map(r => r.name).join(", ")}`);
              continue;
            }

            // Check if restaurant is visited
            if (currentContext.restaurants[restaurantIndex].visited) {
              errors.push(`Cannot update rating for "${update.restaurantName}" as it has been previously visited.`);
              continue;
            }

            // Validate rating
            if (update.newRating < 1 || update.newRating > 5 || !Number.isInteger(update.newRating)) {
              errors.push(`Invalid rating value "${update.newRating}" for ${update.personName}'s rating of ${update.restaurantName}. Rating must be an integer between 1 and 5.`);
              continue;
            }

            const oldRating = updatedRatings[personIndex][restaurantIndex];
            
            // Check if we should update based on updateMode
            const updateMode = update.updateMode || 'set_exact';
            let shouldUpdate = false;
            
            if (updateMode === 'set_exact') {
              shouldUpdate = true; // Always update to exact value
            } else if (updateMode === 'set_minimum') {
              shouldUpdate = oldRating < update.newRating; // Only update if below minimum
            }
            
            if (shouldUpdate) {
              updatedRatings[personIndex][restaurantIndex] = update.newRating;
              results.push({
                personName: update.personName,
                restaurantName: update.restaurantName,
                oldRating,
                newRating: update.newRating,
              });
            }
          }

          if (errors.length > 0) {
            return {
              success: false,
              message: `Some updates failed: ${errors.join("; ")}`,
              errors,
              successfulUpdates: results,
            };
          }

          // Recalculate group scores with updated ratings
          const newGroupScores = currentContext.restaurants.map((_, restaurantIdx) => {
            const restaurantRatings = updatedRatings.map(
              (personRatings) => personRatings[restaurantIdx]
            );

            switch (currentContext.strategy) {
              case "LMS": // Least Misery Strategy
                return Math.min(...restaurantRatings);
              case "ADD": // Additive Strategy
                return restaurantRatings.reduce((sum, rating) => sum + rating, 0);
              case "APP": // Approval Voting Strategy
                return restaurantRatings.filter((rating) => rating > 3).length;
              default:
                return Math.min(...restaurantRatings);
            }
          });

          // Find new recommended restaurants
          const candidates = currentContext.restaurants
            .map((restaurant, index) => ({
              index,
              visited: restaurant.visited,
              score: newGroupScores[index],
            }))
            .filter((r) => !r.visited);
          
          const newRecommendedRestaurantIndices = candidates.length === 0 
            ? [] 
            : candidates
                .filter((c) => c.score === Math.max(...candidates.map((c) => c.score)))
                .map((c) => c.index);

          return {
            success: true,
            message: `I've updated ${results.length} rating(s)! ${results.map(r => `${r.personName}'s rating for ${r.restaurantName} from ${r.oldRating} to ${r.newRating}`).join(", ")}.`,
            updatedData: {
              updates: results,
              newRatings: updatedRatings,
              newGroupScores,
              newRecommendedRestaurantIndices: newRecommendedRestaurantIndices.map(i => currentContext.restaurants[i].name),
            },
          };
        },
      }),
      updateRating: tool({
        description: 'Update a specific rating in the table. Use this when the user asks you to change a rating for a specific person and restaurant.',
        inputSchema: z.object({
          personName: z.string().describe('The name of the person whose rating to update'),
          restaurantName: z.string().describe('The name of the restaurant to update the rating for'),
          newRating: z.number().min(1).max(5).describe('The new rating value (1-5)'),
        }),
        execute: async ({ personName, restaurantName, newRating }) => {
          if (!currentContext) {
            return {
              success: false,
              message: "No context data available to update ratings.",
            };
          }

          // Find person index (case-insensitive)
          const personIndex = currentContext.people.findIndex(p => 
            p.name.toLowerCase() === personName.toLowerCase()
          );
          if (personIndex === -1) {
            return {
              success: false,
              message: `Person "${personName}" not found. Available people: ${currentContext.people.map(p => p.name).join(", ")}`,
            };
          }

          // Find restaurant index (case-insensitive)
          const restaurantIndex = currentContext.restaurants.findIndex(r => 
            r.name.toLowerCase() === restaurantName.toLowerCase()
          );
          if (restaurantIndex === -1) {
            return {
              success: false,
              message: `Restaurant "${restaurantName}" not found. Available restaurants: ${currentContext.restaurants.map(r => r.name).join(", ")}`,
            };
          }

          // Check if restaurant is visited (can't update visited restaurants)
          if (currentContext.restaurants[restaurantIndex].visited) {
            return {
              success: false,
              message: `Cannot update rating for "${restaurantName}" as it has been previously visited.`,
            };
          }

          // Validate rating range (additional check beyond Zod schema)
          if (newRating < 1 || newRating > 5 || !Number.isInteger(newRating)) {
            return {
              success: false,
              message: `Invalid rating value "${newRating}". Rating must be an integer between 1 and 5.`,
            };
          }

          // Create a copy of the ratings and update the specific rating
          const oldRating = currentContext.ratings[personIndex][restaurantIndex];
          const updatedRatings = currentContext.ratings.map((personRatings, pIndex) => {
            if (pIndex === personIndex) {
              const newPersonRatings = [...personRatings];
              newPersonRatings[restaurantIndex] = newRating;
              return newPersonRatings;
            }
            return personRatings;
          });

          // Recalculate group scores with updated ratings
          const newGroupScores = currentContext.restaurants.map((_, restaurantIdx) => {
            const restaurantRatings = updatedRatings.map(
              (personRatings) => personRatings[restaurantIdx]
            );

            switch (currentContext.strategy) {
              case "LMS": // Least Misery Strategy
                return Math.min(...restaurantRatings);
              case "ADD": // Additive Strategy
                return restaurantRatings.reduce((sum, rating) => sum + rating, 0);
              case "APP": // Approval Voting Strategy
                return restaurantRatings.filter((rating) => rating > 3).length;
              default:
                return Math.min(...restaurantRatings);
            }
          });

          // Find new recommended restaurants
          const candidates = currentContext.restaurants
            .map((restaurant, index) => ({
              index,
              visited: restaurant.visited,
              score: newGroupScores[index],
            }))
            .filter((r) => !r.visited);
          
          const newRecommendedRestaurantIndices = candidates.length === 0 
            ? [] 
            : candidates
                .filter((c) => c.score === Math.max(...candidates.map((c) => c.score)))
                .map((c) => c.index);

          return {
            success: true,
            message: `I've updated the data! Changed ${personName}'s rating for ${restaurantName} from ${oldRating} to ${newRating}.`,
            updatedData: {
              personName,
              restaurantName,
              oldRating,
              newRating,
              newRatings: updatedRatings,
              newGroupScores,
              newRecommendedRestaurantIndices: newRecommendedRestaurantIndices.map(i => currentContext.restaurants[i].name),
            },
          };
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
