# AI-Powered CSV Data Dashboard

A smart, user-friendly web application that allows you to upload CSV files and ask questions about your data in natural language. Perfect for non-technical users who want to analyze their data quickly and intelligently.

## 🚀 Features

- **Easy CSV Upload**: Drag and drop or browse to upload your CSV files
- **AI-Powered Analysis**: Ask questions in plain English and get intelligent insights
- **Smart Visualizations**: Automatic chart generation based on your queries
- **Interactive Dashboard**: Multiple view modes (charts, tables, summaries)
- **Sample Data**: Try the app immediately with built-in sample data
- **No Coding Required**: Designed for users of all technical levels

## 🛠️ Quick Setup

### Prerequisites
- Node.js (version 14 or higher)
- A Google AI API key (free to obtain)

### Installation

1. **Clone or download this repository**
2. **Open terminal/command prompt in the project folder**
3. **Install dependencies:**
   ```bash
   npm install
   ```
4. **Start the application:**
   ```bash
   npm start
   ```
5. **Open your browser and go to:** `http://localhost:8080`

## 🔑 Getting Your Google AI API Key

The application uses Google's Gemini AI for intelligent data analysis. To get your free API key:

1. Visit [Google AI Studio](https://ai.google.dev/tutorials/setup)
2. Sign in with your Google account
3. Click "Get API Key" and create a new key
4. Copy the key and paste it in the app's API configuration section

**Note:** Your API key is stored securely in your browser and never sent to our servers.

## 📊 How to Use

### Step 1: Configure API Key
- Enter your Google AI API key in the configuration section
- Click "Save Key" and optionally test it

### Step 2: Upload Data
- Upload your CSV file by dragging and dropping, or
- Try the sample employee data to get started immediately

### Step 3: Ask Questions
- Use natural language to ask about your data
- Examples:
  - "What is the average salary?"
  - "Show me the top 10 performers"
  - "Group employees by department"
  - "Show correlation between age and salary"

### Step 4: Explore Results
- View results as charts, tables, or summaries
- Export filtered data as CSV
- Browse through your query history

## 💡 Example Queries

The app understands various types of questions:

**Aggregations:**
- "What is the average salary?"
- "What's the total revenue?"
- "How many records are there?"

**Filtering & Sorting:**
- "Show top 10 by salary"
- "Find employees with salary > 70000"
- "Show the lowest performing departments"

**Grouping & Analysis:**
- "Group by department"
- "Average salary by department"
- "Count employees by age group"

**Correlations:**
- "Show correlation between age and salary"
- "Compare performance scores across departments"

**Distributions:**
- "Show salary distribution"
- "Display age ranges"

## 🎯 Perfect For

- **Business Analysts** analyzing sales, customer, or operational data
- **HR Professionals** reviewing employee data and performance metrics
- **Students & Researchers** exploring datasets for projects
- **Small Business Owners** understanding their business metrics
- **Anyone** who has data in Excel/CSV and wants quick insights

## 🔧 Troubleshooting

**App won't start?**
- Make sure Node.js is installed
- Run `npm install` to install dependencies
- Check that port 8080 is available

**AI features not working?**
- Verify your Google AI API key is correct
- Use the "Test API" button to check connectivity
- Check your internet connection

**CSV upload issues?**
- Ensure your file has headers in the first row
- Check that the file is properly formatted CSV
- Try the sample data first to test functionality

## 🌟 Key Benefits

- **No Technical Skills Required**: Just ask questions in plain English
- **Instant Insights**: Get answers and visualizations immediately
- **Smart Suggestions**: AI-powered recommendations for data exploration
- **Multiple View Modes**: See your data as charts, tables, or summaries
- **Export Capabilities**: Save filtered results back to CSV
- **Secure**: All processing happens in your browser

## 📈 Supported Data Types

- Numerical data (salaries, scores, quantities, etc.)
- Categorical data (departments, regions, status, etc.)
- Date/time data (timestamps, dates)
- Text data (names, descriptions, etc.)

## 🤝 Support

If you encounter any issues or have questions:

1. Check the troubleshooting section above
2. Try the sample data to verify the app is working
3. Ensure your CSV file is properly formatted
4. Verify your API key is correctly configured

---

**Ready to explore your data?** Start the application and upload your first CSV file! 