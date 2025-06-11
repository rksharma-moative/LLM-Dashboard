// AI Service for data analysis
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

class AIService {
    constructor(apiKey = null) {
        this.apiKey = apiKey || localStorage.getItem('googleAIApiKey');
        if (this.apiKey) {
            this.genAI = new GoogleGenerativeAI(this.apiKey);
            this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        }
        this.lastRequestTime = 0;
        this.minRequestInterval = 1000; // Minimum 1 second between requests
    }

    setApiKey(apiKey) {
        this.apiKey = apiKey;
        localStorage.setItem('googleAIApiKey', apiKey);
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    }

    hasValidApiKey() {
        return !!this.apiKey;
    }

    async testApiKey() {
        if (!this.hasValidApiKey()) {
            throw new Error('No API key configured');
        }

        try {
            const result = await this.model.generateContent("Hello, test message");
            const response = await result.response;
            return { success: true, message: 'API key is working correctly!' };
        } catch (error) {
            console.error('API test error:', error);
            throw new Error('API key test failed: ' + error.message);
        }
    }

    async waitForRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.minRequestInterval) {
            await new Promise(resolve => setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest));
        }
        this.lastRequestTime = Date.now();
    }

    // New method to analyze CSV structure and data types
    async analyzeCSVStructure(data) {
        if (!this.hasValidApiKey()) {
            return { 
                analysis: "Please configure your Google AI API key to use AI-powered analysis.", 
                success: false, 
                error: "No API key configured" 
            };
        }

        try {
            await this.waitForRateLimit();
            
            if (!data || data.length === 0) {
                return { analysis: "No data provided", success: false };
            }

            const columns = Object.keys(data[0]);
            const sampleData = data.slice(0, 10);
            
            // Analyze data types and patterns
            const columnAnalysis = {};
            columns.forEach(col => {
                const values = sampleData.map(row => row[col]).filter(val => val && val.toString().trim());
                const numericValues = values.filter(val => !isNaN(parseFloat(val)));
                const uniqueValues = [...new Set(values)];
                
                columnAnalysis[col] = {
                    type: numericValues.length > values.length * 0.7 ? 'numeric' : 
                          uniqueValues.length < values.length * 0.5 ? 'categorical' : 'text',
                    uniqueCount: uniqueValues.length,
                    sampleValues: uniqueValues.slice(0, 5),
                    hasNulls: sampleData.some(row => !row[col] || row[col].toString().trim() === '')
                };
            });

            const prompt = `
            Analyze this CSV dataset structure:
            
            Total Rows: ${data.length}
            Columns: ${columns.length}
            
            Column Analysis:
            ${Object.entries(columnAnalysis).map(([col, info]) => 
                `- ${col}: ${info.type} (${info.uniqueCount} unique values, samples: ${info.sampleValues.join(', ')})`
            ).join('\n')}
            
            Sample Data (first 3 rows):
            ${JSON.stringify(sampleData.slice(0, 3), null, 2)}
            
            Provide a comprehensive analysis including:
            1. Dataset overview and main characteristics
            2. Key columns and their significance
            3. Data quality assessment
            4. Potential relationships between columns
            5. Most interesting aspects for analysis
            
            Format as structured text, not JSON.`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            
            return {
                analysis: response.text(),
                columnAnalysis: columnAnalysis,
                totalRows: data.length,
                totalColumns: columns.length,
                columns: columns,
                success: true
            };
        } catch (error) {
            console.error('CSV Structure Analysis Error:', error);
            return {
                analysis: "Could not analyze CSV structure. Please try again.",
                success: false,
                error: error.message
            };
        }
    }

    async generateSuggestions(data) {
        if (!this.hasValidApiKey()) {
            return { 
                suggestions: ["Please configure your Google AI API key to get AI-powered suggestions"], 
                success: false, 
                error: "No API key configured" 
            };
        }

        try {
            await this.waitForRateLimit();
            
            if (!data || data.length === 0) {
                return { suggestions: ["No data available for analysis"], success: false };
            }

            const columns = Object.keys(data[0]);
            const sampleData = data.slice(0, 5);
            
            // Analyze column types for better suggestions
            const numericColumns = [];
            const categoricalColumns = [];
            const dateColumns = [];
            
            columns.forEach(col => {
                const values = sampleData.map(row => row[col]).filter(val => val);
                const numericValues = values.filter(val => !isNaN(parseFloat(val)));
                const uniqueValues = [...new Set(values)];
                
                if (numericValues.length > values.length * 0.7) {
                    numericColumns.push(col);
                } else if (uniqueValues.length < values.length * 0.5) {
                    categoricalColumns.push(col);
                } else if (col.toLowerCase().includes('date') || col.toLowerCase().includes('time')) {
                    dateColumns.push(col);
                }
            });

            const prompt = `
            Based on this CSV dataset, generate 5-7 specific, actionable analysis questions:
            
            Dataset Info:
            - Total rows: ${data.length}
            - Numeric columns: ${numericColumns.join(', ') || 'None'}
            - Categorical columns: ${categoricalColumns.join(', ') || 'None'}
            - Date columns: ${dateColumns.join(', ') || 'None'}
            - All columns: ${columns.join(', ')}
            
            Sample data:
            ${JSON.stringify(sampleData, null, 2)}
            
            Generate questions that:
            1. Focus on meaningful patterns and insights
            2. Use specific column names from the dataset
            3. Are suitable for data visualization
            4. Cover different types of analysis (trends, comparisons, distributions, correlations)
            5. Are relevant to the actual data content
            
            Return ONLY the questions, one per line, without numbering or bullets.
            Make each question specific and actionable.`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            
            const suggestions = response.text()
                .split('\n')
                .filter(q => q.trim())
                .map(q => q.replace(/^\d+\.?\s*/, '').replace(/^[-*]\s*/, '').trim())
                .filter(q => q.length > 10);
            
            return {
                suggestions: suggestions.slice(0, 7),
                success: true
            };
        } catch (error) {
            console.error('Suggestion Generation Error:', error);
            return {
                suggestions: [
                    "Show the distribution of values in the first numeric column",
                    "Compare categories in the dataset",
                    "Find the top 10 records by value",
                    "Analyze trends over time if date data exists",
                    "Show correlation between numeric columns"
                ],
                success: false,
                error: error.message
            };
        }
    }

    // Enhanced method to analyze queries and return structured responses
    async analyzeQueryWithStructure(data, query) {
        if (!this.hasValidApiKey()) {
            return { 
                analysis: "Please configure your Google AI API key to use AI-powered query analysis.", 
                success: false, 
                error: "No API key configured" 
            };
        }

        try {
            await this.waitForRateLimit();
            
            if (!data || data.length === 0) {
                return { analysis: "No data available", success: false };
            }

            const columns = Object.keys(data[0]);
            const sampleData = data.slice(0, 10);
            
            const prompt = `
            You are an expert data analyst. Analyze this user query and provide the BEST possible visualization strategy.
            
            Dataset Information:
            - Columns: ${columns.join(', ')}
            - Total rows: ${data.length}
            - Sample data: ${JSON.stringify(sampleData.slice(0, 3), null, 2)}
            
            User Query: "${query}"
            
            IMPORTANT: Choose the most appropriate chart type and axes that make logical sense for the data and query.
            
            For charts, consider:
            - Bar charts: for comparing categories or groups
            - Line charts: for trends over time or continuous data
            - Pie charts: for parts of a whole (percentages)
            - Scatter plots: for correlations between two numeric variables
            - Area charts: for cumulative data or multiple series
            - Histograms: for data distribution
            
            For axes, think carefully:
            - X-axis should be the independent variable (categories, time, grouping factor)
            - Y-axis should be the dependent variable (values being measured/compared)
            - Use meaningful, descriptive axis labels
            
            Provide a JSON response with this exact structure:
            {
                "queryType": "aggregation|filter|groupby|correlation|trend|distribution|comparison",
                "targetColumns": ["primary_column", "secondary_column"],
                "operation": "sum|avg|count|max|min|group|filter|compare|trend",
                "filterConditions": {},
                "chartType": "bar|line|pie|scatter|histogram|area|table",
                "xAxisLabel": "Descriptive X-axis label",
                "yAxisLabel": "Descriptive Y-axis label", 
                "chartTitle": "Meaningful chart title",
                "expectedResult": "Clear description of what this analysis shows",
                "visualization": {
                    "type": "bar|line|pie|scatter|histogram|area|table",
                    "xAxis": "column_name",
                    "yAxis": "column_name", 
                    "groupBy": "column_name_if_applicable",
                    "reasoning": "Why this chart type and axes were chosen"
                },
                "insights": "Key insights this visualization should reveal"
            }
            
            Return ONLY valid JSON without any markdown formatting or explanations.`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            let responseText = response.text().trim();
            
            // Clean up response
            responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            
            try {
                const structuredResponse = JSON.parse(responseText);
                return {
                    analysis: structuredResponse,
                    success: true
                };
            } catch (parseError) {
                console.warn('Failed to parse structured response, generating fallback');
                return this.generateFallbackQueryAnalysis(query, columns);
            }
        } catch (error) {
            console.error('Query Analysis Error:', error);
            return this.generateFallbackQueryAnalysis(query, Object.keys(data[0] || {}));
        }
    }

    generateFallbackQueryAnalysis(query, columns) {
        const lowerQuery = query.toLowerCase();
        let queryType = 'filter';
        let chartType = 'table';
        let targetColumns = [];
        
        // Simple pattern matching for fallback
        if (lowerQuery.includes('average') || lowerQuery.includes('mean')) {
            queryType = 'aggregation';
            chartType = 'bar';
        } else if (lowerQuery.includes('group') || lowerQuery.includes('by')) {
            queryType = 'groupby';
            chartType = 'bar';
        } else if (lowerQuery.includes('trend') || lowerQuery.includes('over time')) {
            queryType = 'trend';
            chartType = 'line';
        } else if (lowerQuery.includes('distribution')) {
            queryType = 'distribution';
            chartType = 'histogram';
        } else if (lowerQuery.includes('correlation')) {
            queryType = 'correlation';
            chartType = 'scatter';
        }
        
        // Try to identify relevant columns
        columns.forEach(col => {
            if (lowerQuery.includes(col.toLowerCase())) {
                targetColumns.push(col);
            }
        });
        
        if (targetColumns.length === 0) {
            targetColumns = [columns[0]]; // Default to first column
        }
        
        return {
            analysis: {
                queryType: queryType,
                targetColumns: targetColumns,
                operation: queryType === 'aggregation' ? 'avg' : 'filter',
                filterConditions: {},
                chartType: chartType,
                sqlLikeQuery: `SELECT ${targetColumns.join(', ')} FROM data`,
                expectedResult: `Analysis of ${targetColumns.join(' and ')} based on the query`,
                visualization: {
                    type: chartType,
                    xAxis: targetColumns[0],
                    yAxis: targetColumns[1] || targetColumns[0],
                    groupBy: null
                }
            },
            success: true
        };
    }

    async analyzeData(data, query) {
        if (!this.hasValidApiKey()) {
            return {
                analysis: "Please configure your Google AI API key to use AI-powered analysis.",
                success: false,
                error: "No API key configured"
            };
        }

        try {
            await this.waitForRateLimit();
            const dataContext = JSON.stringify(data.slice(0, 50)); // Reduced to 50 rows for free API
            const prompt = `
            Analyze this CSV data and answer: "${query}"
            Data (first 50 rows): ${dataContext}
            
            Provide:
            1. Direct answer
            2. Key insights
            3. Relevant statistics
            4. Visualization recommendation`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return {
                analysis: response.text(),
                success: true
            };
        } catch (error) {
            console.error('AI Analysis Error:', error);
            return {
                analysis: "Sorry, I couldn't analyze the data. Please try again in a moment.",
                success: false,
                error: error.message
            };
        }
    }

    async getKPIs(data) {
        if (!this.hasValidApiKey()) {
            // Generate fallback KPIs without API
            const columns = Object.keys(data[0] || {});
            const fallbackKPIs = this.generateFallbackKPIs(data, columns);
            return {
                kpis: fallbackKPIs,
                success: true,
                fallback: true
            };
        }

        try {
            await this.waitForRateLimit();
            const columns = Object.keys(data[0] || {});
            const prompt = `
            For data with columns: ${columns.join(', ')}
            Calculate 3 key metrics that would be most relevant.
            For each metric provide:
            1. Name
            2. Value
            3. Brief insight
            Return ONLY a valid JSON array without any markdown formatting or code blocks.
            Example format: [{"name": "Total Records", "value": "1000", "insight": "Large dataset"}]`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            let responseText = response.text();
            
            // Clean up the response - remove markdown code blocks if present
            responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            
            try {
                const kpis = JSON.parse(responseText);
                return {
                    kpis: Array.isArray(kpis) ? kpis : [],
                    success: true
                };
            } catch (parseError) {
                console.warn('Failed to parse KPI JSON, generating fallback KPIs');
                // Generate fallback KPIs based on data
                const fallbackKPIs = this.generateFallbackKPIs(data, columns);
                return {
                    kpis: fallbackKPIs,
                    success: true
                };
            }
        } catch (error) {
            console.error('KPI Generation Error:', error);
            // Generate fallback KPIs
            const columns = Object.keys(data[0] || {});
            const fallbackKPIs = this.generateFallbackKPIs(data, columns);
            return {
                kpis: fallbackKPIs,
                success: false,
                error: error.message
            };
        }
    }

    generateFallbackKPIs(data, columns) {
        const kpis = [];
        
        // Total records
        kpis.push({
            name: 'Total Records',
            value: data.length.toLocaleString(),
            insight: 'Total number of data points in the dataset'
        });
        
        // Number of columns
        kpis.push({
            name: 'Data Dimensions',
            value: columns.length,
            insight: 'Number of data attributes available for analysis'
        });
        
        // Find numeric columns for additional KPIs
        const numericColumns = columns.filter(col => {
            const values = data.slice(0, 100).map(row => parseFloat(row[col])).filter(val => !isNaN(val));
            return values.length > data.slice(0, 100).length * 0.5;
        });
        
        if (numericColumns.length > 0) {
            const firstNumericCol = numericColumns[0];
            const values = data.map(row => parseFloat(row[firstNumericCol])).filter(val => !isNaN(val));
            
            if (values.length > 0) {
                const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
                kpis.push({
                    name: `Avg ${firstNumericCol}`,
                    value: avg.toFixed(2),
                    insight: `Average value across all records`
                });
            }
        }
        
        return kpis;
    }

    // Enhanced method to generate AI summary of query results
    async generateResultSummary(summaryPrompt) {
        if (!this.hasValidApiKey()) {
            return "Analysis completed successfully. Review the chart and data for insights.";
        }

        try {
            await this.waitForRateLimit();
            
            const enhancedPrompt = `
            You are a senior data analyst providing insights to business stakeholders. 
            
            ${summaryPrompt}
            
            IMPORTANT REQUIREMENTS:
            - Write exactly 150-200 words
            - Use clear, professional business language
            - Focus on actionable insights and practical implications
            - Avoid technical jargon and statistical terms
            - Structure as: Key Finding → Business Impact → Recommendation
            - Be specific about numbers and trends when relevant
            - End with a clear next step or recommendation
            
            Format your response as a cohesive paragraph that flows naturally.
            Do not use bullet points or numbered lists.
            Make it compelling and valuable for decision-makers.`;
            
            const result = await this.model.generateContent(enhancedPrompt);
            const response = await result.response;
            
            let summary = response.text().trim();
            
            // Ensure the summary is within word count (roughly 150-200 words)
            const words = summary.split(/\s+/);
            if (words.length > 220) {
                summary = words.slice(0, 200).join(' ') + '...';
            } else if (words.length < 100) {
                // If too short, request a more detailed summary
                const expandedPrompt = `
                Expand this analysis into a more detailed business summary (150-200 words):
                
                ${summary}
                
                Add more context about:
                - What this means for the business
                - Potential opportunities or risks
                - Specific recommendations for action
                - Broader implications for strategy
                
                Keep it professional and actionable.`;
                
                try {
                    await this.waitForRateLimit();
                    const expandedResult = await this.model.generateContent(expandedPrompt);
                    const expandedResponse = await expandedResult.response;
                    summary = expandedResponse.text().trim();
                } catch (expandError) {
                    console.warn('Failed to expand summary:', expandError);
                    // Keep original summary if expansion fails
                }
            }
            
            return summary;
        } catch (error) {
            console.error('Result Summary Generation Error:', error);
            return "Analysis completed successfully. The data reveals important patterns that can inform business decisions. Review the chart and table views for detailed findings and consider exploring related questions to gain deeper insights into your data.";
        }
    }
}

// Export the AIService class
export default AIService;
