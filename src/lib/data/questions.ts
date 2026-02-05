import {
  Question,
  MultipleChoiceQuestion,
  NumberQuestion,
  LikertGridQuestion,
  TextInputQuestion,
} from '@/lib/types';

export interface QuestionSection {
  id: string;
  title: string;
  intro: string;
  questions: Question[];
}

export const questions: Record<string, QuestionSection> = {
  onboarding: {
    id: "onboarding_demographics",
    title: "About You",
    intro: "Please provide some basic information about yourself. This information is only used to report on the representativeness of the sample.",
    questions: [
      {
        id: "onboarding_demographics_1_birth_year",
        type: "searchableSelect",
        text: "What is your birth year?",
        required: true,
        isAttentionCheck: false,
        placeholder: "Type or select your birth year...",
        choices: [
          ...Array.from({ length: 2008 - 1900 + 1 }, (_, i) => {
            const year = (2008 - i).toString();
            return { id: `year_${year}`, text: year, value: year };
          }),
        ],
      } as MultipleChoiceQuestion,
      {
        id: "onboarding_demographics_2_gender",
        type: "multipleChoice",
        text: "How do you identify yourself?",
        required: true,
        isAttentionCheck: false,
        choices: [
          {
            id: "male",
            text: "Male",
            value: "male",
          },
          {
            id: "female",
            text: "Female",
            value: "female",
          },
          {
            id: "other",
            text: "Other",
            value: "other",
          },
          {
            id: "prefer_not_to_say",
            text: "Prefer not to say",
            value: "prefer_not_to_say",
          },
        ],
      } as MultipleChoiceQuestion,
    ],
  },
  training: {
    id: "training_tasks",
    title: "Training Tasks",
    intro: "The following tasks are to make you familiar with the system and the task.",
    questions: [
      {
        id: "training_tasks_1",
        type: "multipleChoice",
        text: "Which restaurant would you think is best for the group's next dinner, given the preferences in the table?",
        required: false,
        isAttentionCheck: false,
        choices: [],
      } as MultipleChoiceQuestion,
      {
        id: "attn_check_1",
        type: "multipleChoice",
        text: "This is an attention check. Please indicate restaurant 4",
        required: true,
        isAttentionCheck: true,
        choices: [
          { id: "attn1_r1", text: "Restaurant 1", value: "1" },
          { id: "attn1_r2", text: "Restaurant 2", value: "2" },
          { id: "attn1_r3", text: "Restaurant 3", value: "3" },
          { id: "attn1_r4", text: "Restaurant 4", value: "4", isCorrectAnswer: true },
          { id: "attn1_r5", text: "Restaurant 5", value: "5" },
          { id: "attn1_r6", text: "Restaurant 6", value: "6" },
          { id: "attn1_r7", text: "Restaurant 7", value: "7" },
          { id: "attn1_r8", text: "Restaurant 8", value: "8" },
          { id: "attn1_r9", text: "Restaurant 9", value: "9" },
          { id: "attn1_r10", text: "Restaurant 10", value: "10" },
        ],
      } as MultipleChoiceQuestion,
    ],
  },
  preliminary_subjective_understanding: {
    id: "preliminary_subjective_understanding",
    title: "Preliminary Subjective Understanding",
    intro: "Please answer the following questions to assess your understanding of the system.",
    questions: [
      {
        id: "preliminary_subjective_understanding_1_understand",
        type: "likertGrid",
        text: "I understand how the model works to predict the best recommendation for the group.",
        required: false,
        isAttentionCheck: false,
        statements: ["I understand how the model works to predict the best recommendation for the group."],
        scale: ["1", "2", "3", "4", "5"],
      } as LikertGridQuestion,
      {
        id: "preliminary_subjective_understanding_2_predict",
        type: "likertGrid",
        text: "I can predict how the model will behave.",
        required: false,
        isAttentionCheck: false,
        statements: ["I can predict how the model will behave."],
        scale: ["1", "2", "3", "4", "5"],
      } as LikertGridQuestion,
    ],
  },
  repeat_subjective_understanding: {
    id: "repeat_subjective_understanding",
    title: "Repeat Subjective Understanding",
    intro: "Please answer the following questions to assess your understanding of the system.",
    questions: [
      {
        id: "repeat_subjective_understanding_1_understand",
        type: "likertGrid",
        text: "I understand how the model works to predict the best recommendation for the group.",
        required: false,
        isAttentionCheck: false,
        statements: ["I understand how the model works to predict the best recommendation for the group."],
        scale: ["1", "2", "3", "4", "5"],
      } as LikertGridQuestion,
      {
        id: "repeat_subjective_understanding_2_predict",
        type: "likertGrid",
        text: "I can predict how the model will behave.",
        required: false,
        isAttentionCheck: false,
        statements: ["I can predict how the model will behave."],
        scale: ["1", "2", "3", "4", "5"],
      } as LikertGridQuestion,
    ],
  },
  textual_debriefing: {
    id: "textual_debriefing",
    title: "Textual Debriefing",
    intro: "Please provide a textual explanation of how the system made the recommendation for the group.",
    questions: [
      {
        id: "textual_debriefing_explanation",
        type: "textInput",
        text: "Please provide a textual explanation of how the system made the recommendation for the group.",
        required: false,
        isAttentionCheck: false,
        placeholder: "",
      } as TextInputQuestion,
    ],
  },
  nasa_tlx: {
    id: "nasa_tlx",
    title: "NASA-TLX",
    intro: "Please answer the following questions to assess your cognitive load.",
    questions: [
      {
        id: "nasa_tlx_1_mental_demand",
        type: "likertGrid",
        text: "How mental demanding was the task?",
        required: false,
        isAttentionCheck: false,
        statements: ["Very Low", "Very High"],
        scale: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20"],
      } as LikertGridQuestion,
      {
        id: "nasa_tlx_2_physical_demand",
        type: "likertGrid",
        text: "How physically demanding was the task?",
        required: false,
        isAttentionCheck: false,
        statements: ["Very Low", "Very High"],
        scale: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20"],
      } as LikertGridQuestion,
      {
        id: "nasa_tlx_3_temporal_demand",
        type: "likertGrid",
        text: "How hurried or rushed was the pace of the task?",
        required: false,
        isAttentionCheck: false,
        statements: ["Very Low", "Very High"],
        scale: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20"],
      } as LikertGridQuestion,
      {
        id: "nasa_tlx_4_performance",
        type: "likertGrid",
        text: "How successful were you in accomplishing what you were asked to do?",
        required: false,
        isAttentionCheck: false,
        statements: ["Perfect", "Failure"],
        scale: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20"],
      } as LikertGridQuestion,
      {
        id: "nasa_tlx_5_effort",
        type: "likertGrid",
        text: "How hard did you have to work to accomplish your level of performance?",
        required: false,
        isAttentionCheck: false,
        statements: ["Very Low", "Very High"],
        scale: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20"],
      } as LikertGridQuestion,
      {
        id: "nasa_tlx_6_frustration",
        type: "likertGrid",
        text: "How insecure, discourage, irritated, stressed and annoyed were you?",
        required: false,
        isAttentionCheck: false,
        statements: ["Very Low", "Very High"],
        scale: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20"],
      } as LikertGridQuestion,
    ],
  },
  additional_feedback: {
    id: "additional_feedback",
    title: "Additional Feedback",
    intro: "Please provide any additional feedback you have about the experiment.",
    questions: [
      {
        id: "additional_feedback_text",
        type: "textInput",
        text: "Please provide any additional feedback you have about the experiment.",
        required: false,
        isAttentionCheck: false,
        placeholder: "",
      } as TextInputQuestion,
    ],
  },
  objective_attention_checks: {
    id: "objective_attention_checks",
    title: "Attention Checks",
    intro: "",
    questions: [
      {
        id: "attn_check_2",
        type: "multipleChoice",
        text: "This is an attention check. Please indicate restaurant 3",
        required: true,
        isAttentionCheck: true,
        choices: [
          { id: "attn2_r1", text: "Restaurant 1", value: "1" },
          { id: "attn2_r2", text: "Restaurant 2", value: "2" },
          { id: "attn2_r3", text: "Restaurant 3", value: "3", isCorrectAnswer: true },
          { id: "attn2_r4", text: "Restaurant 4", value: "4" },
          { id: "attn2_r5", text: "Restaurant 5", value: "5" },
          { id: "attn2_r6", text: "Restaurant 6", value: "6" },
          { id: "attn2_r7", text: "Restaurant 7", value: "7" },
          { id: "attn2_r8", text: "Restaurant 8", value: "8" },
          { id: "attn2_r9", text: "Restaurant 9", value: "9" },
          { id: "attn2_r10", text: "Restaurant 10", value: "10" },
        ],
      } as MultipleChoiceQuestion,
    ],
  },
};
