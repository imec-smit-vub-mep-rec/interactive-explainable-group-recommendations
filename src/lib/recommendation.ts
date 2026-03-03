export type AggregationStrategy = "LMS" | "ADD" | "APP";

export type Person = {
  name: string;
};

export type Restaurant = {
  name: string;
  visited: boolean;
};

export type RatingUpdateInput = {
  personName: string;
  restaurantName: string;
  newRating: number;
};

export type AppliedRatingUpdate = RatingUpdateInput & {
  personIndex: number;
  restaurantIndex: number;
  oldRating: number;
};

const normalizeName = (name: string) => name.trim().toLowerCase();

const findIndexByName = (items: Array<{ name: string }>, name: string) => {
  const normalized = normalizeName(name);
  return items.findIndex((item) => normalizeName(item.name) === normalized);
};

export function computeRestaurantScore(
  ratings: number[][],
  restaurantIndex: number,
  strategy: AggregationStrategy
): number {
  const restaurantRatings = ratings.map((row) => row[restaurantIndex]);
  switch (strategy) {
    case "LMS":
      return Math.min(...restaurantRatings);
    case "ADD":
      return restaurantRatings.reduce((sum, rating) => sum + rating, 0);
    case "APP":
      return restaurantRatings.filter((rating) => rating > 3).length;
    default:
      return Math.min(...restaurantRatings);
  }
}

export function computeGroupScores(
  ratings: number[][],
  strategy: AggregationStrategy
): number[] {
  if (ratings.length === 0) return [];
  const restaurantCount = ratings[0].length;
  const scores: number[] = [];
  for (let restaurantIdx = 0; restaurantIdx < restaurantCount; restaurantIdx += 1) {
    scores.push(computeRestaurantScore(ratings, restaurantIdx, strategy));
  }
  return scores;
}

export function computeWinners(input: {
  restaurants: Restaurant[];
  groupScores: number[];
}): { winnerIndices: number[]; winnerNames: string[] } {
  const { restaurants, groupScores } = input;
  const candidates = restaurants
    .map((restaurant, index) => ({
      index,
      visited: restaurant.visited,
      score: groupScores[index],
    }))
    .filter((candidate) => !candidate.visited);

  if (candidates.length === 0) {
    return { winnerIndices: [], winnerNames: [] };
  }

  const bestScore = Math.max(...candidates.map((c) => c.score));
  const winnerIndices = candidates
    .filter((c) => c.score === bestScore)
    .map((c) => c.index);
  const winnerNames = winnerIndices.map((idx) => restaurants[idx].name);
  return { winnerIndices, winnerNames };
}

export function applyRatingUpdates(input: {
  ratings: number[][];
  people: Person[];
  restaurants: Restaurant[];
  updates: RatingUpdateInput[];
}): {
  updatedRatings: number[][];
  appliedUpdates: AppliedRatingUpdate[];
  errors: string[];
} {
  const { ratings, people, restaurants, updates } = input;
  const updatedRatings = ratings.map((row) => row.slice());
  const appliedUpdates: AppliedRatingUpdate[] = [];
  const errors: string[] = [];

  for (const update of updates) {
    const personIndex = findIndexByName(people, update.personName);
    if (personIndex === -1) {
      errors.push(
        `Person "${update.personName}" not found. Available people: ${people
          .map((p) => p.name)
          .join(", ")}`
      );
      continue;
    }

    const restaurantIndex = findIndexByName(restaurants, update.restaurantName);
    if (restaurantIndex === -1) {
      errors.push(
        `Restaurant "${update.restaurantName}" not found. Available restaurants: ${restaurants
          .map((r) => r.name)
          .join(", ")}`
      );
      continue;
    }

    if (restaurants[restaurantIndex].visited) {
      errors.push(
        `Cannot update rating for "${update.restaurantName}" as it has been previously visited.`
      );
      continue;
    }

    if (
      update.newRating < 1 ||
      update.newRating > 5 ||
      !Number.isInteger(update.newRating)
    ) {
      errors.push(
        `Invalid rating value "${update.newRating}" for ${update.personName}'s rating of ${update.restaurantName}. Rating must be an integer between 1 and 5.`
      );
      continue;
    }

    const oldRating = updatedRatings[personIndex][restaurantIndex];
    if (oldRating === update.newRating) {
      // No-op updates are ignored so downstream verification focuses on
      // targeted, effective edits only.
      continue;
    }
    updatedRatings[personIndex][restaurantIndex] = update.newRating;
    appliedUpdates.push({
      ...update,
      personIndex,
      restaurantIndex,
      oldRating,
    });
  }

  return { updatedRatings, appliedUpdates, errors };
}

