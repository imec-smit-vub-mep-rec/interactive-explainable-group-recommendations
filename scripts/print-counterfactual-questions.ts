import { scenarios } from "../src/lib/data/test_scenarios";
import { resolvePeoplePlaceholders } from "../src/lib/scenario_helpers";

function printCounterfactualQuestions(): void {
  const counterfactualScenarios = scenarios.filter((scenario) =>
    scenario.questions.some((question) => question.task === "counterfactual")
  );

  if (counterfactualScenarios.length === 0) {
    console.log("No counterfactual scenarios found.");
    return;
  }

  for (const scenario of counterfactualScenarios) {
    const peopleNames = scenario.people_names;
    const counterfactualQuestions = scenario.questions.filter(
      (question) => question.task === "counterfactual"
    );

    console.log(`\n=== ${scenario.id.toUpperCase()} (${scenario.type.toUpperCase()}) ===`);
    console.log(`People: ${peopleNames.join(", ")}`);

    for (const question of counterfactualQuestions) {
      const resolvedQuestionText = resolvePeoplePlaceholders(
        question.text,
        peopleNames
      );

      console.log(`\nQuestion ${question.id}:`);
      console.log(resolvedQuestionText);
      console.log("Choices:");

      for (const choice of question.choices ?? []) {
        const resolvedChoiceText = resolvePeoplePlaceholders(
          choice.text,
          peopleNames
        );
        const marker = choice.isCorrectAnswer ? " <-- CORRECT" : "";
        console.log(`- [${choice.id}] ${resolvedChoiceText}${marker}`);
      }
    }
  }
}

printCounterfactualQuestions();
