// import { google } from "@ai-sdk/google";
import { cerebras } from "@ai-sdk/cerebras";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText, convertToModelMessages, tool, zodSchema, stepCountIs } from "ai";
import { z } from "zod";
import {
  applyRatingUpdates,
  computeGroupScores,
  computeWinners,
  type AggregationStrategy,
  type RatingUpdateInput,
} from "@/lib/recommendation";

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

const getCounterfactualModel = () => {
  const preferredModelId =
    process.env.COUNTERFACTUAL_LLM ||
    process.env.THINKING_LLM ||
    "";
  return getModel(preferredModelId, "openai/gpt-4o-mini");
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
type VerificationCost = { l1: number; cells: number };
type VerificationSearchLimits = { maxEditedCells: number; timeLimitMs: number };
type ProposedUpdate = RatingUpdateInput;
type ProposedClaimed = { winners?: string[]; targetScore?: number };
type VerificationMode = "verify_only" | "prove_minimal";

const DEFAULT_SEARCH_LIMITS: VerificationSearchLimits = {
  maxEditedCells: 5,
  timeLimitMs: 1500,
};
const MAX_USER_MESSAGES = 15;
const FALLBACK_ANSWER = "I'm sorry, I could not answer that question.";
const CONVERSATION_CLOSED_ANSWER =
  "This conversation is now closed after 15 questions.";

const normalizeName = (name: string) => name.trim().toLowerCase();
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
const isLikelyCounterfactualQuery = (query: string) => {
  const normalized = normalizePrompt(query);
  return /(^| )what if( |$)/.test(normalized) ||
    /(^| )how to make( |$)/.test(normalized) ||
    /(^| )would need to change( |$)/.test(normalized) ||
    /(^| )needs? to change( |$)/.test(normalized) ||
    /(^| )update( |$)/.test(normalized) ||
    /(^| )change( |$)/.test(normalized) ||
    /(^| )set( |$)/.test(normalized) ||
    /(^| )increase( |$)/.test(normalized) ||
    /(^| )decrease( |$)/.test(normalized);
};

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

const computePreferredChangeProposal = (input: {
  context: RecommendationContext;
  targetRestaurantName: string;
}): ProposedUpdate[] => {
  const { context, targetRestaurantName } = input;
  const targetIndex = getRestaurantIndexByName(
    context.restaurants,
    targetRestaurantName
  );
  if (targetIndex === -1) return [];
  if (context.restaurants[targetIndex].visited) return [];

  // Guaranteed-to-work (not proven minimal): push the target's score to at least
  // the current top score among unvisited restaurants (or as high as possible).
  const baseScores = computeGroupScores(
    context.ratings,
    context.strategy as AggregationStrategy
  );
  const { winnerIndices } = computeWinners({
    restaurants: context.restaurants,
    groupScores: baseScores,
  });
  const currentTopScore =
    winnerIndices.length > 0 ? baseScores[winnerIndices[0]] : -Infinity;
  const targetCurrentScore = baseScores[targetIndex];

  const updates: ProposedUpdate[] = [];

  switch (context.strategy) {
    case "LMS": {
      const threshold = Math.max(1, Math.min(5, currentTopScore));
      for (let personIndex = 0; personIndex < context.people.length; personIndex += 1) {
        const oldRating = context.ratings[personIndex]?.[targetIndex];
        if (typeof oldRating !== "number") continue;
        if (oldRating < threshold) {
          updates.push({
            personName:
              context.people[personIndex]?.name ?? `User ${personIndex + 1}`,
            restaurantName:
              context.restaurants[targetIndex]?.name ?? targetRestaurantName,
            newRating: threshold,
          });
        }
      }
      break;
    }
    case "APP": {
      const targetApprovals = context.ratings
        .map((row) => row[targetIndex])
        .filter((rating) => rating > 3).length;
      const needed = Math.max(0, currentTopScore - targetApprovals);
      if (needed <= 0) return [];

      const candidates = context.ratings
        .map((row, personIndex) => ({
          personIndex,
          oldRating: row[targetIndex],
        }))
        .filter((c) => typeof c.oldRating === "number" && c.oldRating <= 3)
        .sort((a, b) => (b.oldRating ?? 0) - (a.oldRating ?? 0)); // prefer 3->4, then 2->4, etc.

      for (let i = 0; i < Math.min(needed, candidates.length); i += 1) {
        const c = candidates[i];
        updates.push({
          personName:
            context.people[c.personIndex]?.name ?? `User ${c.personIndex + 1}`,
          restaurantName:
            context.restaurants[targetIndex]?.name ?? targetRestaurantName,
          newRating: 4,
        });
      }
      break;
    }
    case "ADD":
    default: {
      const neededDelta = Math.max(0, currentTopScore - targetCurrentScore);
      if (neededDelta <= 0) return [];

      const headroom = context.ratings.map((row, personIndex) => {
        const oldRating = row[targetIndex];
        return {
          personIndex,
          oldRating,
          room: typeof oldRating === "number" ? Math.max(0, 5 - oldRating) : 0,
        };
      });

      // Use fewer edited cells by filling the largest headroom first.
      headroom.sort((a, b) => b.room - a.room);

      let remaining = neededDelta;
      for (const slot of headroom) {
        if (remaining <= 0) break;
        if (slot.room <= 0) continue;
        const add = Math.min(slot.room, remaining);
        const newRating = (slot.oldRating ?? 1) + add;
        updates.push({
          personName:
            context.people[slot.personIndex]?.name ??
            `User ${slot.personIndex + 1}`,
          restaurantName:
            context.restaurants[targetIndex]?.name ?? targetRestaurantName,
          newRating,
        });
        remaining -= add;
      }

      // If we still couldn't reach the top score (no room), maximize remaining ratings.
      if (remaining > 0) {
        for (const slot of headroom) {
          if (slot.room <= 0) continue;
          // Already maximized above in most cases; this is a safeguard.
          const idx = updates.findIndex((u) =>
            normalizeName(u.personName) ===
            normalizeName(context.people[slot.personIndex]?.name ?? "")
          );
          if (idx === -1) {
            updates.push({
              personName:
                context.people[slot.personIndex]?.name ??
                `User ${slot.personIndex + 1}`,
              restaurantName:
                context.restaurants[targetIndex]?.name ?? targetRestaurantName,
              newRating: 5,
            });
          }
        }
      }

      break;
    }
  }

  return updates;
};

const getRestaurantIndexByName = (
  restaurants: RecommendationContext["restaurants"],
  restaurantName: string
) =>
  restaurants.findIndex(
    (restaurant) => normalizeName(restaurant.name) === normalizeName(restaurantName)
  );

const proposedUpdateSchema = z.object({
  personName: z.string(),
  restaurantName: z.string(),
  newRating: z.number().int().min(1).max(5),
});

/**
 * Builds tools for the chat.
 * - get_restaurant_details: per-person ratings for a restaurant
 * - verify_change: verifies if proposed rating changes would make a restaurant preferred and if claimed scores match
 * - find_changes_to_make_preferred: computes and verifies concrete changes for preference goals
 */
const buildRestaurantTools = (ctx: RecommendationContext | null) => {
  if (!ctx) return undefined;
  return {
    get_restaurant_details: tool({
      description:
        "Returns per-person ratings and group score for a restaurant. Only call this when the data you need is NOT already provided in the system context (e.g. the context was missing or incomplete). Do NOT call this for normal explanation questions like 'why is X recommended' — all ratings and scores are already in context.",
      inputSchema: zodSchema(
        z.object({
          restaurantName: z
            .string()
            .describe("The name of the restaurant (e.g. Rest 1, Rest 2)"),
        })
      ),
      execute: async (input: { restaurantName: string }) => {
        try {
          const { restaurantName } = input;
          console.log("🧰 Tool called: get_restaurant_details", {
            restaurantName,
            timestamp: new Date().toISOString(),
          });
          const idx = getRestaurantIndexByName(ctx.restaurants, restaurantName);
          console.log("🧰 Tool result: get_restaurant_details", {
            idx,
          });
          if (idx === -1) {
            return {
              found: false,
              message: `Restaurant "${restaurantName}" not found.`,
            };
          }
          const ratingsPerPerson = ctx.people.map((p, i) => ({
            personName: p.name,
            rating: ctx.ratings[i]?.[idx],
          }));
          const groupScore = ctx.groupScores[idx];
          console.log("🧰 Tool result: get_restaurant_details", {
            restaurantName,
            ratingsPerPerson,
            groupScore,
          });
          return {
            found: true,
            restaurantName: ctx.restaurants[idx].name,
            visited: ctx.restaurants[idx].visited,
            ratingsPerPerson,
            groupScore,
          };
        } catch (err) {
          console.error("🧰 Tool error: get_restaurant_details", err);
          return {
            found: false,
            message: `Error: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      },
    }),
    verify_change: tool({
      description:
        "Verifies whether proposed rating changes would make a restaurant preferred. Use this when you or the user propose specific rating changes (e.g. 'Change Alex's rating for Rest 1 to 5') and you need to verify: (1) if applying those changes would make the target restaurant preferred, (2) whether it becomes solely preferred or tied with others (computedWinners: one = sole, multiple = tie), and (3) if any claimed resulting score or winners would match the actual computed result. Always call this before stating that a proposed change would achieve a certain outcome.",
      inputSchema: zodSchema(
        z.object({
          targetRestaurantName: z
            .string()
            .describe(
              "The restaurant that should become preferred after the changes"
            ),
          proposedUpdates: z
            .array(proposedUpdateSchema)
            .describe(
              "The rating changes to apply: personName, restaurantName, newRating (1-5)"
            ),
          claimedWinners: z
            .array(z.string())
            .optional()
            .describe(
              "If you claimed specific winner restaurant(s) after the change, list them here for verification"
            ),
          claimedTargetScore: z
            .number()
            .optional()
            .describe(
              "If you claimed the target restaurant would have a specific group score, provide it here for verification"
            ),
        })
      ),
      execute: async (input: {
        targetRestaurantName: string;
        proposedUpdates: Array<{
          personName: string;
          restaurantName: string;
          newRating: number;
        }>;
        claimedWinners?: string[];
        claimedTargetScore?: number;
      }) => {
        try {
          const {
            targetRestaurantName,
            proposedUpdates,
            claimedWinners,
            claimedTargetScore,
          } = input;
          console.log("🧰 Tool called: verify_change", {
            targetRestaurantName,
            proposedUpdatesCount: proposedUpdates.length,
            claimedWinners,
            claimedTargetScore,
            timestamp: new Date().toISOString(),
          });
          const result = verifyMinimalChangeInternal({
            context: ctx,
            targetRestaurantName,
            proposedUpdates,
            claimed:
              claimedWinners !== undefined || claimedTargetScore !== undefined
                ? { winners: claimedWinners, targetScore: claimedTargetScore }
                : undefined,
            search: DEFAULT_SEARCH_LIMITS,
            mode: "verify_only",
          });
          const v = result.verification;
          const c = v.computed;
          return {
            success: result.success,
            message: result.message,
            preferred: v.checks.preferred,
            computedWinners: c?.winners,
            computedTargetScore: c?.targetScore,
            comparisonToTop: c?.comparisonToTop,
            matchesClaimedScore: v.checks.matchesClaimedScore,
            matchesClaimedWinners: v.checks.matchesClaimedWinners,
            proposedChanges: c?.appliedUpdates,
          };
        } catch (err) {
          console.error("🧰 Tool error: verify_change", err);
          return {
            success: false,
            message: `Verification error: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      },
    }),
    find_changes_to_make_preferred: tool({
      description:
        "Computes and verifies concrete rating changes that can make a target restaurant preferred. Use for 'how to make X preferred' or 'what needs to change' questions.",
      inputSchema: zodSchema(
        z.object({
          targetRestaurantName: z
            .string()
            .describe("Restaurant that should become preferred"),
          wantsMinimality: z
            .boolean()
            .optional()
            .describe("Set true only when the user explicitly asks for minimal/smallest changes"),
        })
      ),
      execute: async (input: {
        targetRestaurantName: string;
        wantsMinimality?: boolean;
      }) => {
        try {
          const mode: VerificationMode = input.wantsMinimality
            ? "prove_minimal"
            : "verify_only";
          const proposedUpdates = computePreferredChangeProposal({
            context: ctx,
            targetRestaurantName: input.targetRestaurantName,
          });
          const result = verifyMinimalChangeInternal({
            context: ctx,
            targetRestaurantName: input.targetRestaurantName,
            proposedUpdates,
            search: DEFAULT_SEARCH_LIMITS,
            mode,
          });
          const v = result.verification;
          const c = v.computed;
          return {
            success: result.success,
            message: result.message,
            targetRestaurantName: input.targetRestaurantName,
            proposedChanges: c?.appliedUpdates ?? [],
            preferred: v.checks.preferred,
            computedWinners: c?.winners,
            computedTargetScore: c?.targetScore,
            comparisonToTop: c?.comparisonToTop,
            verification: v,
          };
        } catch (err) {
          console.error("🧰 Tool error: find_changes_to_make_preferred", err);
          return {
            success: false,
            message: `Computation error: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      },
    }),
  };
};

const compareCost = (a: VerificationCost, b: VerificationCost) => {
  if (a.l1 !== b.l1) return a.l1 - b.l1;
  return a.cells - b.cells;
};

const isCostLessThan = (a: VerificationCost, b: VerificationCost) =>
  compareCost(a, b) < 0;

const computeGroupScoresByRestaurant = (
  restaurants: RecommendationContext["restaurants"],
  groupScores: number[]
) => {
  const scores: Record<string, number> = {};
  restaurants.forEach((restaurant, index) => {
    scores[restaurant.name] = groupScores[index];
  });
  return scores;
};

const toNameSet = (names: string[]) =>
  new Set(names.map((name) => normalizeName(name)));

const setsEqual = (left: Set<string>, right: Set<string>) => {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
};

class MinHeap<T> {
  private data: T[] = [];
  constructor(private readonly compare: (a: T, b: T) => number) {}

  get size() {
    return this.data.length;
  }

  push(item: T) {
    this.data.push(item);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0 && last) {
      this.data[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  private bubbleUp(index: number) {
    let current = index;
    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);
      if (this.compare(this.data[current], this.data[parent]) >= 0) break;
      [this.data[current], this.data[parent]] = [
        this.data[parent],
        this.data[current],
      ];
      current = parent;
    }
  }

  private bubbleDown(index: number) {
    let current = index;
    while (true) {
      const left = current * 2 + 1;
      const right = current * 2 + 2;
      let smallest = current;
      if (left < this.data.length && this.compare(this.data[left], this.data[smallest]) < 0) {
        smallest = left;
      }
      if (
        right < this.data.length &&
        this.compare(this.data[right], this.data[smallest]) < 0
      ) {
        smallest = right;
      }
      if (smallest === current) break;
      [this.data[current], this.data[smallest]] = [
        this.data[smallest],
        this.data[current],
      ];
      current = smallest;
    }
  }
}

type SearchEdit = {
  personIndex: number;
  restaurantIndex: number;
  newRating: number;
  oldRating: number;
};

type SearchState = {
  ratings: number[][];
  edits: SearchEdit[];
  editedCells: Set<string>;
  cost: VerificationCost;
};

const cloneRatings = (ratings: number[][]) => ratings.map((row) => row.slice());

const buildStateKey = (edits: SearchEdit[]) => {
  const parts = edits
    .map(
      (edit) =>
        `${edit.personIndex}:${edit.restaurantIndex}:${edit.newRating}`
    )
    .sort();
  return parts.join("|");
};

const generateCandidateMoves = (input: {
  ratings: number[][];
  context: RecommendationContext;
  targetIndex: number;
  strategy: AggregationStrategy;
}): SearchEdit[] => {
  const { ratings, context, targetIndex, strategy } = input;
  const groupScores = computeGroupScores(ratings, strategy);
  const targetScore = groupScores[targetIndex];
  const moves: SearchEdit[] = [];

  context.restaurants.forEach((restaurant, restaurantIndex) => {
    if (restaurant.visited) return;
    const isTarget = restaurantIndex === targetIndex;
    if (!isTarget && groupScores[restaurantIndex] < targetScore) return;

    const restaurantRatings = ratings.map((row) => row[restaurantIndex]);
    const minRating = Math.min(...restaurantRatings);

    restaurantRatings.forEach((oldRating, personIndex) => {
      const candidates: number[] = [];

      switch (strategy) {
        case "APP":
          if (isTarget && oldRating <= 3) {
            candidates.push(4);
          }
          if (!isTarget && oldRating >= 4) {
            candidates.push(3);
          }
          break;
        case "LMS":
          if (isTarget && oldRating === minRating && minRating < 5) {
            for (let value = minRating + 1; value <= 5; value += 1) {
              candidates.push(value);
            }
          }
          if (!isTarget && oldRating === minRating && minRating > 1) {
            for (let value = 1; value < minRating; value += 1) {
              candidates.push(value);
            }
          }
          break;
        case "ADD":
        default:
          if (isTarget && oldRating < 5) {
            for (let value = oldRating + 1; value <= 5; value += 1) {
              candidates.push(value);
            }
          }
          if (!isTarget && oldRating > 1) {
            for (let value = 1; value < oldRating; value += 1) {
              candidates.push(value);
            }
          }
          break;
      }

      for (const newRating of candidates) {
        moves.push({
          personIndex,
          restaurantIndex,
          oldRating,
          newRating,
        });
      }
    });
  });

  return moves;
};

const findBetterCounterfactual = (input: {
  context: RecommendationContext;
  targetIndex: number;
  proposedCost: VerificationCost;
  limits: VerificationSearchLimits;
}): {
  found: boolean;
  counterexample?: SearchEdit[];
  exhausted: boolean;
  searchedUpToCells: number;
  timeLimitMs: number;
} => {
  const { context, targetIndex, proposedCost, limits } = input;
  const startTime = Date.now();
  const heap = new MinHeap<SearchState>((a, b) => compareCost(a.cost, b.cost));
  const visited = new Set<string>();
  const initialState: SearchState = {
    ratings: cloneRatings(context.ratings),
    edits: [],
    editedCells: new Set<string>(),
    cost: { l1: 0, cells: 0 },
  };

  heap.push(initialState);
  visited.add("");

  let searchedUpToCells = 0;

  while (heap.size > 0) {
    if (Date.now() - startTime > limits.timeLimitMs) {
      return {
        found: false,
        exhausted: false,
        searchedUpToCells,
        timeLimitMs: limits.timeLimitMs,
      };
    }

    const state = heap.pop();
    if (!state) break;

    if (!isCostLessThan(state.cost, proposedCost)) {
      return {
        found: false,
        exhausted: true,
        searchedUpToCells,
        timeLimitMs: limits.timeLimitMs,
      };
    }

    searchedUpToCells = Math.max(searchedUpToCells, state.cost.cells);

    const groupScores = computeGroupScores(state.ratings, context.strategy);
    const { winnerNames } = computeWinners({
      restaurants: context.restaurants,
      groupScores,
    });
    if (winnerNames.some((name) => normalizeName(name) === normalizeName(context.restaurants[targetIndex].name))) {
      return {
        found: true,
        counterexample: state.edits,
        exhausted: true,
        searchedUpToCells,
        timeLimitMs: limits.timeLimitMs,
      };
    }

    if (state.cost.cells >= limits.maxEditedCells) {
      continue;
    }

    const moves = generateCandidateMoves({
      ratings: state.ratings,
      context,
      targetIndex,
      strategy: context.strategy,
    });

    for (const move of moves) {
      const cellKey = `${move.personIndex}:${move.restaurantIndex}`;
      if (state.editedCells.has(cellKey)) continue;

      const nextRatings = cloneRatings(state.ratings);
      nextRatings[move.personIndex][move.restaurantIndex] = move.newRating;

      const delta = Math.abs(move.newRating - move.oldRating);
      const nextCost: VerificationCost = {
        l1: state.cost.l1 + delta,
        cells: state.cost.cells + 1,
      };
      if (!isCostLessThan(nextCost, proposedCost)) continue;

      const nextEdits = [...state.edits, move];
      const nextKey = buildStateKey(nextEdits);
      if (visited.has(nextKey)) continue;
      visited.add(nextKey);

      const nextEditedCells = new Set(state.editedCells);
      nextEditedCells.add(cellKey);

      heap.push({
        ratings: nextRatings,
        edits: nextEdits,
        editedCells: nextEditedCells,
        cost: nextCost,
      });
    }
  }

  return {
    found: false,
    exhausted: true,
    searchedUpToCells,
    timeLimitMs: limits.timeLimitMs,
  };
};

const verifyMinimalChangeInternal = (input: {
  context: RecommendationContext | null;
  targetRestaurantName: string;
  proposedUpdates: ProposedUpdate[];
  claimed?: ProposedClaimed;
  search?: Partial<VerificationSearchLimits>;
  mode?: VerificationMode;
}) => {
  const { context, targetRestaurantName, proposedUpdates, claimed } = input;
  if (!context) {
    return {
      success: false,
      message: "No context data available to verify changes.",
      verification: {
        ok: false,
        checks: { preferred: false },
        minimality: {
          metric: "L1_then_cells",
          proposedCost: { l1: 0, cells: 0 },
          proven: false,
          isMinimal: false,
        },
        limits: { searchedUpToCells: 0, timeLimitMs: DEFAULT_SEARCH_LIMITS.timeLimitMs, exhausted: false },
      },
    };
  }

  const baselineGroupScores = computeGroupScores(
    context.ratings,
    context.strategy as AggregationStrategy
  );
  const { winnerNames: baselineWinners, winnerIndices: baselineWinnerIndices } =
    computeWinners({
      restaurants: context.restaurants,
      groupScores: baselineGroupScores,
    });
  const baselineTopScore =
    baselineWinnerIndices.length > 0
      ? baselineGroupScores[baselineWinnerIndices[0]]
      : null;

  const targetIndex = getRestaurantIndexByName(
    context.restaurants,
    targetRestaurantName
  );
  if (targetIndex === -1) {
    return {
      success: false,
      message: `Restaurant "${targetRestaurantName}" not found in context.`,
      verification: {
        ok: false,
        checks: { preferred: false },
        minimality: {
          metric: "L1_then_cells",
          proposedCost: { l1: 0, cells: 0 },
          proven: false,
          isMinimal: false,
        },
        limits: { searchedUpToCells: 0, timeLimitMs: DEFAULT_SEARCH_LIMITS.timeLimitMs, exhausted: false },
      },
    };
  }

  if (context.restaurants[targetIndex].visited) {
    return {
      success: false,
      message: `Restaurant "${targetRestaurantName}" has already been visited and cannot be recommended.`,
      verification: {
        ok: false,
        checks: { preferred: false },
        minimality: {
          metric: "L1_then_cells",
          proposedCost: { l1: 0, cells: 0 },
          proven: false,
          isMinimal: false,
        },
        limits: { searchedUpToCells: 0, timeLimitMs: DEFAULT_SEARCH_LIMITS.timeLimitMs, exhausted: false },
      },
    };
  }

  const { updatedRatings, appliedUpdates, errors } = applyRatingUpdates({
    ratings: context.ratings,
    people: context.people,
    restaurants: context.restaurants,
    updates: proposedUpdates,
  });

  if (errors.length > 0) {
    return {
      success: false,
      message: `Verification failed: ${errors.join("; ")}`,
      verification: {
        ok: false,
        checks: { preferred: false },
        minimality: {
          metric: "L1_then_cells",
          proposedCost: { l1: 0, cells: 0 },
          proven: false,
          isMinimal: false,
        },
        limits: { searchedUpToCells: 0, timeLimitMs: DEFAULT_SEARCH_LIMITS.timeLimitMs, exhausted: false },
      },
    };
  }

  const proposedCost: VerificationCost = {
    l1: appliedUpdates.reduce(
      (sum, update) => sum + Math.abs(update.newRating - update.oldRating),
      0
    ),
    cells: appliedUpdates.length,
  };

  const updatedGroupScores = computeGroupScores(
    updatedRatings,
    context.strategy as AggregationStrategy
  );
  const { winnerNames } = computeWinners({
    restaurants: context.restaurants,
    groupScores: updatedGroupScores,
  });
  const targetScore = updatedGroupScores[targetIndex];
  const comparisonToTop =
    baselineTopScore === null
      ? "unknown"
      : targetScore > baselineTopScore
      ? "better"
      : targetScore === baselineTopScore
      ? "equal"
      : "worse";

  const preferred = winnerNames.some(
    (name) => normalizeName(name) === normalizeName(targetRestaurantName)
  );

  const matchesClaimedScore =
    claimed?.targetScore === undefined
      ? undefined
      : claimed.targetScore === targetScore;
  const matchesClaimedWinners =
    claimed?.winners === undefined
      ? undefined
      : setsEqual(toNameSet(claimed.winners), toNameSet(winnerNames));

  const limits: VerificationSearchLimits = {
    maxEditedCells:
      input.search?.maxEditedCells ?? DEFAULT_SEARCH_LIMITS.maxEditedCells,
    timeLimitMs: input.search?.timeLimitMs ?? DEFAULT_SEARCH_LIMITS.timeLimitMs,
  };

  let minimality = {
    metric: "L1_then_cells",
    proposedCost,
    proven: false,
    isMinimal: false,
    counterexample: undefined as undefined | {
      updates: ProposedUpdate[];
      cost: VerificationCost;
    },
  };
  let limitsResult = {
    searchedUpToCells: 0,
    timeLimitMs: limits.timeLimitMs,
    exhausted: false,
  };

  const mode: VerificationMode = input.mode ?? "verify_only";

  if (preferred && mode === "prove_minimal") {
    const searchResult = findBetterCounterfactual({
      context,
      targetIndex,
      proposedCost,
      limits,
    });
    limitsResult = {
      searchedUpToCells: searchResult.searchedUpToCells,
      timeLimitMs: searchResult.timeLimitMs,
      exhausted: searchResult.exhausted,
    };

    if (searchResult.found && searchResult.counterexample) {
      const counterexampleUpdates = searchResult.counterexample.map((edit) => ({
        personName: context.people[edit.personIndex]?.name || "Unknown",
        restaurantName:
          context.restaurants[edit.restaurantIndex]?.name || "Unknown",
        newRating: edit.newRating,
      }));
      const counterexampleCost: VerificationCost = {
        l1: searchResult.counterexample.reduce(
          (sum, edit) => sum + Math.abs(edit.newRating - edit.oldRating),
          0
        ),
        cells: searchResult.counterexample.length,
      };
      minimality = {
        ...minimality,
        proven: true,
        isMinimal: false,
        counterexample: {
          updates: counterexampleUpdates,
          cost: counterexampleCost,
        },
      };
    } else if (searchResult.exhausted) {
      minimality = {
        ...minimality,
        proven: true,
        isMinimal: true,
      };
    } else {
      minimality = {
        ...minimality,
        proven: false,
        isMinimal: false,
      };
    }
  } else if (preferred && mode === "verify_only") {
    // We verified the preference claim deterministically, but we are not proving minimality.
    minimality = {
      ...minimality,
      proven: false,
      isMinimal: false,
    };
  }

  const claimedOk =
    (matchesClaimedScore === undefined || matchesClaimedScore) &&
    (matchesClaimedWinners === undefined || matchesClaimedWinners);
  const hasClaimMismatch =
    matchesClaimedScore === false || matchesClaimedWinners === false;

  const ok =
    mode === "prove_minimal"
      ? preferred && minimality.proven && minimality.isMinimal
      : preferred;

  const otherWinners = winnerNames.filter(
    (n) => normalizeName(n) !== normalizeName(targetRestaurantName)
  );
  const soleOrTie =
    otherWinners.length === 0
      ? "solely preferred"
      : `preferred, tied with ${otherWinners.join(", ")}`;
  const message = ok
    ? mode === "prove_minimal"
      ? hasClaimMismatch
        ? `The proposed change makes ${targetRestaurantName} ${soleOrTie} and is minimal. (Corrected from the claimed winners/score.)`
        : `The proposed change makes ${targetRestaurantName} ${soleOrTie} and is minimal.`
      : hasClaimMismatch
      ? `The proposed change makes ${targetRestaurantName} ${soleOrTie}. (Corrected from the claimed winners/score.)`
      : `The proposed change makes ${targetRestaurantName} ${soleOrTie}.`
    : !preferred
    ? `Verification failed: proposed change does not make ${targetRestaurantName} preferred.`
    : mode === "prove_minimal" && minimality.proven && !minimality.isMinimal
    ? "Verification failed: found a smaller change that also makes the target preferred."
    : mode === "prove_minimal"
    ? "Verification incomplete: minimality could not be proven within search limits."
    : claimedOk
    ? `Verification failed: proposed change does not make ${targetRestaurantName} preferred.`
    : `The proposed change was simulated; computed result differs from claim. ${targetRestaurantName} is ${soleOrTie}.`;

  return {
    success: ok,
    message,
    verification: {
      ok,
      computed: {
        winners: winnerNames,
        targetScore,
        baselineTopScore,
        baselineWinners,
        comparisonToTop,
        appliedUpdates: appliedUpdates.map((u) => ({
          personName: u.personName,
          restaurantName: u.restaurantName,
          oldRating: u.oldRating,
          newRating: u.newRating,
        })),
        groupScoresByRestaurant: computeGroupScoresByRestaurant(
          context.restaurants,
          updatedGroupScores
        ),
      },
      checks: {
        preferred,
        matchesClaimedScore,
        matchesClaimedWinners,
      },
      minimality,
      limits: limitsResult,
      mode,
    },
  };
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
  const isCounterfactualTurn = isLikelyCounterfactualQuery(latestUserQuery);
  console.log("🧪 chat_debug:user_query_analysis", {
    requestDebugId,
    allUserQueriesCount: allUserQueries.length,
    latestUserQuery,
    isCounterfactualTurn,
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

Counterfactual guidance:
- Treat all suggested rating changes as hypothetical simulations only.
- Do not imply any persistent write/update was performed in the real dataset.
- For "how to make X preferred" or "what would need to happen to make X preferred", always propose concrete changes yourself. Never ask the user to specify which ratings to change.
- Only discuss minimality when explicitly requested (minimal/minimum/smallest).

Verification rules:
- For counterfactual claims, call tools and base definitive statements on tool results.
- Do not state numeric scores unless they come from context or tool outputs.
- If tool verification fails, state that it could not be verified.
- Only claim minimality when tool output explicitly proves it.
- Never say "Verified" or "the answer is verified" in your response. Present only the factual answer (the proposed changes and their effect). Do not add verification labels or meta-statements.

Tool usage:
- For explanation questions ("why is X recommended?", "what is the ranking?", "why is X not recommended?"), answer directly from the context data above. Do NOT call any tools.
- Only call tools for counterfactual / what-if questions:
  - find_changes_to_make_preferred: when the user asks "how to make X preferred" or "what needs to change".
  - verify_change: when the user proposes specific rating edits and you need to verify the outcome.
- get_restaurant_details is a fallback for when context data is missing. Do NOT call it if ratings and scores are already provided above.

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
    const tools = buildRestaurantTools(currentContext);
    const selectedModel = isCounterfactualTurn
      ? getCounterfactualModel()
      : getModel(process.env.THINKING_LLM || "");
    console.log("🧪 chat_debug:stream_start", {
      requestDebugId,
      hasTools: Boolean(tools),
      toolNames: tools ? Object.keys(tools) : [],
      isCounterfactualTurn,
      modelPath: isCounterfactualTurn ? "counterfactual_model" : "default_model",
    });
    if (isCounterfactualTurn && !tools) {
      console.warn(
        "🧪 chat_debug:counterfactual_without_tools",
        { requestDebugId, reason: "tools unavailable (likely missing/invalid context)" }
      );
    }
    const result = streamText({
      model: selectedModel,
      messages: convertToModelMessages(
        messages as Parameters<typeof convertToModelMessages>[0]
      ),
      system: systemPrompt,
      ...(tools ? { tools, stopWhen: stepCountIs(6) } : {}),
      onFinish: (finish) => {
        const { totalUsage, toolCalls } = finish;
        const outputTokens = totalUsage?.outputTokens ?? 0;
        console.log("⏱ response_stream_end_iso:", new Date().toISOString());
        logTokenUsage("single_path", totalUsage);
        console.log("🧪 chat_debug:stream_finish", {
          requestDebugId,
          outputTokens,
          toolCallCount: toolCalls?.length ?? 0,
          finishKeys: Object.keys(finish as Record<string, unknown>),
          elapsedMs: Date.now() - requestStart,
          isCounterfactualTurn,
        });
        if (outputTokens === 0) {
          console.warn("🧪 chat_debug:empty_completion", {
            requestDebugId,
            latestUserQuery,
            toolCallCount: toolCalls?.length ?? 0,
            hasTools: Boolean(tools),
          });
        }
        if (toolCalls && toolCalls.length > 0) {
          console.log("🧰 Tool calls in response:", toolCalls.map((tc) => tc.toolName));
        }
      },
    });
    console.log("⏱ request_total_ms:", Date.now() - requestStart);

    return result.toUIMessageStreamResponse({
      onError: (error) => {
        console.error("❌ stream_error:", {
          requestDebugId,
          latestUserQuery,
          isCounterfactualTurn,
          error: error instanceof Error ? error.message : String(error),
        });
        return FALLBACK_ANSWER;
      },
    });
  } catch (error) {
    console.error("❌ route_error:", {
      requestDebugId,
      latestUserQuery,
      isCounterfactualTurn,
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ error: FALLBACK_ANSWER }, { status: 500 });
  }
}
