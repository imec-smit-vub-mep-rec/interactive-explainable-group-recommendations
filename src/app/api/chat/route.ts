import { google } from "@ai-sdk/google";
import { cerebras } from "@ai-sdk/cerebras";
import { streamText, convertToModelMessages } from "ai";
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

// Global context storage - in a real app, this would be in a database or session
let currentContext: z.infer<typeof RestaurantRecommendationDataSchema> | null =
  null;

export async function POST(req: Request) {
  const { messages } = await req.json();
  const context = messages[messages.length - 1].metadata?.context;

  // Update context if provided
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
  });

  return result.toUIMessageStreamResponse();
}
