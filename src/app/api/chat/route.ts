// import { google } from "@ai-sdk/google";
import { cerebras } from "@ai-sdk/cerebras";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText, convertToModelMessages } from "ai";
import { z } from "zod";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const LLM_PROVIDER = process.env.LLM_PROVIDER ?? "cerebras";
const isCerebras = LLM_PROVIDER === "cerebras";
const isRequesty = LLM_PROVIDER === "requesty";

const scalewayProvider = createOpenAICompatible({
  baseURL: "https://api.scaleway.ai/v1",
  name: "scaleway",
  apiKey: process.env.SCALEWAY_API_KEY,
});

const requestyProvider = createOpenAICompatible({
  baseURL: process.env.REQUESTY_BASE_URL ?? "https://router.requesty.ai/v1",
  name: "requesty",
  apiKey: process.env.REQUESTY_API_KEY,
});

const getModel = (
  modelId: string,
  defaultOpenAICompatibleModel = "llama-3.1-8b-instruct"
) => {
  if (isCerebras) {
    return cerebras(modelId);
  }
  const provider = isRequesty ? requestyProvider : scalewayProvider;
  const defaultModel =
    isRequesty ? process.env.REQUESTY_MODEL ?? "openai/gpt-4o-mini" : defaultOpenAICompatibleModel;
  return provider.chatModel(modelId || defaultModel);
};

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

type RecommendationContext = z.infer<typeof RestaurantRecommendationDataSchema>;
const MAX_USER_MESSAGES = 15;
const FALLBACK_ANSWER = "I'm sorry, I could not answer that question.";
const CONVERSATION_CLOSED_ANSWER =
  "This conversation is now closed after 15 questions.";
const normalizePrompt = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[?.!]+$/, "");

const isAllowedSuggestionForm = (normalizedPrompt: string) =>
  /^how to make rest .+ preferred$/.test(normalizedPrompt) ||
  /^why is rest .+ not recommended$/.test(normalizedPrompt) ||
  normalizedPrompt === "what is the recommended restaurant order";

const buildSuggestionInstructionBlock = (input: {
  context: RecommendationContext | null;
  recentUserQueries: string[];
  askedSuggestionPrompts: string[];
}) => {
  const restaurantExamples = (input.context?.restaurants ?? [])
    .filter((r) => !r.visited)
    .slice(0, 4)
    .map((r) => r.name)
    .join(", ");
  const recentQueries = input.recentUserQueries
    .slice(-3)
    .map((q) => `- ${q}`)
    .join("\n");
  const askedSuggestionPrompts = input.askedSuggestionPrompts
    .slice(-20)
    .map((q) => `- ${q}`)
    .join("\n");

  return `\n\nFOLLOW-UP SUGGESTIONS RULES:
- End with a <suggestions> block containing exactly 2 bullet suggestions.
- Suggestions must use only these exact forms:
  - How to make rest X preferred?
  - Why is rest X not recommended?
  - What is the recommended restaurant order?
- Keep suggestions varied across turns.
- Do not repeat any of these recent user queries verbatim:
${recentQueries || "- (none)"}
- Do not output a suggestion if its normalized form was already asked by the user.
- Already asked suggestion prompts (normalized):
${askedSuggestionPrompts || "- (none)"}
- Use concrete restaurants from current context when using X.
- If possible, avoid proposing the same restaurant in both suggestions.
- Example restaurant names available now: ${restaurantExamples || "Rest 1, Rest 2"}.
`;
};

export async function POST(req: Request) {
  const requestStart = Date.now();
  console.log("⏱ route_start_iso:", new Date(requestStart).toISOString());
  const requestDebugId = `${requestStart}-${Math.random().toString(36).slice(2, 8)}`;
  const body = await req.json();
  const incomingMessages = Array.isArray(body?.messages)
    ? body.messages
    : [];
  const lastIncomingMessage = incomingMessages[incomingMessages.length - 1] as
    | { role?: unknown; metadata?: unknown }
    | undefined;
  const userMessageCount = incomingMessages.filter(
    (message: { role?: unknown }) => message?.role === "user"
  ).length;
  console.log("🧪 chat_debug:request_received", {
    requestDebugId,
    totalMessages: incomingMessages.length,
    userMessageCount,
    lastMessageRole: lastIncomingMessage?.role ?? null,
    lastMessageHasMetadata: Boolean(
      lastIncomingMessage &&
        typeof lastIncomingMessage === "object" &&
        "metadata" in lastIncomingMessage
    ),
  });
  if (userMessageCount > MAX_USER_MESSAGES) {
    console.warn("🧪 chat_debug:conversation_closed", {
      requestDebugId,
      userMessageCount,
      maxAllowed: MAX_USER_MESSAGES,
    });
    return Response.json({ error: CONVERSATION_CLOSED_ANSWER }, { status: 429 });
  }
  const messages = incomingMessages;
  const context = (messages[messages.length - 1] as { metadata?: { context?: unknown } } | undefined)
    ?.metadata?.context;

  // Parse and validate context for this request
  let currentContext: z.infer<typeof RestaurantRecommendationDataSchema> | null = null;
  if (context) {
    try {
      currentContext = RestaurantRecommendationDataSchema.parse(context);
      console.log("🧪 chat_debug:context_parsed", {
        requestDebugId,
        peopleCount: currentContext.people.length,
        restaurantCount: currentContext.restaurants.length,
        strategy: currentContext.strategy,
        recommendedCount: currentContext.recommendedRestaurantIndices.length,
      });
    } catch (error) {
      console.error("🧪 chat_debug:invalid_context", {
        requestDebugId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    console.warn("🧪 chat_debug:missing_context", { requestDebugId });
  }

  const LMS =
    "LMS (Least Misery): Minimizes the lowest rating among group members";
  const ADD = "ADD (Additive): Maximizes the total rating sum";
  const APP = "APP (Approval Voting): Maximizes the number of votes above 3 (greater than or equal to 4)";
  const strategy = {
    LMS,
    ADD,
    APP,
  }[currentContext?.strategy || "LMS"];

  const allUserQueries: string[] = messages
    .filter((m: Record<string, unknown>) => m?.role === "user")
    .map((m: Record<string, unknown>) => {
      if (typeof m.content === "string") {
        return m.content;
      }
      if (Array.isArray(m.parts)) {
        return m.parts
          .map((part) => {
            if (part && typeof part === "object" && part.type === "text") {
              return typeof part.text === "string" ? part.text : "";
            }
            return "";
          })
          .join(" ")
          .trim();
      }
      return "";
    })
    .filter((query: string) => query.length > 0);
  const recentUserQueries = allUserQueries.slice(-3);
  const latestUserQuery = allUserQueries[allUserQueries.length - 1] ?? "";
  console.log("🧪 chat_debug:user_query_analysis", {
    requestDebugId,
    allUserQueriesCount: allUserQueries.length,
    latestUserQuery,
  });
  const askedSuggestionPrompts: string[] = Array.from(
    new Set<string>(
      allUserQueries
        .map((query: string) => normalizePrompt(query))
        .filter(
          (query: string) => query.length > 0 && isAllowedSuggestionForm(query)
        )
    )
  );

  const suggestionInstruction = buildSuggestionInstructionBlock({
    context: currentContext,
    recentUserQueries,
    askedSuggestionPrompts,
  });

  const systemPrompt = `You are a concise assistant for restaurant recommendation explanations.

Scope:
- Only answer questions about restaurant recommendations, ratings, and group decision-making in this context.
- If the user asks something outside this recommendation scenario, briefly refuse and redirect to in-scope questions.

Output style:
- Be brief and practical.
- Never output chain-of-thought or hidden reasoning.
- Never output XML/HTML-style wrappers or reasoning tags (for example: <reasoning>, <thinking>, <analysis>).
- Use plain text/Markdown only.

Recommendation explanations:
- Include rank and score when relevant.
- Give a short strategy-specific explanation:
  * Least Misery Strategy (LMS): Explain the score by stating the lowest rating and who gave it (e.g., "The score is X, since the lowest rating (given by Name) is X."). When explaining why a restaurant is not recommended, compare it to the recommended restaurant (e.g., "The lowest score of Rest Y is Z (given by Name), which makes it a better choice under the Least Misery Strategy.").
  * Additive Strategy (ADD): State the total rating (e.g., "The total rating is X."). When explaining why a restaurant is not recommended, compare its total rating to the recommended restaurant's total rating.
  * Approval Voting Strategy (APP): State the number of approvals (e.g., "X users gave a score of 4 or more."). When explaining why a restaurant is not recommended, compare its approval count to the recommended restaurant's approval count.
- Mention the strategy name in full (e.g. "Least Misery Strategy" instead of "LMS")
- Do not mention the abbreviated strategy name (e.g. "LMS" instead of "Least Misery")
- In this app, "score" always means the strategy score for the active strategy:
  * Least Misery Strategy: score = minimum rating
  * Additive Strategy: score = sum of ratings
  * Approval Voting Strategy: score = number of approvals (ratings >= 4)
- If the user asks for ordering/ranking (including "What is the recommended restaurant order?"), return a full ranking of all restaurants in descending score.
- Always mention the score for every restaurant in ranking answers.
- Group restaurants with the same score into the same rank/tier and put all restaurants from that tie group on the same line.
- Use exactly one line per rank in this format: "<rank>. <Restaurant list> (<score description>, <status tags>)".
- For status tags, include "recommended" and/or "already visited" when applicable.
- For ranking responses, first compute scores for all restaurants, then group by equal score, then output one line per score group.
- Never output one line per restaurant when two or more restaurants have the same score.
- If a tie exists, list tied restaurants as a comma-separated list on the same rank line.
- Example tie formatting:
  * "2. Rest 1, Rest 3 (3 approvals, already visited)"
  * "4. Rest 2, Rest 5, Rest 8, Rest 10 (1 approval, already visited)"
- Never refuse a "by score" request under Approval Voting; approval count is the score.

Counterfactual guidance:
- Treat all suggested rating changes as hypothetical simulations only.
- Do not imply any persistent write/update was performed in the real dataset.
- For "how to make X preferred", propose concrete changes based on the context data.
  Never ask the user to specify which ratings to change.
- Only discuss minimality when explicitly requested.
- Base your counterfactual reasoning on the ratings and scores in the context data.

Response ending:
- End with a <suggestions> block containing exactly two bullet suggestions.
- Suggestions must only use these exact forms:
  * "How to make rest X preferred?"
  * "Why is rest X not recommended?"
  * "What is the recommended restaurant order?"
- Suggestions must be new in this conversation: do not output a suggestion that has already been asked by the user.
- Do not repeat the user's latest query verbatim.

The system currently uses this aggregation strategy: ${strategy}
Group members: ${currentContext?.people.map((p) => p.name).join(", ")}
Restaurants: ${currentContext?.restaurants.map((r) => r.name).join(", ")}
Previously visited (excluded): ${currentContext?.restaurants
    .filter((r) => r.visited)
    .map((r) => r.name)
    .join(", ")}

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
 ${suggestionInstruction}`;

  const logTokenUsage = (
    source: string,
    usage:
      | {
          promptTokens?: number;
          completionTokens?: number;
          inputTokens?: number;
          outputTokens?: number;
          totalTokens?: number;
        }
      | undefined
  ) => {
    if (usage) {
      const input = usage.inputTokens ?? usage.promptTokens;
      const output = usage.outputTokens ?? usage.completionTokens;
      console.log(`📊 tokens (${source}):`, {
        inputTokens: input,
        outputTokens: output,
        totalTokens: usage.totalTokens ?? (input != null && output != null ? input + output : undefined),
      });
    }
  };

  try {
    const selectedModel = getModel(process.env.LLM_MODEL || "");
    const sanitizedMessages: Array<Record<string, unknown>> = [];
    for (let i = 0; i < messages.length; i += 1) {
      const currentMessage = messages[i] as Record<string, unknown>;
      const previousMessage = sanitizedMessages[sanitizedMessages.length - 1];
      if (
        currentMessage?.role === "user" &&
        previousMessage?.role === "user"
      ) {
        sanitizedMessages.push({
          role: "assistant",
          parts: [{ type: "text", text: FALLBACK_ANSWER }],
        });
      }
      sanitizedMessages.push(currentMessage);
    }
    console.log("🧪 chat_debug:stream_start", {
      requestDebugId,
      modelPath: "default_model",
    });
    const result = streamText({
      model: selectedModel,
      messages: convertToModelMessages(
        sanitizedMessages as Parameters<typeof convertToModelMessages>[0]
      ),
      system: systemPrompt,
      onFinish: (finish) => {
        const { totalUsage } = finish;
        const outputTokens = totalUsage?.outputTokens ?? 0;
        console.log("⏱ response_stream_end_iso:", new Date().toISOString());
        logTokenUsage("single_path", totalUsage);
        console.log("🧪 chat_debug:stream_finish", {
          requestDebugId,
          outputTokens,
          finishKeys: Object.keys(finish as Record<string, unknown>),
          elapsedMs: Date.now() - requestStart,
        });
        if (outputTokens === 0) {
          console.warn("🧪 chat_debug:empty_completion", {
            requestDebugId,
            latestUserQuery,
          });
        }
      },
    });
    console.log("⏱ request_total_ms:", Date.now() - requestStart);

    return result.toUIMessageStreamResponse({
      onError: (error) => {
        console.error("❌ stream_error:", {
          requestDebugId,
          latestUserQuery,
          error: error instanceof Error ? error.message : String(error),
        });
        return FALLBACK_ANSWER;
      },
    });
  } catch (error) {
    console.error("❌ route_error:", {
      requestDebugId,
      latestUserQuery,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ error: FALLBACK_ANSWER }, { status: 500 });
  }
}
