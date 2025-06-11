// AI Service for data analysis with optimized loading
let GoogleGenerativeAI;
let SDKLoadPromise = null;
let SDKLoadStartTime = Date.now();

// Create a singleton promise for SDK loading with timeout and caching
function loadGoogleAISDK() {
    if (SDKLoadPromise) {
        return SDKLoadPromise;
    }
    
    SDKLoadPromise = new Promise(async (resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('SDK loading timeout after 10 seconds'));
        }, 10000);

        try {
            console.log('🚀 Loading Google AI SDK...');
            
            // Try multiple CDN sources for faster loading
            const sources = [
                "https://esm.run/@google/generative-ai",
                "https://cdn.skypack.dev/@google/generative-ai",
                "https://unpkg.com/@google/generative-ai?module"
            ];
            
            let lastError;
            for (const source of sources) {
                try {
                    const module = await import(source);
                    GoogleGenerativeAI = module.GoogleGenerativeAI;
                    clearTimeout(timeout);
                    const loadTime = Date.now() - SDKLoadStartTime;
                    console.log(`✅ Google AI SDK loaded successfully in ${loadTime}ms from ${source}`);
                    resolve(GoogleGenerativeAI);
                    return;
                } catch (error) {
                    console.warn(`Failed to load from ${source}:`, error.message);
                    lastError = error;
                    continue;
                }
            }
            
            throw lastError || new Error('All SDK sources failed');
        } catch (error) {
            clearTimeout(timeout);
            console.error('❌ Failed to load Google AI SDK:', error);
            reject(error);
        }
    });
    
    return SDKLoadPromise;
}

// Start loading immediately but don't block
loadGoogleAISDK().catch(() => {
    // Silent fail - will be handled by individual components
});

class AIService {
    constructor(apiKey = null) {
        this.apiKey = apiKey || localStorage.getItem('googleAIApiKey');
        this.genAI = null;
        this.model = null;
        this.isInitialized = false;
        this.initializationPromise = null;
        
        this.lastRequestTime = 0;
        this.minRequestInterval = 1500;
        this.requestQueue = [];
        this.isProcessingQueue = false;
        this.cache = new Map();
        this.maxCacheSize = 100;
        
        // Start async initialization immediately
        this.initialize();
    }

    async initialize() {
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = (async () => {
            try {
                console.log('🔧 Initializing AI Service...');
                
                // Wait for SDK to load with timeout
                await Promise.race([
                    loadGoogleAISDK(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Initialization timeout')), 8000)
                    )
                ]);

                // Initialize with API key if available
                if (this.apiKey && GoogleGenerativeAI) {
                    this.genAI = new GoogleGenerativeAI(this.apiKey);
                    this.model = this.genAI.getGenerativeModel({ 
                        model: "gemini-1.5-flash",
                        generationConfig: {
                            temperature: 0.7,
                            topK: 40,
                            topP: 0.95,
                            maxOutputTokens: 2048,
                        }
                    });
                    console.log('✅ AI Service initialized with API key');
                } else {
                    console.log('⚠️ AI Service initialized without API key');
                }
                
                this.isInitialized = true;
                return true;
            } catch (error) {
                console.error('❌ AI Service initialization failed:', error);
                this.isInitialized = false;
                throw error;
            }
        })();

        return this.initializationPromise;
    }

    async ensureInitialized() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        return this.isInitialized;
    }

    async setApiKey(apiKey) {
        this.apiKey = apiKey;
        localStorage.setItem('googleAIApiKey', apiKey);
        
        try {
            // Ensure SDK is loaded
            await this.ensureInitialized();
            
            if (GoogleGenerativeAI) {
                this.genAI = new GoogleGenerativeAI(apiKey);
                this.model = this.genAI.getGenerativeModel({ 
                    model: "gemini-1.5-flash",
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 2048,
                    }
                });
                console.log('✅ API key updated successfully');
            } else {
                throw new Error('Google AI SDK not available');
            }
        } catch (error) {
            console.error('Failed to set API key:', error);
            throw error;
        }
    }

    hasValidApiKey() {
        return !!(this.apiKey && this.genAI && this.model && this.isInitialized);
    }

    async isReady() {
        try {
            await this.ensureInitialized();
            return this.hasValidApiKey();
        } catch {
            return false;
        }
    }

    async testApiKey() {
        if (!this.hasValidApiKey()) {
            throw new Error('No valid API key configured or Google AI SDK not loaded');
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



    // Enhanced caching for AI responses
    getCacheKey(operation, data) {
        const dataHash = this.hashData(data);
        return `${operation}_${dataHash}`;
    }

    hashData(data) {
        // Simple hash function for data
        if (typeof data === 'string') {
            return data.substring(0, 100);
        }
        return JSON.stringify(data).substring(0, 100);
    }

    setCache(key, value) {
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }

    getCache(key) {
        return this.cache.get(key);
    }

    // Queue management for API requests
    async queueRequest(requestFunc) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({ requestFunc, resolve, reject });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.isProcessingQueue || this.requestQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        while (this.requestQueue.length > 0) {
            const { requestFunc, resolve, reject } = this.requestQueue.shift();
            
            try {
                await this.waitForRateLimit();
                const result = await requestFunc();
                resolve(result);
            } catch (error) {
                reject(error);
            }
        }

        this.isProcessingQueue = false;
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

        // Check cache first
        const cacheKey = this.getCacheKey('analyzeCSVStructure', data);
        const cached = this.getCache(cacheKey);
        if (cached) {
            console.log('Using cached CSV structure analysis');
            return cached;
        }

        try {
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

            const result = await this.queueRequest(async () => {
                const response = await this.model.generateContent(prompt);
                return await response.response;
            });
            
            const analysisResult = {
                analysis: result.text(),
                columnAnalysis: columnAnalysis,
                totalRows: data.length,
                totalColumns: columns.length,
                columns: columns,
                success: true
            };

            // Cache the result
            this.setCache(cacheKey, analysisResult);
            
            return analysisResult;
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

        // Check cache first
        const cacheKey = this.getCacheKey('generateSuggestions', data);
        const cached = this.getCache(cacheKey);
        if (cached) {
            console.log('Using cached suggestions');
            return cached;
        }

        try {
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
            Based on this CSV dataset, generate 6-8 specific analysis queries that will create EXCELLENT visualizations:
            
            Dataset Info:
            - Total rows: ${data.length}
            - Numeric columns: ${numericColumns.join(', ') || 'None'}
            - Categorical columns: ${categoricalColumns.join(', ') || 'None'}
            - Date columns: ${dateColumns.join(', ') || 'None'}
            - All columns: ${columns.join(', ')}
            
            Sample data (first 3 rows):
            ${JSON.stringify(sampleData.slice(0, 3), null, 2)}
            
            Generate queries that:
            1. Create BEAUTIFUL and MEANINGFUL charts (bar charts, line charts, scatter plots, histograms)
            2. Use SPECIFIC column names from the actual dataset
            3. Focus on comparisons, trends, distributions, and correlations
            4. Are perfect for business insights and decision making
            5. Will generate data that plots well on X and Y axes
            
            PRIORITIZE these types of queries:
            - "Show [categorical column] vs [numeric column]" (great bar charts)
            - "Compare [numeric values] across [categories]" (excellent comparisons)
            - "What is the trend of [numeric column] over [time/sequence]?" (line charts)
            - "Find correlation between [numeric column 1] and [numeric column 2]" (scatter plots)
            - "Show distribution of [numeric column]" (histograms)
            - "Top 10 [items] by [numeric value]" (ranked bar charts)
            
            Return ONLY the questions, one per line, without numbering.
            Make each question crystal clear and visualization-ready.`;

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
            You are an expert data visualization analyst. Analyze this user query and provide the OPTIMAL visualization strategy with SPECIFIC axis recommendations.
            
            Dataset Information:
            - Columns: ${columns.join(', ')}
            - Total rows: ${data.length}
            - Sample data: ${JSON.stringify(sampleData.slice(0, 3), null, 2)}
            
            User Query: "${query}"
            
            CRITICAL VISUALIZATION REQUIREMENTS:
            1. Choose the BEST chart type for maximum insight and visual appeal
            2. Specify EXACTLY what should be on X-axis and Y-axis with proper data values
            3. Determine optimal data grouping, aggregation, and binning
            4. Recommend data ranges and scaling for best visual representation
            5. Suggest meaningful axis labels and chart titles
            
            CHART TYPE GUIDELINES:
            - Bar charts: comparing categories/groups (X=categories, Y=values)
            - Line charts: trends over time/sequence (X=time/sequence, Y=metric)
            - Scatter plots: correlations between two numeric variables (X=variable1, Y=variable2)
            - Pie/Donut charts: parts of a whole (percentages/proportions)
            - Histograms: data distribution (X=value_ranges, Y=frequency/count)
            - Area charts: cumulative trends or multiple series
            
            AXIS OPTIMIZATION:
            - X-axis: independent variable (what you're grouping/measuring by)
            - Y-axis: dependent variable (what you're measuring/counting)
            - Use descriptive, business-friendly labels
            - Consider data ranges and recommend optimal scaling
            - Suggest number of data points for best readability (e.g., top 10, group small categories)
            
            Provide a JSON response with this exact structure:
            {
                "queryType": "aggregation|filter|groupby|correlation|trend|distribution|comparison",
                "targetColumns": ["primary_column", "secondary_column"],
                "operation": "sum|avg|count|max|min|group|filter|compare|trend",
                "filterConditions": {},
                "chartType": "bar|line|pie|scatter|histogram|area|table",
                "xAxisLabel": "Descriptive X-axis label",
                "yAxisLabel": "Descriptive Y-axis label", 
                "chartTitle": "Compelling chart title",
                "expectedResult": "What insights this analysis will reveal",
                "visualization": {
                    "type": "bar|line|pie|scatter|histogram|area|table",
                    "xAxis": "column_name",
                    "yAxis": "column_name_or_calculated_field", 
                    "groupBy": "column_name_if_applicable",
                    "dataLimit": "number_of_data_points_to_show",
                    "sortBy": "how_to_sort_data_for_best_visual",
                    "reasoning": "Why this chart type and axes were chosen for maximum insight"
                },
                "chartExplanation": {
                    "xAxisMeaning": "What the X-axis represents for business users",
                    "yAxisMeaning": "What the Y-axis represents for business users", 
                    "dataPointMeaning": "What each bar/point/segment represents",
                    "howToInterpret": "How to read and understand this chart",
                    "keyInsights": "What patterns or insights to look for"
                },
                "dataOptimization": {
                    "recommendedLimit": "optimal_number_of_data_points",
                    "aggregationMethod": "how_to_group_or_aggregate_data",
                    "filterSuggestion": "any_filters_to_apply_for_cleaner_visualization"
                }
            }
            
            Return ONLY valid JSON without any markdown formatting.`;

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
            You are a data analyst explaining query results to a user who asked a specific question about their data.
            
            ${summaryPrompt}
            
            CRITICAL REQUIREMENTS:
            - Write exactly 120-180 words
            - DIRECTLY answer the user's original question first
            - Explain what the filtered/processed data shows
            - Use specific numbers and values from the results
            - Make it clear what the user should understand from this analysis
            - Focus on the ANSWER to their question, not general insights
            - Use simple, clear language that explains the findings
            - Structure as: Direct Answer → What the Data Shows → Key Takeaway
            
            Example format:
            "Based on your query '[query]', the analysis shows [direct answer with numbers]. 
            The filtered data reveals [specific findings from the results]. 
            This means [clear explanation of what user should understand]."
            
            Be specific about the actual results, not generic insights.
            Help the user understand exactly what their query revealed.`;
            
            const result = await this.model.generateContent(enhancedPrompt);
            const response = await result.response;
            
            let summary = response.text().trim();
            
            // Ensure the summary is within word count (roughly 120-180 words)
            const words = summary.split(/\s+/);
            if (words.length > 200) {
                summary = words.slice(0, 180).join(' ') + '...';
            } else if (words.length < 80) {
                // If too short, request a more detailed explanation
                const expandedPrompt = `
                Expand this analysis to better explain the query results (120-180 words):
                
                ${summary}
                
                Make sure to:
                - Clearly state what the user's query found
                - Include specific numbers from the results
                - Explain what this means in practical terms
                - Help the user understand the answer to their question
                
                Focus on explaining the actual findings, not general advice.`;
                
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
            return "Analysis completed successfully. The results show the specific data that matches your query. Review the chart and table to see the detailed findings and understand what your question revealed about the dataset.";
        }
    }
}

// Make AIService available globally
window.AIService = AIService;
