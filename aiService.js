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
            const sampleData = data.slice(0, 10);
            
            // Perform comprehensive data analysis for better suggestions
            const dataAnalysis = this.analyzeDataForSuggestions(data, columns);
            
            const prompt = `
            You are a data visualization expert and business analyst. Generate 8-10 HIGHLY USEFUL and GRAPHICALLY VIABLE queries for this dataset.
            
            CRITICAL REQUIREMENTS:
            - Each query MUST create a meaningful, actionable chart
            - Focus on business insights and decision-making value
            - NEVER suggest table views, lists, or raw data display
            - Prioritize queries that reveal patterns, trends, and relationships
            - Use EXACT column names from the dataset
            
            DATASET ANALYSIS:
            - Total records: ${data.length}
            - Columns: ${columns.join(', ')}
            
            DATA INSIGHTS:
            ${dataAnalysis.insights}
            
            COLUMN ANALYSIS:
            ${dataAnalysis.columnDetails}
            
            SAMPLE DATA (first 5 rows):
            ${JSON.stringify(sampleData.slice(0, 5), null, 2)}
            
            GENERATE QUERIES IN THESE PRIORITY CATEGORIES:
            
            1. PERFORMANCE & RANKING QUERIES (High Business Value):
               ${dataAnalysis.numericColumns.length > 0 && dataAnalysis.categoricalColumns.length > 0 ? 
                 `- "Which ${dataAnalysis.categoricalColumns[0]} has the highest ${dataAnalysis.numericColumns[0]}?" (Bar Chart)
                  - "Show top 10 ${dataAnalysis.categoricalColumns[0]} by ${dataAnalysis.numericColumns[0]} performance" (Horizontal Bar)
                  - "Compare ${dataAnalysis.numericColumns[0]} performance across all ${dataAnalysis.categoricalColumns[0]}" (Bar Chart)` : 
                 '- Performance analysis not available with current data structure'}
            
            2. TREND & TIME ANALYSIS (if applicable):
               ${dataAnalysis.dateColumns.length > 0 && dataAnalysis.numericColumns.length > 0 ? 
                 `- "Show ${dataAnalysis.numericColumns[0]} trend over ${dataAnalysis.dateColumns[0]}" (Line Chart)
                  - "How has ${dataAnalysis.numericColumns[0]} changed over time?" (Area Chart)` : 
                 '- Time-based analysis not available'}
            
            3. DISTRIBUTION & PATTERN ANALYSIS:
               ${dataAnalysis.numericColumns.length > 0 ? 
                 `- "What's the distribution pattern of ${dataAnalysis.numericColumns[0]}?" (Histogram)
                  - "Show ${dataAnalysis.numericColumns[0]} distribution with statistical insights" (Box Plot style)` : 
                 '- Distribution analysis limited without numeric data'}
            
            4. RELATIONSHIP & CORRELATION ANALYSIS:
               ${dataAnalysis.numericColumns.length >= 2 ? 
                 `- "What's the relationship between ${dataAnalysis.numericColumns[0]} and ${dataAnalysis.numericColumns[1]}?" (Scatter Plot)
                  - "Show correlation strength between ${dataAnalysis.numericColumns[0]} and ${dataAnalysis.numericColumns[1]}" (Scatter with trend)` : 
                 '- Correlation analysis not available'}
            
            5. COMPOSITION & BREAKDOWN ANALYSIS:
               ${dataAnalysis.categoricalColumns.length > 0 ? 
                 `- "Show percentage breakdown of ${dataAnalysis.categoricalColumns[0]} categories" (Pie Chart)
                  - "What's the composition of ${dataAnalysis.categoricalColumns[0]} in the dataset?" (Donut Chart)` : 
                 '- Composition analysis limited'}
            
            6. COMPARATIVE ANALYSIS:
               ${dataAnalysis.categoricalColumns.length >= 2 ? 
                 `- "Compare ${dataAnalysis.categoricalColumns[0]} vs ${dataAnalysis.categoricalColumns[1]} distribution" (Stacked Bar)
                  - "Show cross-analysis of ${dataAnalysis.categoricalColumns[0]} and ${dataAnalysis.categoricalColumns[1]}" (Grouped Bar)` : 
                 '- Cross-category comparison limited'}
            
            BUSINESS VALUE FOCUS:
            - Prioritize queries that help with decision-making
            - Focus on identifying top performers, outliers, and trends
            - Highlight queries that reveal actionable insights
            - Ensure each query answers a specific business question
            
            CHART VIABILITY REQUIREMENTS:
            - Each query must have clear X and Y axis potential
            - Data must be suitable for the suggested chart type
            - Avoid queries that would result in empty or meaningless charts
            - Ensure adequate data points for meaningful visualization
            
            Return ONLY 8-10 specific, actionable questions that create compelling charts.
            Format: One question per line, no numbering, no bullets.
            Each question should be business-focused and chart-ready.`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            
            const suggestions = response.text()
                .split('\n')
                .filter(q => q.trim())
                .map(q => q.replace(/^\d+\.?\s*/, '').replace(/^[-*]\s*/, '').trim())
                .filter(q => q.length > 15 && !q.toLowerCase().includes('table') && !q.toLowerCase().includes('list'))
                .slice(0, 10);
            
            // Cache successful results
            const result_obj = {
                suggestions: suggestions,
                success: true
            };
            this.setCache(cacheKey, result_obj);
            
            return result_obj;
        } catch (error) {
            console.error('Suggestion Generation Error:', error);
            // Enhanced fallback suggestions that are data-aware
            const fallbackSuggestions = this.generateDataAwareFallbacks(data);
            return {
                suggestions: fallbackSuggestions,
                success: false,
                error: error.message
            };
        }
    }

    // New method for comprehensive data analysis
    analyzeDataForSuggestions(data, columns) {
        const analysis = {
            numericColumns: [],
            categoricalColumns: [],
            dateColumns: [],
            insights: [],
            columnDetails: []
        };
        
        // Analyze each column
        columns.forEach(col => {
            const values = data.slice(0, 50).map(row => row[col]).filter(val => val !== null && val !== undefined && val !== '');
            const uniqueValues = [...new Set(values)];
            const numericValues = values.filter(val => !isNaN(parseFloat(val)) && isFinite(val));
            
            const columnInfo = {
                name: col,
                totalValues: values.length,
                uniqueCount: uniqueValues.length,
                nullCount: data.length - values.length,
                type: 'unknown'
            };
            
            // Determine column type and business relevance
            if (numericValues.length > values.length * 0.7) {
                analysis.numericColumns.push(col);
                columnInfo.type = 'numeric';
                columnInfo.min = Math.min(...numericValues);
                columnInfo.max = Math.max(...numericValues);
                columnInfo.avg = numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length;
                
                // Business relevance indicators
                const lowerCol = col.toLowerCase();
                if (lowerCol.includes('price') || lowerCol.includes('cost') || lowerCol.includes('revenue') || 
                    lowerCol.includes('sales') || lowerCol.includes('amount') || lowerCol.includes('value')) {
                    columnInfo.businessRelevance = 'financial';
                } else if (lowerCol.includes('count') || lowerCol.includes('quantity') || lowerCol.includes('number')) {
                    columnInfo.businessRelevance = 'quantity';
                } else if (lowerCol.includes('score') || lowerCol.includes('rating') || lowerCol.includes('performance')) {
                    columnInfo.businessRelevance = 'performance';
                }
            } else if (uniqueValues.length < values.length * 0.5 && uniqueValues.length > 1 && uniqueValues.length < 20) {
                analysis.categoricalColumns.push(col);
                columnInfo.type = 'categorical';
                columnInfo.categories = uniqueValues.slice(0, 10);
                
                // Business relevance for categories
                const lowerCol = col.toLowerCase();
                if (lowerCol.includes('department') || lowerCol.includes('category') || lowerCol.includes('type') || 
                    lowerCol.includes('group') || lowerCol.includes('class')) {
                    columnInfo.businessRelevance = 'classification';
                } else if (lowerCol.includes('status') || lowerCol.includes('state') || lowerCol.includes('condition')) {
                    columnInfo.businessRelevance = 'status';
                }
            } else if (col.toLowerCase().includes('date') || col.toLowerCase().includes('time') || 
                      col.toLowerCase().includes('year') || col.toLowerCase().includes('month')) {
                analysis.dateColumns.push(col);
                columnInfo.type = 'date';
                columnInfo.businessRelevance = 'temporal';
            } else {
                columnInfo.type = 'text';
            }
            
            analysis.columnDetails.push(`${col}: ${columnInfo.type} (${uniqueValues.length} unique values, ${columnInfo.businessRelevance || 'general'} relevance)`);
        });
        
        // Generate insights
        if (analysis.numericColumns.length > 0 && analysis.categoricalColumns.length > 0) {
            analysis.insights.push(`Strong potential for performance analysis comparing ${analysis.numericColumns.join(', ')} across ${analysis.categoricalColumns.join(', ')}`);
        }
        
        if (analysis.numericColumns.length >= 2) {
            analysis.insights.push(`Correlation analysis possible between ${analysis.numericColumns.slice(0, 2).join(' and ')}`);
        }
        
        if (analysis.dateColumns.length > 0 && analysis.numericColumns.length > 0) {
            analysis.insights.push(`Time-series analysis available for ${analysis.numericColumns.join(', ')} over ${analysis.dateColumns.join(', ')}`);
        }
        
        if (analysis.categoricalColumns.length > 0) {
            analysis.insights.push(`Distribution analysis possible for ${analysis.categoricalColumns.join(', ')} categories`);
        }
        
        analysis.insights = analysis.insights.join('; ');
        analysis.columnDetails = analysis.columnDetails.join('; ');
        
        return analysis;
    }

    // Enhanced data-aware fallback suggestions
    generateDataAwareFallbacks(data) {
        if (!data || data.length === 0) return [];
        
        const columns = Object.keys(data[0]);
        const analysis = this.analyzeDataForSuggestions(data, columns);
        const suggestions = [];
        
        // Performance and ranking queries (highest priority)
        if (analysis.numericColumns.length > 0 && analysis.categoricalColumns.length > 0) {
            suggestions.push(`Which ${analysis.categoricalColumns[0]} has the highest ${analysis.numericColumns[0]} performance?`);
            suggestions.push(`Show top 10 ${analysis.categoricalColumns[0]} ranked by ${analysis.numericColumns[0]} values`);
            suggestions.push(`Create performance comparison chart of ${analysis.numericColumns[0]} across ${analysis.categoricalColumns[0]}`);
            
            if (analysis.numericColumns.length > 1) {
                suggestions.push(`Compare ${analysis.numericColumns[0]} vs ${analysis.numericColumns[1]} performance by ${analysis.categoricalColumns[0]}`);
            }
        }
        
        // Distribution and pattern analysis
        if (analysis.numericColumns.length > 0) {
            suggestions.push(`Show distribution pattern of ${analysis.numericColumns[0]} with histogram analysis`);
            suggestions.push(`Find outliers and anomalies in ${analysis.numericColumns[0]} data using box plot`);
            
            if (analysis.numericColumns.length > 1) {
                suggestions.push(`What's the correlation between ${analysis.numericColumns[0]} and ${analysis.numericColumns[1]}?`);
                suggestions.push(`Create scatter plot showing ${analysis.numericColumns[0]} vs ${analysis.numericColumns[1]} relationship`);
            }
        }
        
        // Composition analysis
        if (analysis.categoricalColumns.length > 0) {
            suggestions.push(`Show percentage breakdown of ${analysis.categoricalColumns[0]} categories with pie chart`);
            suggestions.push(`What's the composition distribution of ${analysis.categoricalColumns[0]} in the dataset?`);
            
            if (analysis.categoricalColumns.length > 1) {
                suggestions.push(`Compare distribution of ${analysis.categoricalColumns[0]} vs ${analysis.categoricalColumns[1]} categories`);
            }
        }
        
        // Time-based analysis
        if (analysis.dateColumns.length > 0 && analysis.numericColumns.length > 0) {
            suggestions.push(`Show ${analysis.numericColumns[0]} trend over ${analysis.dateColumns[0]} with line chart`);
            suggestions.push(`How has ${analysis.numericColumns[0]} changed over time in ${analysis.dateColumns[0]}?`);
        }
        
        // Ensure we have enough suggestions
        if (suggestions.length < 8) {
            suggestions.push(`Create comprehensive dashboard showing key insights from this dataset`);
            suggestions.push(`Show the most significant patterns and relationships in the data`);
            suggestions.push(`Generate multi-chart analysis revealing important business insights`);
        }
        
        return suggestions.slice(0, 10);
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
            const sampleData = data.slice(0, 5);
            
            // Analyze column types and sample values
            const columnAnalysis = columns.map(col => {
                const sampleValues = sampleData.map(row => row[col]).filter(val => val != null && val !== '');
                const isNumeric = sampleValues.every(val => !isNaN(parseFloat(val)));
                const isDate = sampleValues.some(val => !isNaN(Date.parse(val)));
                return {
                    name: col,
                    type: isDate ? 'date' : (isNumeric ? 'numeric' : 'text'),
                    samples: sampleValues.slice(0, 3)
                };
            });
            
            const prompt = `
            You are a PRECISION DATA ANALYST. Your job is to provide EXACT, ACCURATE data processing instructions.
            
            DATASET ANALYSIS:
            - Total Records: ${data.length}
            - Available Columns: ${JSON.stringify(columnAnalysis, null, 2)}
            - Sample Data: ${JSON.stringify(sampleData, null, 2)}
            
            USER QUERY: "${query}"
            
            CRITICAL REQUIREMENTS - FOLLOW EXACTLY:
            
            1. COLUMN IDENTIFICATION (MANDATORY):
               - Identify EXACT column names from the dataset
               - Use case-insensitive partial matching for column detection
               - For "day of week" queries: find date columns and extract day names
               - For rate/percentage queries: identify numerator and denominator columns
            
            2. CALCULATION ACCURACY (ZERO TOLERANCE FOR ERRORS):
               - Rates/Percentages: ALWAYS use (numerator_sum / denominator_sum) * 100
               - Averages: Sum all values in group / count of values
               - Totals: Sum all values in group
               - NEVER calculate average of averages - always use raw data
            
            3. GROUPING LOGIC (MUST BE PRECISE):
               - "Day of week": Extract day names (Monday, Tuesday, etc.) from date columns
               - Categories: Group by exact text values
               - Time periods: Group by extracted time components
            
            4. AXIS LABELING (BUSINESS FRIENDLY):
               - X-axis: What you're comparing (days, categories, time periods)
               - Y-axis: What you're measuring (rates %, counts, totals)
               - Include units in labels (%, $, count, etc.)
            
            5. DATA VALIDATION RULES:
               - Verify columns exist before processing
               - Handle null/empty values appropriately
               - Ensure numeric columns for calculations
               - Validate date formats for time-based queries
            
            QUERY PATTERN RECOGNITION:
            - "highest/lowest rate": Calculate rates, sort descending/ascending
            - "day of week": Extract day names from dates, group by day
            - "average/mean": Calculate proper averages within groups
            - "total/sum": Sum values within groups
            - "trend over time": Use time-based grouping with line chart
            - "distribution": Show frequency counts or percentages
            
            RESPONSE FORMAT (JSON ONLY - NO MARKDOWN):
            {
                "queryType": "rate_analysis|groupby_analysis|trend_analysis|distribution_analysis",
                "dataValidation": {
                    "requiredColumns": ["exact_column_name1", "exact_column_name2"],
                    "columnTypes": {"column1": "numeric", "column2": "date"},
                    "validationRules": ["rule1", "rule2"]
                },
                "dataTransformation": {
                    "extractDayOfWeek": "exact_date_column_name_or_null",
                    "calculateRate": {
                        "numerator": "exact_numerator_column",
                        "denominator": "exact_denominator_column",
                        "formula": "numerator_sum / denominator_sum * 100"
                    },
                    "groupByColumn": "exact_grouping_column_or_day_of_week",
                    "aggregationType": "sum|average|count|rate",
                    "sortBy": "rate|count|value",
                    "sortOrder": "desc|asc",
                    "limit": 10
                },
                "visualization": {
                    "chartType": "bar|line|pie",
                    "xAxis": "exact_field_name",
                    "yAxis": "calculated_field_name",
                    "xAxisLabel": "Business friendly X label with units",
                    "yAxisLabel": "Business friendly Y label with units",
                    "chartTitle": "Clear, specific title answering the question"
                },
                "expectedOutput": {
                    "dataStructure": [
                        {"x_field": "example_value", "y_field": 25.5}
                    ],
                    "topResult": "Expected top result description",
                    "insights": "What this analysis reveals"
                },
                "errorHandling": {
                    "missingColumns": "fallback_strategy",
                    "invalidData": "handling_approach",
                    "emptyResults": "default_behavior"
                }
            }
            
            CRITICAL SUCCESS FACTORS:
            - Column names MUST match dataset exactly (case-insensitive)
            - Calculations MUST be mathematically correct
            - Grouping MUST produce meaningful categories
            - Chart type MUST suit the data and question
            - Axis labels MUST be clear and include units
            
            Return ONLY valid JSON. No explanations, no markdown, no extra text.`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            let responseText = response.text().trim();
            
            // Clean up response more aggressively
            responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            responseText = responseText.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
            
            try {
                const structuredResponse = JSON.parse(responseText);
                
                // Validate the response structure
                if (!structuredResponse.dataTransformation || !structuredResponse.visualization) {
                    console.warn('Invalid AI response structure, using fallback');
                    return this.generateFallbackQueryAnalysis(query, columns);
                }
                
                return {
                    analysis: structuredResponse,
                    success: true
                };
            } catch (parseError) {
                console.warn('Failed to parse AI response:', parseError.message);
                console.log('Raw response:', responseText);
                return this.generateFallbackQueryAnalysis(query, columns);
            }
        } catch (error) {
            console.error('Query Analysis Error:', error);
            return this.generateFallbackQueryAnalysis(query, Object.keys(data[0] || {}));
        }
    }

    generateFallbackQueryAnalysis(query, columns) {
        console.log('Generating fallback analysis for query:', query);
        const lowerQuery = query.toLowerCase();
        
        // Analyze available columns
        const dateColumns = columns.filter(col => 
            col.toLowerCase().includes('date') || 
            col.toLowerCase().includes('time') ||
            col.toLowerCase().includes('created') ||
            col.toLowerCase().includes('sent')
        );
        
        const numericColumns = columns.filter(col => 
            col.toLowerCase().includes('count') ||
            col.toLowerCase().includes('number') ||
            col.toLowerCase().includes('amount') ||
            col.toLowerCase().includes('total') ||
            col.toLowerCase().includes('sum') ||
            col.toLowerCase().includes('open') ||
            col.toLowerCase().includes('click') ||
            col.toLowerCase().includes('sent') ||
            col.toLowerCase().includes('rate') ||
            col.toLowerCase().includes('percent')
        );
        
        // Determine query type and processing
        let queryType = 'groupby_analysis';
        let chartType = 'bar';
        let dataTransformation = {
            extractDayOfWeek: null,
            calculateRate: null,
            groupByColumn: null,
            aggregationType: 'count',
            sortBy: 'count',
            sortOrder: 'desc',
            limit: 10
        };
        
        let xAxisLabel = 'Category';
        let yAxisLabel = 'Count';
        let chartTitle = 'Data Analysis';
        
        // Pattern matching for specific query types
        if (lowerQuery.includes('day') && lowerQuery.includes('week')) {
            // Day of week analysis
            queryType = 'rate_analysis';
            dataTransformation.extractDayOfWeek = dateColumns[0] || columns[0];
            dataTransformation.groupByColumn = 'day_of_week';
            xAxisLabel = 'Day of Week';
            chartTitle = 'Analysis by Day of Week';
            
            if (lowerQuery.includes('rate') || lowerQuery.includes('open')) {
                // Rate calculation
                const openColumn = columns.find(col => col.toLowerCase().includes('open')) || numericColumns[0];
                const sentColumn = columns.find(col => col.toLowerCase().includes('sent') || col.toLowerCase().includes('email')) || numericColumns[1];
                
                if (openColumn && sentColumn) {
                    dataTransformation.calculateRate = {
                        numerator: openColumn,
                        denominator: sentColumn,
                        formula: "numerator_sum / denominator_sum * 100"
                    };
                    dataTransformation.aggregationType = 'rate';
                    dataTransformation.sortBy = 'rate';
                    yAxisLabel = 'Open Rate (%)';
                    chartTitle = 'Open Rate by Day of Week';
                }
            } else if (lowerQuery.includes('average') || lowerQuery.includes('mean')) {
                // Average calculation
                const targetColumn = numericColumns.find(col => 
                    lowerQuery.includes(col.toLowerCase())
                ) || numericColumns[0];
                
                if (targetColumn) {
                    dataTransformation.aggregationType = 'average';
                    dataTransformation.sortBy = 'value';
                    yAxisLabel = `Average ${targetColumn}`;
                    chartTitle = `Average ${targetColumn} by Day of Week`;
                }
            }
        } else if (lowerQuery.includes('rate') || lowerQuery.includes('percentage')) {
            // Rate/percentage analysis
            queryType = 'rate_analysis';
            
            const numeratorCol = columns.find(col => 
                lowerQuery.includes(col.toLowerCase()) && 
                (col.toLowerCase().includes('open') || col.toLowerCase().includes('click'))
            ) || numericColumns[0];
            
            const denominatorCol = columns.find(col => 
                col.toLowerCase().includes('sent') || 
                col.toLowerCase().includes('total') ||
                col.toLowerCase().includes('email')
            ) || numericColumns[1];
            
            if (numeratorCol && denominatorCol) {
                dataTransformation.calculateRate = {
                    numerator: numeratorCol,
                    denominator: denominatorCol,
                    formula: "numerator_sum / denominator_sum * 100"
                };
                dataTransformation.aggregationType = 'rate';
                dataTransformation.sortBy = 'rate';
                yAxisLabel = 'Rate (%)';
                chartTitle = 'Rate Analysis';
                
                // Determine grouping column
                const groupCol = columns.find(col => 
                    !numericColumns.includes(col) && 
                    !dateColumns.includes(col) &&
                    col.toLowerCase().includes('category') ||
                    col.toLowerCase().includes('type') ||
                    col.toLowerCase().includes('group')
                ) || columns.find(col => !numericColumns.includes(col) && !dateColumns.includes(col));
                
                if (groupCol) {
                    dataTransformation.groupByColumn = groupCol;
                    xAxisLabel = groupCol;
                }
            }
        } else if (lowerQuery.includes('trend') || lowerQuery.includes('over time') || lowerQuery.includes('timeline')) {
            // Trend analysis
            queryType = 'trend_analysis';
            chartType = 'line';
            
            const dateCol = dateColumns[0] || columns[0];
            const valueCol = numericColumns[0] || columns[1];
            
            dataTransformation.groupByColumn = dateCol;
            dataTransformation.aggregationType = 'sum';
            xAxisLabel = 'Time';
            yAxisLabel = valueCol || 'Value';
            chartTitle = 'Trend Over Time';
        } else if (lowerQuery.includes('distribution') || lowerQuery.includes('breakdown')) {
            // Distribution analysis
            queryType = 'distribution_analysis';
            chartType = 'pie';
            
            const categoryCol = columns.find(col => 
                !numericColumns.includes(col) && 
                !dateColumns.includes(col)
            ) || columns[0];
            
            dataTransformation.groupByColumn = categoryCol;
            dataTransformation.aggregationType = 'count';
            xAxisLabel = categoryCol || 'Category';
            yAxisLabel = 'Count';
            chartTitle = 'Distribution Analysis';
        } else if (lowerQuery.includes('average') || lowerQuery.includes('mean')) {
            // Average analysis
            queryType = 'groupby_analysis';
            
            const valueCol = numericColumns.find(col => 
                lowerQuery.includes(col.toLowerCase())
            ) || numericColumns[0];
            
            const groupCol = columns.find(col => 
                !numericColumns.includes(col) && 
                !dateColumns.includes(col)
            ) || columns[0];
            
            dataTransformation.groupByColumn = groupCol;
            dataTransformation.aggregationType = 'average';
            dataTransformation.sortBy = 'value';
            xAxisLabel = groupCol || 'Category';
            yAxisLabel = `Average ${valueCol || 'Value'}`;
            chartTitle = `Average ${valueCol || 'Value'} Analysis`;
        } else if (lowerQuery.includes('total') || lowerQuery.includes('sum')) {
            // Sum analysis
            queryType = 'groupby_analysis';
            
            const valueCol = numericColumns.find(col => 
                lowerQuery.includes(col.toLowerCase())
            ) || numericColumns[0];
            
            const groupCol = columns.find(col => 
                !numericColumns.includes(col) && 
                !dateColumns.includes(col)
            ) || columns[0];
            
            dataTransformation.groupByColumn = groupCol;
            dataTransformation.aggregationType = 'sum';
            dataTransformation.sortBy = 'value';
            xAxisLabel = groupCol || 'Category';
            yAxisLabel = `Total ${valueCol || 'Value'}`;
            chartTitle = `Total ${valueCol || 'Value'} Analysis`;
        }
        
        // Ensure we have a grouping column
        if (!dataTransformation.groupByColumn) {
            dataTransformation.groupByColumn = columns.find(col => 
                !numericColumns.includes(col) && 
                !dateColumns.includes(col)
            ) || columns[0];
        }
        
        const fallbackAnalysis = {
            queryType: queryType,
            dataValidation: {
                requiredColumns: [dataTransformation.groupByColumn].filter(Boolean),
                columnTypes: {},
                validationRules: ['check_column_exists', 'handle_null_values']
            },
            dataTransformation: dataTransformation,
            visualization: {
                chartType: chartType,
                xAxis: dataTransformation.groupByColumn || 'category',
                yAxis: dataTransformation.aggregationType === 'rate' ? 'rate' : 'value',
                xAxisLabel: xAxisLabel,
                yAxisLabel: yAxisLabel,
                chartTitle: chartTitle
            },
            expectedOutput: {
                dataStructure: [
                    { "x_field": "example", "y_field": 0 }
                ],
                topResult: "Fallback analysis result",
                insights: "Basic data analysis using pattern matching"
            },
            errorHandling: {
                missingColumns: "use_first_available_column",
                invalidData: "filter_out_invalid_values",
                emptyResults: "show_no_data_message"
            }
        };
        
        console.log('Generated fallback analysis:', fallbackAnalysis);
        
        return {
            analysis: fallbackAnalysis,
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
