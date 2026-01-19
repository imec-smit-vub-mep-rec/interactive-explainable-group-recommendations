"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const scenarios_1 = require("../src/lib/data/scenarios");
const PERSON_INDEX = {
    Darcy: 0,
    Alex: 1,
    Jess: 2,
    Jackie: 3,
    Freddy: 4,
};
function strategyForScenarioType(t) {
    switch (t) {
        case "add":
            return "ADD";
        case "lms":
            return "LMS";
        case "app":
            return "APP";
        default:
            throw new Error(`Unknown scenario type: ${t}`);
    }
}
function scoreRestaurant(ratings, restaurantIndex0, strategy) {
    const restaurantRatings = ratings.map((row) => row[restaurantIndex0]);
    switch (strategy) {
        case "LMS":
            return Math.min(...restaurantRatings);
        case "ADD":
            return restaurantRatings.reduce((sum, r) => sum + r, 0);
        case "APP":
            return restaurantRatings.filter((r) => r > 3).length;
    }
}
function recommendedRestaurants(ratings, visitedRestaurantIndices0, strategy) {
    const visited = new Set(visitedRestaurantIndices0);
    const candidates = [];
    for (let i = 0; i < 10; i++) {
        if (visited.has(i))
            continue;
        candidates.push({ idx: i, score: scoreRestaurant(ratings, i, strategy) });
    }
    if (candidates.length === 0)
        return [];
    const best = Math.max(...candidates.map((c) => c.score));
    return candidates.filter((c) => c.score === best).map((c) => c.idx + 1); // 1-based Rest #
}
function parseModifications(choiceText) {
    // Expected form:
    // "Change Rest 6 for Jackie to 3 and Rest 1 for Alex to 5."
    const re = /^Change\s+Rest\s+(\d+)\s+for\s+([A-Za-z]+)\s+to\s+(\d+)\s+and\s+Rest\s+(\d+)\s+for\s+([A-Za-z]+)\s+to\s+(\d+)\.?$/;
    const m = choiceText.trim().match(re);
    if (!m) {
        throw new Error(`Unparseable counterfactual choice: "${choiceText}"`);
    }
    return [
        { rest: Number(m[1]), person: m[2], value: Number(m[3]) },
        { rest: Number(m[4]), person: m[5], value: Number(m[6]) },
    ];
}
const CANONICAL_NAMES = Object.keys(PERSON_INDEX);
function isChangeFromSuggested(nextRecommended, suggested) {
    return !(nextRecommended.length === 1 && nextRecommended[0] === suggested);
}
function formatChoiceText(mods) {
    const [a, b] = mods;
    return `Change Rest ${a.rest} for ${a.person} to ${a.value} and Rest ${b.rest} for ${b.person} to ${b.value}.`;
}
function proposeNameAssignmentsForScenario(input) {
    const baseMods = input.choices.map((c) => parseModifications(c.text));
    const desired = input.choices.map((c) => c.isCorrectAnswer === true);
    // Backtracking over all 8 person slots (4 choices x 2 mods).
    // State: assigned person names for each slot.
    const assigned = baseMods.map((mods) => mods.map((m) => m.person));
    const slots = [];
    for (let ci = 0; ci < baseMods.length; ci++) {
        for (let mi = 0; mi < baseMods[ci].length; mi++)
            slots.push({ choiceIdx: ci, modIdx: mi });
    }
    function checkAll() {
        for (let ci = 0; ci < baseMods.length; ci++) {
            const mods = baseMods[ci].map((m, mi) => ({
                ...m,
                person: assigned[ci][mi],
            }));
            const nextRatings = applyModifications(input.ratings, mods);
            const nextRecommended = recommendedRestaurants(nextRatings, input.previous_visits, input.strategy);
            const changed = isChangeFromSuggested(nextRecommended, input.suggested);
            if (changed !== desired[ci])
                return false;
        }
        return true;
    }
    function dfs(slotIdx) {
        if (slotIdx === slots.length)
            return checkAll();
        const { choiceIdx, modIdx } = slots[slotIdx];
        for (const name of CANONICAL_NAMES) {
            assigned[choiceIdx][modIdx] = name;
            // Small pruning: if after assigning the two mods of a choice we can already
            // evaluate that choice and it violates desired, prune early.
            if (modIdx === 1) {
                const mods = baseMods[choiceIdx].map((m, mi) => ({
                    ...m,
                    person: assigned[choiceIdx][mi],
                }));
                const nextRatings = applyModifications(input.ratings, mods);
                const nextRecommended = recommendedRestaurants(nextRatings, input.previous_visits, input.strategy);
                const changed = isChangeFromSuggested(nextRecommended, input.suggested);
                if (changed !== desired[choiceIdx])
                    continue;
            }
            if (dfs(slotIdx + 1))
                return true;
        }
        return false;
    }
    const ok = dfs(0);
    if (!ok)
        return null;
    const out = {};
    for (let ci = 0; ci < input.choices.length; ci++) {
        const mods = baseMods[ci].map((m, mi) => ({ ...m, person: assigned[ci][mi] }));
        out[input.choices[ci].id] = { mods, text: formatChoiceText(mods) };
    }
    return out;
}
function proposeMinimalFixForScenario(input) {
    const baseMods = input.choices.map((c) => parseModifications(c.text));
    const desired = input.choices.map((c) => c.isCorrectAnswer === true);
    const currentChanged = input.choices.map((c, idx) => {
        const nextRatings = applyModifications(input.ratings, baseMods[idx]);
        const nextRecommended = recommendedRestaurants(nextRatings, input.previous_visits, input.strategy);
        return isChangeFromSuggested(nextRecommended, input.suggested);
    });
    const mismatchedChoiceIdxs = currentChanged
        .map((ch, idx) => ({ idx, ok: ch === desired[idx] }))
        .filter((x) => !x.ok)
        .map((x) => x.idx);
    // In our current dataset we expect exactly one mismatched choice per scenario when names drift.
    // Try to fix by only changing the names in that choice (2 mods → 25 combos).
    if (mismatchedChoiceIdxs.length !== 1)
        return null;
    const targetIdx = mismatchedChoiceIdxs[0];
    const originalMods = baseMods[targetIdx];
    const originalNames = originalMods.map((m) => m.person);
    let best = null;
    for (const nameA of CANONICAL_NAMES) {
        for (const nameB of CANONICAL_NAMES) {
            const trialMods = baseMods.map((mods, ci) => mods.map((m) => ({ ...m })));
            trialMods[targetIdx][0].person = nameA;
            trialMods[targetIdx][1].person = nameB;
            let allOk = true;
            for (let ci = 0; ci < input.choices.length; ci++) {
                const nextRatings = applyModifications(input.ratings, trialMods[ci]);
                const nextRecommended = recommendedRestaurants(nextRatings, input.previous_visits, input.strategy);
                const changed = isChangeFromSuggested(nextRecommended, input.suggested);
                if (changed !== desired[ci]) {
                    allOk = false;
                    break;
                }
            }
            if (!allOk)
                continue;
            const distance = (nameA === originalNames[0] ? 0 : 1) + (nameB === originalNames[1] ? 0 : 1);
            const texts = {};
            texts[input.choices[targetIdx].id] = formatChoiceText([
                { ...originalMods[0], person: nameA },
                { ...originalMods[1], person: nameB },
            ]);
            const candidate = { names: [nameA, nameB], texts, distance };
            if (!best || candidate.distance < best.distance)
                best = candidate;
            if (best.distance === 0)
                break;
        }
        if (best?.distance === 0)
            break;
    }
    return best?.texts ?? null;
}
function applyModifications(ratings, mods) {
    const next = ratings.map((row) => row.slice());
    for (const mod of mods) {
        const personIndex = PERSON_INDEX[mod.person];
        if (personIndex === undefined) {
            throw new Error(`Unknown person name "${mod.person}" in mods`);
        }
        const rIdx = mod.rest - 1;
        if (rIdx < 0 || rIdx >= 10) {
            throw new Error(`Invalid restaurant number Rest ${mod.rest}`);
        }
        next[personIndex][rIdx] = mod.value;
    }
    return next;
}
function parseSuggestedRestaurant(questionText) {
    // "... system suggests Rest 4. Which ..."
    const m = questionText.match(/system suggests Rest\s+(\d+)/);
    if (!m)
        throw new Error(`Could not find "system suggests Rest N" in: ${questionText}`);
    return Number(m[1]);
}
function main() {
    const counterfactualScenarios = scenarios_1.scenarios.filter((s) => s.questions?.some((q) => q.task === "counterfactual"));
    const failures = [];
    for (const s of counterfactualScenarios) {
        const strategy = strategyForScenarioType(s.type);
        const q = s.questions.find((qq) => qq.task === "counterfactual");
        if (!q || !q.choices)
            continue;
        const suggested = parseSuggestedRestaurant(q.text);
        const baseRecommended = recommendedRestaurants(s.ratings, s.previous_visits, strategy);
        if (!baseRecommended.includes(suggested)) {
            failures.push(`${s.id}: question says suggested Rest ${suggested}, but computed recommended is [${baseRecommended.join(", ")}] under ${strategy}`);
        }
        const correctChoices = q.choices.filter((c) => c.isCorrectAnswer);
        if (correctChoices.length !== 1) {
            failures.push(`${s.id}: expected exactly 1 correct choice, found ${correctChoices.length}`);
        }
        for (const choice of q.choices) {
            const mods = parseModifications(choice.text);
            const nextRatings = applyModifications(s.ratings, mods);
            const nextRecommended = recommendedRestaurants(nextRatings, s.previous_visits, strategy);
            const changed = isChangeFromSuggested(nextRecommended, suggested);
            const markedCorrect = choice.isCorrectAnswer === true;
            if (changed !== markedCorrect) {
                failures.push(`${s.id}/${choice.id}: markedCorrect=${markedCorrect} but changed=${changed}. suggested=${suggested}, next=[${nextRecommended.join(", ")}] text="${choice.text}"`);
            }
        }
    }
    if (failures.length) {
        console.error(`Counterfactual verification FAILED (${failures.length} issues):`);
        for (const f of failures)
            console.error(`- ${f}`);
        console.error("");
        console.error("Attempting to propose name assignments that satisfy the current answer key...");
        for (const s of counterfactualScenarios) {
            const q = s.questions.find((qq) => qq.task === "counterfactual");
            if (!q?.choices)
                continue;
            const strategy = strategyForScenarioType(s.type);
            const suggested = parseSuggestedRestaurant(q.text);
            const minimal = proposeMinimalFixForScenario({
                ratings: s.ratings,
                previous_visits: s.previous_visits,
                strategy,
                suggested,
                choices: q.choices.map((c) => ({ id: c.id, text: c.text, isCorrectAnswer: c.isCorrectAnswer })),
            });
            if (minimal) {
                console.error(`\n${s.id} (minimal fix):`);
                for (const [choiceId, newText] of Object.entries(minimal)) {
                    console.error(`- ${choiceId}: ${newText}`);
                }
                continue;
            }
            // Fall back to a full (but often ugly) assignment if minimal fixing fails.
            const proposal = proposeNameAssignmentsForScenario({
                ratings: s.ratings,
                previous_visits: s.previous_visits,
                strategy,
                suggested,
                choices: q.choices.map((c) => ({ id: c.id, text: c.text, isCorrectAnswer: c.isCorrectAnswer })),
            });
            if (!proposal)
                continue;
            console.error(`\n${s.id} (full reassignment fallback):`);
            for (const c of q.choices) {
                const p = proposal[c.id];
                if (!p)
                    continue;
                const marker = c.isCorrectAnswer ? " (correct)" : "";
                console.error(`- ${c.id}${marker}: ${p.text}`);
            }
        }
        process.exitCode = 1;
    }
    else {
        console.log(`Counterfactual verification PASSED for ${counterfactualScenarios.length} scenarios.`);
    }
}
main();
