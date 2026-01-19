// import { google } from "@ai-sdk/google";
import { cerebras } from "@ai-sdk/cerebras";
import { generateObject, streamText, convertToModelMessages, tool } from "ai";
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

const normalizeName = (name: string) => name.trim().toLowerCase();

const extractMessageText = (message: Record<string, unknown>) => {
  if (typeof message.content === "string") {
    return message.content;
  }
  if (Array.isArray(message.parts)) {
    return message.parts
      .map((part) => {
        if (part && typeof part === "object" && part.type === "text") {
          return typeof part.text === "string" ? part.text : "";
        }
        return "";
      })
      .join(" ");
  }
  return "";
};

type CounterfactualIntentResult = {
  intent: "counterfactual" | "other";
  wantsMinimality?: boolean;
  targetRestaurantName?: string;
  proposedUpdates?: ProposedUpdate[];
  claimed?: ProposedClaimed;
};

const quickIntentFromText = (text: string): CounterfactualIntentResult | null => {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return null;

  const isCounterfactual =
    /\bhow to make\b|\bmake\b.*\bpreferred\b|\bmake\b.*\btop\b|\bchange\b.*\brecommendation\b|\bwhat if\b|\b(change|increase|decrease|raise|lower)\b.*\brating\b/.test(
      normalized
    );
  if (!isCounterfactual) {
    return { intent: "other" };
  }

  const wantsMinimality = /\bminimal\b|\bminimum\b|\bsmallest\b/.test(normalized);

  return {
    intent: "counterfactual",
    wantsMinimality,
  };
};

const buildFallbackUpdates = (input: {
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

  const ok =
    mode === "prove_minimal"
      ? preferred && minimality.proven && minimality.isMinimal && claimedOk
      : preferred && claimedOk;

  const message = ok
    ? mode === "prove_minimal"
      ? `Verified: proposed change makes ${targetRestaurantName} preferred and is minimal.`
      : `Verified: proposed change makes ${targetRestaurantName} preferred. (Minimality not checked.)`
    : !preferred
    ? `Verification failed: proposed change does not make ${targetRestaurantName} preferred.`
    : mode === "prove_minimal" && minimality.proven && !minimality.isMinimal
    ? "Verification failed: found a smaller change that also makes the target preferred."
    : mode === "prove_minimal"
    ? "Verification incomplete: minimality could not be proven within search limits."
    : "Verification failed: claimed winners/score did not match the computed result.";

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
  const APP = "APP (Approval Voting): Maximizes the number of votes above 3 (greater than or equal to 4)";
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
3. Explain the current recommendation strategy
4. Answer any specific user question about the recommendations, the strategy, or the group decision-making process

You cannot answer questions that are not related to the restaurant recommendations or the group decision-making process.

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

CRITICAL RESPONSE FORMATTING RULES:

1. **BE CONCISE**: Keep responses short and to the point. Use the following information elements: rank, score, strategy explanation. Only provide detailed explanations when the user explicitly asks for more detail.

2. When explaining recommendations, include:
   - Restaurant rank (if relevant)
   - Group score
   - Strategy-specific explanation:
     * LMS: "The lowest rating is X"
     * ADD: "The total rating is X"
     * APP: "X users gave a score of 4 or more"
   - Which restaurants are recommended
   - Keep it brief

3. **SUGGESTIONS**: After EVERY response, end with exactly 2 follow-up suggestions in this exact format:
   <suggestions>
   - Suggestion 1
   - Suggestion 2
   </suggestions>
   
**SUGGESTIONS**: Make suggestions relevant to the current conversation context and helpful for exploring the recommendation system.
For example, "How to make rest X preferred?", "Why is rest X not recommended?".

For rating changes, follow this natural flow:
1. EXPLANATION REQUESTS: When users ask "why is X recommended?" or "how to make Y preferred?", provide a concise explanation
2. COUNTERFACTUAL SUGGESTIONS: When users ask "how to make X preferred?", suggest specific changes and verify them. Only optimize for minimality if the user explicitly asks for minimal/minimum/smallest.

CRITICAL: You must verify your answer by using the tools provided.

VERIFICATION PROTOCOL (MANDATORY):
- For counterfactual/minimal-change questions, you must only provide a definitive answer after verification.
- Do NOT state numeric scores unless they appear in the verification output.
- If verification fails, explicitly say it could not be verified and avoid definitive claims.
- Only claim a change is minimal if the verification output indicates minimality was proven.

CONVERSATION FLOW EXAMPLES:

**Explanation Request:**
User: "Why is Rest 1 recommended?"
You: "Rest 1 is recommended with a group score of X. [Strategy explanation]. <suggestions>
- How to make Rest 2 preferred?
- What if Alex's rating for Rest 1 increased?
- Show individual ratings for Rest 1
</suggestions>"

**Counterfactual Request:**
User: "How to make Rest 3 preferred?"
You: Analyze current situation, suggest small changes concisely. End with suggestions.

ANALYSIS GUIDANCE:
- Look at current group scores and identify the highest scoring restaurant
- For "how to make X preferred", propose one concrete change (it does not have to be minimal unless asked) and verify that it makes X preferred. If the user asks for minimal/minimum/smallest, then attempt to find and prove minimality.
- Consider the aggregation strategy (LMS: minimum rating, ADD: sum of ratings, APP: count of ratings > 3 (so greater than or equal to 4))
- Suggest the most impactful single change first, then mention alternatives if needed

IMPORTANT: When using the tools:
- Use exact person and restaurant names as they appear in the context
- Only update ratings for restaurants that haven't been visited (visited restaurants are excluded from recommendations)
- Rating values must be integers between 1 and 5
- Always explain the impact of the change concisely after updating ratings

Remember: Keep responses SHORT and use the default information elements (rank, score, strategy explanation) unless the user explicitly asks for more detail.


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

  const baseScoresForPrompt = currentContext
    ? computeGroupScores(
        currentContext.ratings,
        currentContext.strategy as AggregationStrategy
      )
    : [];
  const baseWinnersForPrompt = currentContext
    ? computeWinners({
        restaurants: currentContext.restaurants,
        groupScores: baseScoresForPrompt,
      })
    : { winnerIndices: [], winnerNames: [] };
  const topScoreForPrompt =
    baseWinnersForPrompt.winnerIndices.length > 0
      ? baseScoresForPrompt[baseWinnersForPrompt.winnerIndices[0]]
      : null;

  const intentPrompt = `You are a request classifier and counterfactual proposal engine.

Return ONLY valid JSON that matches this schema:
{
  "intent": "counterfactual" | "other",
  "wantsMinimality"?: boolean,
  "targetRestaurantName"?: string,
  "proposedUpdates"?: Array<{
    "personName": string,
    "restaurantName": string,
    "newRating": number
  }>,
  "claimed"?: {
    "winners"?: string[],
    "targetScore"?: number
  }
}

Classification rules:
- intent = "counterfactual" if the user asks about hypothetical rating changes, \"what if\" scenarios, or how to make a restaurant preferred/top.
- intent = "other" otherwise.
- wantsMinimality = true ONLY if the user explicitly asks for minimal/minimum/smallest change.

If intent = "counterfactual":
- Provide targetRestaurantName and proposedUpdates that would make the target preferred.
- Keep changes small when possible (few edits, small deltas) but correctness is required.
- Use exact person and restaurant names from the context.
- Only update restaurants that have NOT been visited.
- Rating values must be integers between 1 and 5.
- Goal: make the target's group score >= the current top score among unvisited restaurants (ties are OK).

If intent = "other":
- Leave targetRestaurantName and proposedUpdates empty/undefined.

Context:
Current winners (unvisited): ${baseWinnersForPrompt.winnerNames.join(", ")}
Current top score (unvisited): ${topScoreForPrompt ?? "unknown"}
Strategy: ${currentContext?.strategy ?? "unknown"}
People: ${currentContext?.people.map((p) => p.name).join(", ")}
Restaurants: ${currentContext?.restaurants.map((r) => r.name).join(", ")}
Visited: ${currentContext?.restaurants
    .filter((r) => r.visited)
    .map((r) => r.name)
    .join(", ")}
Group scores: ${currentContext?.groupScores
    .map((score, i) => `${currentContext!.restaurants[i].name}: ${score}`)
    .join(", ")}`;

  // console.log(systemPrompt);

  const lastMessage = messages[messages.length - 1] ?? {};
  const lastUserText = extractMessageText(lastMessage);
  const quickIntent = quickIntentFromText(lastUserText);
  const intentSchema: z.ZodType<CounterfactualIntentResult> = z.object({
    intent: z.enum(["counterfactual", "other"]),
    wantsMinimality: z.boolean().optional(),
    targetRestaurantName: z.string().optional(),
    proposedUpdates: z
      .array(
        z.object({
          personName: z.string(),
          restaurantName: z.string(),
          newRating: z.number().int().min(1).max(5),
        })
      )
      .optional(),
    claimed: z
      .object({
        winners: z.array(z.string()).optional(),
        targetScore: z.number().optional(),
      })
      .optional(),
  });

  let intentData: CounterfactualIntentResult;
  if (quickIntent) {
    intentData = quickIntent;
    console.log("⏱ intent_debug:", {
      source: "quick",
      intent: intentData.intent,
      wantsMinimality: intentData.wantsMinimality,
    });
  } else {
    const intentStart = Date.now();
    const intentModel = process.env.INTENT_LLM || "";
    const intentSystem = `${intentPrompt}\n\nUser message:\n${lastUserText}`;
    const intentMessages = convertToModelMessages(messages);
    console.log("⏱ intent_debug:", {
      source: "llm",
      model: intentModel,
      messagesCount: intentMessages.length,
      systemChars: intentSystem.length,
      userChars: lastUserText.length,
      hasContext: !!currentContext,
    });
    const intentResult = await generateObject({
      model: cerebras(intentModel),
      messages: intentMessages,
      system: intentSystem,
      schema: intentSchema,
    });
    console.log("⏱ intent_classification_ms:", Date.now() - intentStart);
    intentData = intentResult.object;
  }
  const isCounterfactual = intentData.intent === "counterfactual";
  const wantMinimalityProof = intentData.wantsMinimality === true;

  if (isCounterfactual && currentContext && !intentData.targetRestaurantName) {
    const clarificationBlock =
      "\n\nIMPORTANT: The user asked a counterfactual question, but the target restaurant or change is unclear. Ask them to specify which restaurant should be preferred and which ratings to adjust.";
    const result = streamText({
      model: cerebras(process.env.THINKING_LLM || ""),
      messages: convertToModelMessages(messages),
      system: `${systemPrompt}${clarificationBlock}`,
    });
    return result.toUIMessageStreamResponse();
  }

  if (isCounterfactual && currentContext && intentData.targetRestaurantName) {
    const verifyStart = Date.now();
    const verification = verifyMinimalChangeInternal({
      context: currentContext,
      targetRestaurantName: intentData.targetRestaurantName,
      proposedUpdates: intentData.proposedUpdates ?? [],
      claimed: intentData.claimed,
      search: DEFAULT_SEARCH_LIMITS,
      mode: wantMinimalityProof ? "prove_minimal" : "verify_only",
    });
    console.log("⏱ verification_ms:", Date.now() - verifyStart);

    // If we're only verifying correctness (not proving minimality) and the proposal doesn't
    // actually make the target preferred, fall back to a guaranteed-working (but non-minimal)
    // target-only adjustment. This prevents the model from getting stuck saying it "can't verify"
    // when it simply proposed an invalid change.
    const fallbackStart = Date.now();
    const effectiveVerification =
      !wantMinimalityProof && !verification.verification.ok
        ? verifyMinimalChangeInternal({
            context: currentContext,
            targetRestaurantName: intentData.targetRestaurantName,
            proposedUpdates: buildFallbackUpdates({
              context: currentContext,
              targetRestaurantName: intentData.targetRestaurantName,
            }),
            claimed: undefined,
            search: DEFAULT_SEARCH_LIMITS,
            mode: "verify_only",
          })
        : verification;
    if (effectiveVerification !== verification) {
      console.log("⏱ fallback_verification_ms:", Date.now() - fallbackStart);
    }

    console.log(
      "🔎 Verification result:",
      JSON.stringify(effectiveVerification.verification)
    );

    const verificationBlock = `\n\nVERIFICATION_RESULT_JSON:\n${JSON.stringify(
      effectiveVerification.verification,
      null,
      2
    )}\n\nFINAL ANSWER RULES:\n- Only provide definitive counterfactual claims when verification.ok is true.\n- Do not state numeric scores unless they appear in VERIFICATION_RESULT_JSON.\n- If verification.mode is \"verify_only\", do NOT discuss minimality; just describe the verified change and its verified outcome.\n- You MUST explicitly state whether the verified change is BETTER than the current top score or EQUALLY AS GOOD (tie). Use verification.computed.comparisonToTop and say \"equally as good\" when equal.\n- If verification.ok is false, say it could not be verified and avoid definitive claims.`;

    const result = streamText({
      model: cerebras(process.env.THINKING_LLM || ""),
      messages: convertToModelMessages(messages),
      system: `${systemPrompt}${verificationBlock}`,
      onFinish: () => {
        console.log("⏱ response_stream_end_iso:", new Date().toISOString());
      },
    });
    console.log("⏱ counterfactual_total_ms:", Date.now() - requestStart);

    return result.toUIMessageStreamResponse();
  }

  const tools = isCounterfactual && !!intentData.targetRestaurantName
    ? {
        verifyMinimalChange: tool({
          description: "Verify the minimal change needed to make X preferred.",
          inputSchema: z.object({
            targetRestaurantName: z
              .string()
              .describe("The name of the restaurant to make preferred"),
            proposedUpdates: z.array(
              z.object({
                personName: z
                  .string()
                  .describe("The name of the person whose rating to update"),
                restaurantName: z
                  .string()
                  .describe("The name of the restaurant to update the rating for"),
                newRating: z
                  .number()
                  .int()
                  .min(1)
                  .max(5)
                  .describe("The new rating value (1-5)"),
              })
            ),
            claimed: z
              .object({
                winners: z.array(z.string()).optional(),
                targetScore: z.number().optional(),
              })
              .optional(),
            search: z
              .object({
                maxEditedCells: z.number().int().min(1).max(5).optional(),
                timeLimitMs: z.number().int().min(100).max(10000).optional(),
              })
              .optional(),
            mode: z
              .enum(["verify_only", "prove_minimal"])
              .optional()
              .describe(
                'verify_only: only verify winners/scores; prove_minimal: also attempt to prove minimality'
              ),
          }),
          execute: async ({
            targetRestaurantName,
            proposedUpdates,
            claimed,
            search,
            mode,
          }) => {
            return verifyMinimalChangeInternal({
              context: currentContext,
              targetRestaurantName,
              proposedUpdates,
              claimed,
              search,
              mode,
            });
          },
        }),
      }
    : undefined;

  const result = streamText({
    model: cerebras(process.env.THINKING_LLM || ""), //google("gemini-2.5-flash"),
    messages: convertToModelMessages(messages),
    system: systemPrompt,
    tools,
    onFinish: () => {
      console.log("⏱ response_stream_end_iso:", new Date().toISOString());
    },
  });
  console.log("⏱ request_total_ms:", Date.now() - requestStart);

  return result.toUIMessageStreamResponse();
}
