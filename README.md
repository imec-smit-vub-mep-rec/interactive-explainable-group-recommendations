# Interactive Group Recommender with Explanations

A research application for studying interactive group recommendation systems with various explanation strategies. This project allows users to explore different aggregation strategies for group decision-making and compare multiple explanation approaches to understand how recommendations are generated.

## 🎯 Overview

This application simulates a group restaurant recommendation scenario where 5 people (Darcy, Alex, Jess, Jackie, and Freddy) rate restaurants on a 1-5 scale. The system then uses different aggregation strategies to recommend the best restaurant for the group, with various explanation methods to help users understand the decision-making process.

## 🚀 Features

### Aggregation Strategies
- **LMS (Least Misery Strategy)**: Minimizes the lowest rating among group members
- **ADD (Additive Strategy)**: Maximizes the total rating sum across all group members
- **APP (Approval Voting Strategy)**: Maximizes the number of ratings above 3

### Explanation Strategies
- **No Explanation**: Simple recommendation without explanation
- **Text Explanation**: Detailed textual explanation of the recommendation
- **Chat Explanation**: Interactive AI-powered chat to answer questions about recommendations
- **Graph Explanation**: Interactive sliders and visual graphs showing rating impacts
- **Pie Chart Explanation**: Pie charts visualizing contribution patterns
- **Heatmap Explanation**: Color-coded heatmap of ratings and scores
- **Ordered List Explanation**: Ranked list with detailed breakdowns

### Interactive Features
- **Real-time Rating Updates**: Modify ratings and see immediate impact on recommendations
- **Scenario Management**: Switch between different pre-defined scenarios
- **Sorting Options**: Sort restaurants from best to worst
- **Visual Fading**: Fade non-contributing elements for better focus
- **Reset Functionality**: Reset ratings to initial values

## 🛠️ Technology Stack

- **Frontend**: Next.js 15.5.3 with React 19.1.0
- **Styling**: Tailwind CSS 4
- **UI Components**: Radix UI primitives
- **Data Visualization**: D3.js 7.9.0
- **AI Integration**: AI SDK with Cerebras and Google models
- **Type Safety**: TypeScript 5
- **Package Manager**: pnpm

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd interactive-group-explanations
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_CEREBRAS_MODEL=your_cerebras_model_id
   ```

4. **Run the development server**
   ```bash
   pnpm dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🎮 Usage

### Basic Workflow
1. **Select Strategy**: Choose an aggregation strategy (LMS, ADD, or APP) from the settings panel
2. **Choose Explanation**: Select your preferred explanation method
3. **Interact with Ratings**: Modify individual ratings in the table to see real-time updates
4. **Explore Explanations**: Use the explanation panel to understand how recommendations are generated
5. **Ask Questions**: In chat mode, ask the AI about the recommendations or simulate changes

### Settings Panel
Access the settings panel by clicking the gear icon in the top-left corner:
- **Aggregation Strategy**: Switch between LMS, ADD, and APP
- **Explanation Strategy**: Choose from 7 different explanation methods
- **Sort Best to Worst**: Enable/disable restaurant sorting
- **Fade Non-Contributing**: Highlight only relevant elements
- **Scenario Selection**: Pick from pre-defined scenarios or get random ones

### URL Parameters
You can link directly to specific scenarios using URL parameters:
```
http://localhost:3000?scenario=add1
```

## 📊 Data Structure

### Scenarios
The application includes numerous pre-defined scenarios optimized for different strategies:
- **Additive scenarios**: Designed to showcase ADD strategy benefits
- **LMS scenarios**: Optimized for Least Misery Strategy
- **Approval Voting scenarios**: Tailored for APP strategy

Each scenario includes:
- 5 group members with distinct preferences
- 10 restaurants (some previously visited)
- Pre-defined rating matrices
- Visit history and ordering

### Rating System
- **Scale**: 1-5 (1 = strongly dislike, 5 = strongly like)
- **Matrix**: 5 people × 10 restaurants
- **Constraints**: Previously visited restaurants cannot be re-rated

## 🔬 Research Applications

This application is designed for research in:
- **Group Decision Making**: Understanding how different aggregation strategies affect outcomes
- **Explanation Interfaces**: Comparing effectiveness of various explanation methods
- **User Experience**: Studying how different visualizations impact user understanding
- **Interactive Systems**: Exploring real-time feedback and user interaction patterns

## 🏗️ Project Structure

```
src/
├── app/                    # Next.js app router
│   ├── api/chat/          # AI chat API endpoint
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main application page
├── components/            # React components
│   ├── ai-elements/       # AI chat UI components
│   ├── ui/               # Reusable UI components
│   └── [explanation-components].tsx  # Explanation strategies
└── lib/                  # Utilities and data
    ├── scenarios.ts      # Scenario management
    ├── strategy_scenarios.ts  # Pre-defined scenarios
    └── utils.ts          # Helper functions
```

## 🧪 Development

### Available Scripts
- `pnpm dev`: Start development server with Turbopack
- `pnpm build`: Build for production with Turbopack
- `pnpm start`: Start production server
- `pnpm lint`: Run ESLint

### Key Components
- **InteractiveGroupRecommender**: Main application component
- **SettingsSidebar**: Configuration panel
- **Explanation Components**: Various visualization strategies
- **AI Chat Integration**: Real-time conversational explanations

## 🤝 Contributing

This is a research project. For contributions:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is part of academic research. Please cite appropriately if used in research.

## 🔗 Related Work

This application supports research in:
- Interactive Group Recommender Systems
- Explanation Interfaces for AI Systems
- User Experience in Decision Support Tools
- Comparative Studies of Aggregation Strategies

---

*Built for research in interactive group recommendation systems and explanation interfaces.*
