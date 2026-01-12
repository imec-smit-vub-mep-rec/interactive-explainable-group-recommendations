explanation_modalities = ["no_expl", "static_list", "interactive_list", "conversational"]
aggregation_strategies = ["lms", "add", "app"]
tasks = ["model_simulation", "counterfactual", "error_detection"]
evaluation = ["subjective_understanding", "objective_understanding"]

1. Welcome screen with
- Link to informed consent PDF (public/informed_consent.pdf)
- Checkbox "I have read and understood the informed consent"
- "Start experiment button"

2. Onboarding
- (behind the screens: start session, random assignment to aggregation_strategy and explanation_modality; track all user interactions and start- and end-times on each screen)
- Demographics onboarding

3. Training phase: Show six training tasks from the six question-less scenarios of the session aggregation strategy out of data/scenarios.ts list in random order: "The following tasks are to make you familiar with the system and the task."
Each participant is presented with a series of six scenarios (selected from question-less scenarios in data/scenarios.ts list in random order) consisting of one hypothetical group recommendation and configured on their assigned aggregation strategy and explanation type.

- 3.1 Show table only: "Which restaurant would you think is best for the group’s next dinner, given the preferences in the table?"
User indicates via: <radio group: unvisited restaurants>

- 3.2 Show <explanation_modality> and instructions (nextstepsjs tour):
Using the provided ratings, the software system made a recommendation to the group. <If not static, also say: "Edit a few ratings to see how the recommendation changes.">

- 3.3 Reset to initial scores
"Given the advice of the recommender system, what is your final decision for the best restaurant to go to."
User indicates via: <radio group: unvisited restaurant>

4.  Preliminary subjective understanding (7-point likert):
- "I understand how the model works to predict the best recommendation for the group."
- "I can predict how the model will behave."

5. Test user objective understanding: "You will now be tested on your understanding of the system. You will get six scenarions, each with a question. Please answer them correctly."
- 5.1 Show 6 (2x3) different scenarios from data/scenarios.ts
- 5.2 Ask 2 questions about each scenario, randomly picking from the associated tasks, but making sure each of the 3 task types has been shown exactly 2 times. A second attention check is presented on the page of the first counterfactual scenario.
- 5.3 Behind the scenes: Register the response and if it's correct or not.

6. Repeat subjective understanding (7-point likert):
- "I understand how the model works to predict the best recommendation for the group."
- "I can predict how the model will behave."

7. Textual debriefing: "In your own words, provide a textual explanation to present to the group members, explaining how the system made the recommendation for the group." -> Free text input (required)
-> This is the final task: the participant is presented with the first training scenario, and asked to provide an explanation for the group, in their own words, on how the system derived a group recommendation.

8. Cognitive load: Likert NASA-TLX

9. Any additional feedback? -> Free text input (optional)

10. End of experiment: Thank you screen, return to Prolific if applicable.


Data schema:
```sql
-- session tracking
id VARCHAR(255) PRIMARY KEY, -- unique session id
prolific_pid VARCHAR(48), -- prolific participant id, if not set on completion, it's a self-recruited participant and thank you screen is shown, otherwise redirect to Prolific completion from thank you screen
start_time TIMESTAMP -- start time of the session
end_time TIMESTAMP -- end time of the session
prolific_study_id VARCHAR(48), -- check if study id corresponds with our id
prolific_session_id VARCHAR(48) -- prolific session id
reference VARCHAR(255) -- optional string from query parameter
is_completed BOOLEAN DEFAULT FALSE -- whether the session has been completed

-- experiment configuration for specific session
explanation_modality ENUM('no_expl', 'static_list', 'interactive_list', 'conversational') -- one of four modalities semi-randomly assigned to each session
aggregation_strategy ENUM('lms', 'add', 'app') -- one of three strategies semi-randomly assigned to each session

-- onboarding data
onboarding_demographics_1_birth_year INTEGER -- birth year of participant
onboarding_demographics_2_gender ENUM('male', 'female', 'other') -- gender of participant

training_tasks_data JSONB -- json object with array containing tasks and answers (attention check included in fourth training task)

preliminary_subjective_understanding_1_understand INTEGER
preliminary_subjective_understanding_2_predict INTEGER

objective_understanding_tasks_data JSONB -- json object with array containing semi-randomly picked scenarios with tasks and the user's answers

repeat_subjective_understanding_1_understand INTEGER
repeat_subjective_understanding_2_predict INTEGER

textual_debriefing TEXT -- textual debriefing of participant
additional_feedback TEXT -- additional feedback of participant

-- raw session backup, including all interaction data and time on each screen
raw_session_data JSONB NOT NULL DEFAULT '{}' -- raw session data with all user interactions
```

* How to sample tasks from training_tasks.json for training step?
- Always same training tasks: but random order
* How to sample scenarios and tasks for test_objective_understanding_data?
- Select 2 scenarios with questions for each task type (model_simulation, counterfactual, error_detection) from data/scenarios.ts in random order

* Scenarios: same scenarios as previous experiment? For now, we'll be using the same.

# Setup
DATABASE_URL='postgresql://neondb_owner:... present in .env