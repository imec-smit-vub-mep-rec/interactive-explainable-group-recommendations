import { Tour } from "nextstepjs";
import { ExplanationStrategy } from "./types";

const welcomeContent = "The group of friends must decide on a restaurant for dinner. On this page, you see the output of a software system that helps them choose the best restaurant to visit next.";

export const onboardingTours: Tour[] = [
  {
    tour: "no_expl",
    steps: [
      {
        icon: null,
        title: "Welcome!",
        content:
          welcomeContent,
        selector: "[data-onboarding='page-header']",
        side: "bottom",
        showControls: true,
        showSkip: true,
      },
      {
        icon: null,
        title: "Ratings Table",
        content:
          "Here, you can see the 5-star ratings each group member gave to ten possible restaurants.",
        selector: "[data-onboarding='ratings-table']",
        side: "top",
        showControls: true,
        showSkip: true,
      },
      {
        icon: null,
        title: "Visited Restaurants",
        content:
          "Restaurants in grey have already been visited. They are no longer an option for the upcoming decision.",
        selector: "[data-onboarding='grey-rows']",
        side: "top",
        showControls: true,
        showSkip: true,
      },
      {
        icon: null,
        title: "Recommendation",
        content:
          "Finally, here is the system's recommendation based on a specific strategy taking everyone's scores into account.",
        selector: "[data-onboarding='recommendation-box']",
        side: "top",
        showControls: true,
        showSkip: true,
      },
      {
        icon: null,
        title: "Get Started",
        content: "Use this system to answer the questions in the next screen correctly.",
        selector: "[data-onboarding='page-header']",
        side: "top",
        showControls: true,
        showSkip: false,
      },
    ],
  },
  {
    tour: "static_list",
    steps: [
      {
        icon: null,
        title: "Welcome!",
        content:
          welcomeContent,
        selector: "[data-onboarding='page-header']",
        side: "bottom",
        showControls: true,
        showSkip: true,
      },
      {
        icon: null,
        title: "Ratings Table",
        content:
          "Each group member rated ten restaurants on a 5-star scale. These ratings are shown in this table.",
        selector: "[data-onboarding='ratings-table']",
        side: "top",
        showControls: true,
        showSkip: true,
      },
      {
        icon: null,
        title: "Ranked List",
        content:
          "Here you find the restaurants ranked from best to worst based on the group's preferences.",
        selector: "[data-onboarding='ranked-list']",
        side: "top",
        showControls: true,
        showSkip: true,
      },
      {
        icon: null,
        title: "Strategy Explanation",
        content:
          'The definition of "best" and "worst" is based on a specific strategy that weighs everyone\'s scores.',
        selector: "[data-onboarding='strategy-label']",
        side: "top",
        showControls: true,
        showSkip: true,
      },
      {
        icon: null,
        title: "Get Started",
        content: "Use this system to answer the questions in the next step correctly.",
        selector: "[data-onboarding='page-header']",
        side: "top",
        showControls: true,
        showSkip: false,
      },
    ],
  },
  {
    tour: "interactive_list",
    steps: [
      {
        icon: null,
        title: "Welcome!",
        content:
          welcomeContent,
        selector: "[data-onboarding='page-header']",
        side: "bottom",
        showControls: true,
        showSkip: true,
      },
      {
        icon: null,
        title: "Interactive Table",
        content:
          "You can increase or decrease these scores using the arrows. Edit a few ratings to see how the recommendations change.",
        selector: "[data-onboarding='interactive-table']",
        side: "top",
        showControls: true,
        showSkip: true,
      },
      {
        icon: null,
        title: "Visited Restaurants",
        content:
          "Greyed-out restaurants are those already visited; they won't be recommended even if scores change.",
        selector: "[data-onboarding='grey-rows']",
        side: "top",
        showControls: true,
        showSkip: true,
      },
      {
        icon: null,
        title: "Ranked List",
        content:
          "Here you find the restaurants ranked from best to worst. The ranking might shift as you edit the table above.",
        selector: "[data-onboarding='ranked-list']",
        side: "top",
        showControls: true,
        showSkip: true,
      },
      {
        icon: null,
        title: "Strategy Explanation",
        content:
          'The definition of \'best\' and \'worst\' is based on a specific strategy that weighs everyone\'s scores in a specific way.',
        selector: "[data-onboarding='strategy-label']",
        side: "top",
        showControls: true,
        showSkip: false,
      },
      {
        icon: null,
        title: "Get Started",
        content: "Use this system to understand how the recommendations are made.",
        selector: "[data-onboarding='page-header']",
        side: "top",
        showControls: true,
        showSkip: false,
      },
    ],
  },
  {
    tour: "conversational",
    steps: [
      {
        icon: null,
        title: "Welcome!",
        content:
          welcomeContent,
        selector: "[data-onboarding='page-header']",
        side: "bottom",
        showControls: true,
        showSkip: true,
      },
      {
        icon: null,
        title: "Ratings Table",
        content:
          "This table shows the 5-star ratings given by each group member for the ten possible restaurants.",
        selector: "[data-onboarding='ratings-table']",
        side: "top",
        showControls: true,
        showSkip: true,
      },
      {
        icon: null,
        title: "Chat Interface",
        content:
          "You can chat with an assistant to ask specific questions about the system's recommendations.",
        selector: "[data-onboarding='chat-interface']",
        side: "top",
        showControls: true,
        showSkip: true,
      },
      {
        icon: null,
        title: "Chat Input",
        content:
          'Use one of the presets to get started, or type in your own question. Press "Enter" to submit.',
        selector: "[data-onboarding='chat-input']",
        side: "top",
        showControls: true,
        showSkip: true,
      },
      {
        icon: null,
        title: "Get Started",
        content: "Use this system to answer the questions in the next step correctly.",
        selector: "[data-onboarding='page-header']",
        side: "top",
        showControls: true,
        showSkip: false,
      },
    ],
  },
  {
    tour: "interactive_graph",
    steps: [
      {
        icon: null,
        title: "Welcome!",
        content:
          welcomeContent,
        selector: "[data-onboarding='page-header']",
        side: "bottom",
        showControls: true,
        showSkip: true,
      },
      {
        icon: null,
        title: "Interactive Table",
        content:
          "You can increase or decrease these scores using the arrows. Below the table, you can see how the recommendations change.",
        selector: "[data-onboarding='interactive-table']",
        side: "top",
        showControls: true,
        showSkip: true,
      },
      {
        icon: null,
        title: "Visited Restaurants",
        content:
          "Greyed-out restaurants are those already visited; they won't be recommended even if scores change.",
        selector: "[data-onboarding='grey-rows']",
        side: "top",
        showControls: true,
        showSkip: true,
      },
      {
        icon: null,
        title: "Interactive Graph",
        content:
          "This graph shows the ratings and recommendations visually. You can drag the bars up or down to change ratings and see how the recommendations update in real-time.",
        selector: "[data-onboarding='interactive-graph']",
        side: "top",
        showControls: true,
        showSkip: true,
      },
      {
        icon: null,
        title: "Graph Explanation",
        content:
          "The graph visualizes how each person rated each restaurant. The recommended restaurant is highlighted in yellow. The group score is shown as a dashed line based on the strategy.",
        selector: "[data-onboarding='graph-explanation']",
        side: "top",
        showControls: true,
        showSkip: true,
      },
      {
        icon: null,
        title: "Get Started",
        content: "Use this system to answer the questions in the next step correctly.",
        selector: "[data-onboarding='page-header']",
        side: "top",
        showControls: true,
        showSkip: false,
      },
    ],
  },
];

export function getTourForStrategy(
  strategy: ExplanationStrategy
): string | null {
  const validTours = [
    "no_expl",
    "static_list",
    "interactive_list",
    "conversational",
    "interactive_graph",
  ];
  return validTours.includes(strategy) ? strategy : null;
}
