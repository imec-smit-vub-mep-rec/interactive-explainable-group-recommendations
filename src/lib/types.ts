export type ExplanationStrategy =
  | "no_expl"
  | "static_list"
  | "interactive_list"
  | "conversational"
  | "text_expl"
  | "chat_expl"
  | "chat_expl_basic"
  | "chat_expl_with_tools"
  | "chat_expl_with_tools_graph"
  | "graph_expl"
  | "pie_expl"
  | "heatmap_expl"
  | "ordered_list_expl";

export type AnswerValue =
  | string
  | string[]
  | number
  | Record<string, string>
  | null
  | undefined;

export type QuestionType =
  | "multipleChoice"
  | "checkbox"
  | "textInput"
  | "textDisplay"
  | "rating"
  | "number"
  | "likertGrid"
  | "searchableSelect";

export interface Question {
  id: string;
  type: QuestionType;
  text: string; // the question itself
  description?: string; // optional description of the question or extra information
  required: boolean;
  isAttentionCheck: boolean; // for all questions: whether the question is an attention check
  answer?: AnswerValue; // the answer to the question given by the participant
  // Optional properties for different question types
  choices?: Array<{
    id: string;
    text: string;
    value: string;
    isCorrectAnswer?: boolean;
  }>;
  placeholder?: string;
  min?: number;
  max?: number;
  statements?: string[];
  scale?: string[];
}

type TaskType = "model_simulation" | "counterfactual" | "error_detection";

export interface MultipleChoiceQuestion extends Question {
  choices?: Array<{
    id: string;
    text: string;
    value: string;
    isCorrectAnswer?: boolean; // only for multipleChoice questions that can be correct or incorrect: whether the answer is correct
  }>; // only for multipleChoice questions
}

export interface ScenarioQuestion extends MultipleChoiceQuestion {
  task: TaskType;
}

export interface NumberQuestion extends Question {
  min: number;
  max: number;
}

export interface LikertGridQuestion extends Question {
  statements: string[]; // for likertGrid questions: statements (eg "Strongly agree", "Agree", "Neutral", "Disagree", "Strongly disagree")
  scale: string[]; // for likertGrid questions: scale (eg "1", "2", "3", "4", "5")
}

export interface TextInputQuestion extends Question {
  placeholder: string; // for textInput questions: placeholder text (eg "Enter your birth year")
}

export type ScenarioType = "add" | "lms" | "app";
export interface Scenario {
  id: string;
  type: ScenarioType;
  ratings: number[][]; // 5x10 matrix: 5 users, 10 restaurants
  previous_visits: number[]; // index of each restaurant visited in the past, in order, calulcated depending on the strategy (top 3 descending)
  questions: ScenarioQuestion[]; // if no questions are provided, then this is a training scenario
}
