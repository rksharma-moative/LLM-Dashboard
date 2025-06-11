class CSVDashboard {
    constructor() {
        this.csvData = null;
        this.currentChart = null;
        this.queryHistory = [];
        this.currentPage = 1;
        this.rowsPerPage = 20;
        this.filteredData = null;
        this.aiService = null;
        this.aiServiceReady = false;
        this.chatHistory = [];
        this.isChatOpen = false;
        this.dataStructure = null;
        
        // Performance optimizations
        this.cache = new Map(); // Add caching
        this.pendingRequests = new Map(); // Prevent duplicate requests
        this.debounceTimers = new Map(); // Debounce timers
        this.maxCacheSize = 50; // Limit cache size
        
        // Chunked processing
        this.chunkSize = 1000; // Process data in chunks
        this.isProcessing = false;
        
        this.sampleData = "Name,Age,Department,Salary,Years_Experience,Performance_Score\nJohn Smith,28,Engineering,75000,3,8.5\nJane Doe,32,Marketing,65000,5,9.2\nMike Johnson,45,Engineering,95000,15,7.8\nSarah Wilson,29,Sales,55000,2,8.9\nDavid Brown,38,Marketing,72000,8,8.1\nLisa Garcia,33,Engineering,82000,7,9.0\nTom Davis,41,Sales,68000,12,7.5\nEmily Rodriguez,26,Engineering,70000,1,8.8\nChris Lee,35,Marketing,69000,6,8.3\nAmy Taylor,30,Sales,58000,4,9.1";
        
        this.queryPatterns = [
            { pattern: /average|mean.*salary/i, type: 'aggregate', operation: 'mean', column: 'Salary' },
            { pattern: /average|mean.*age/i, type: 'aggregate', operation: 'mean', column: 'Age' },
            { pattern: /average|mean.*performance/i, type: 'aggregate', operation: 'mean', column: 'Performance_Score' },
            { pattern: /top.*(\d+).*salary/i, type: 'sort', operation: 'desc', column: 'Salary' },
            { pattern: /top.*(\d+).*performer/i, type: 'sort', operation: 'desc', column: 'Performance_Score' },
            { pattern: /group.*department/i, type: 'group', operation: 'groupby', column: 'Department' },
            { pattern: /salary.*(\d+)/i, type: 'filter', operation: 'condition', column: 'Salary' },
            { pattern: /show.*salary/i, type: 'display', operation: 'show', column: 'Salary' },
            { pattern: /show.*age/i, type: 'display', operation: 'show', column: 'Age' },
            { pattern: /correlation.*age.*salary/i, type: 'correlation', operation: 'scatter', col1: 'Age', col2: 'Salary' },
            { pattern: /sum.*salary/i, type: 'aggregate', operation: 'sum', column: 'Salary' },
            { pattern: /count/i, type: 'aggregate', operation: 'count', column: 'Name' },
            { pattern: /maximum|max.*salary/i, type: 'aggregate', operation: 'max', column: 'Salary' },
            { pattern: /minimum|min.*salary/i, type: 'aggregate', operation: 'min', column: 'Salary' }
        ];
        
        this.init();
    }
    
    init() {
        // Start AI service initialization first (non-blocking)
        this.initializeAIService();
        
        // Set up the rest of the interface
        this.setupEventListeners();
        this.setupDragAndDrop();
        this.setupChatInterface();
        this.setupApiKeyManagement();
        
        console.log('Dashboard initialized - AI service loading in background');
    }

    // Improved caching system
    getCacheKey(operation, params) {
        return `${operation}_${JSON.stringify(params)}`;
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

    // Clear cache method for fresh suggestions
    clearSuggestionCache() {
        // Clear all suggestion-related cache entries
        const keysToDelete = [];
        for (const key of this.cache.keys()) {
            if (key.includes('generateSuggestions')) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.cache.delete(key));
        console.log('Suggestion cache cleared for fresh results');
    }

    // Debounce function for performance
    debounce(key, func, delay = 300) {
        if (this.debounceTimers.has(key)) {
            clearTimeout(this.debounceTimers.get(key));
        }
        
        const timer = setTimeout(() => {
            func();
            this.debounceTimers.delete(key);
        }, delay);
        
        this.debounceTimers.set(key, timer);
    }

    // Prevent duplicate requests
    async executeWithDuplicateCheck(key, asyncFunc) {
        if (this.pendingRequests.has(key)) {
            return this.pendingRequests.get(key);
        }

        const promise = asyncFunc();
        this.pendingRequests.set(key, promise);
        
        try {
            const result = await promise;
            this.pendingRequests.delete(key);
            return result;
        } catch (error) {
            this.pendingRequests.delete(key);
            throw error;
        }
    }

    async initializeAIService() {
        try {
            console.log('🚀 Starting AI Service initialization...');
            this.updateAIServiceStatus(false);
            
            this.updateInitializationProgress('Creating AI service...');
            
            // Create AI service instance immediately
            this.aiService = new window.AIService();
            
            this.updateInitializationProgress('Loading AI libraries...');
            
            // Wait for initialization with timeout
            await Promise.race([
                this.aiService.initialize(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('AI Service timeout')), 12000)
                )
            ]);
            
            this.aiServiceReady = true;
            console.log('✅ AI Service ready!');
            
            this.updateInitializationProgress('AI service ready!');
            setTimeout(() => {
                this.checkApiKeyStatus();
                this.updateAIServiceStatus(true);
            }, 500);
            
        } catch (error) {
            console.warn('⚠️ AI Service initialization failed:', error.message);
            this.aiServiceReady = false;
            
            // Create a fallback service that works without AI
            this.aiService = new window.AIService();
            
            this.updateInitializationProgress('Using offline mode');
            setTimeout(() => {
                this.updateAIServiceStatus(true);
            }, 1000);
        }
    }

    updateAIServiceStatus(isReady) {
        const apiStatus = document.getElementById('apiStatus');
        const apiStatusText = document.getElementById('apiStatusText');
        
        if (isReady) {
            this.checkApiKeyStatus();
        } else {
            if (apiStatus && apiStatusText) {
                apiStatus.style.display = 'block';
                apiStatus.style.backgroundColor = '#e3f2fd';
                apiStatus.style.color = '#1565c0';
                apiStatusText.innerHTML = '🚀 <strong>Initializing AI service...</strong> <span style="font-size: 0.9em;">(This happens once)</span>';
            }
        }
    }

    updateInitializationProgress(message) {
        const apiStatusText = document.getElementById('apiStatusText');
        if (apiStatusText) {
            apiStatusText.innerHTML = `🔧 <strong>${message}</strong>`;
        }
    }

    async waitForAIService() {
        // If already ready, return immediately
        if (this.aiService && this.aiServiceReady) {
            return this.aiService;
        }

        // If service exists but not ready, wait for initialization
        if (this.aiService && this.aiService.initializationPromise) {
            try {
                await this.aiService.initializationPromise;
                this.aiServiceReady = true;
                return this.aiService;
            } catch (error) {
                console.warn('AI Service initialization failed, using fallback');
                return this.aiService; // Return service for fallback operations
            }
        }

        // Fallback: wait a bit and return what we have
        await new Promise(resolve => setTimeout(resolve, 100));
        return this.aiService;
    }
    
    setupEventListeners() {
        const fileInput = document.getElementById('fileInput');
        const loadSampleBtn = document.getElementById('loadSampleBtn');
        const analyzeBtn = document.getElementById('analyzeBtn');
        const exportBtn = document.getElementById('exportBtn');
        const tableSearch = document.getElementById('tableSearch');
        
        if (fileInput) fileInput.addEventListener('change', (e) => this.handleFileUpload(e.target.files[0]));
        if (loadSampleBtn) loadSampleBtn.addEventListener('click', () => this.loadSampleData());
        if (analyzeBtn) analyzeBtn.addEventListener('click', () => this.processQuery());
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportData());
        
        // Debounced search
        if (tableSearch) {
            tableSearch.addEventListener('input', (e) => {
                this.debounce('tableSearch', () => this.searchTable(e.target.value), 300);
            });
        }
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        const queryInput = document.getElementById('queryInput');
        if (queryInput) {
            queryInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.processQuery();
                }
            });
        }
        
        console.log('Event listeners set up');
    }

    setupApiKeyManagement() {
        const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
        const testApiKeyBtn = document.getElementById('testApiKeyBtn');
        const apiKeyInput = document.getElementById('apiKeyInput');

        if (saveApiKeyBtn) {
            saveApiKeyBtn.addEventListener('click', () => this.saveApiKey());
        }

        if (testApiKeyBtn) {
            testApiKeyBtn.addEventListener('click', () => this.testApiKey());
        }

        if (apiKeyInput) {
            apiKeyInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.saveApiKey();
                }
            });

            // Check if key is already saved
            const savedKey = localStorage.getItem('googleAIApiKey');
            if (savedKey) {
                apiKeyInput.value = '••••••••••••••••••••••••••••••••••••';
            }
        }
    }

    checkApiKeyStatus() {
        const apiStatus = document.getElementById('apiStatus');
        const apiStatusText = document.getElementById('apiStatusText');
        const testApiKeyBtn = document.getElementById('testApiKeyBtn');

        // Check if AI service is ready and has a valid API key
        if (this.aiService && this.aiServiceReady && this.aiService.hasValidApiKey()) {
            if (apiStatus && apiStatusText) {
                apiStatus.style.display = 'block';
                apiStatus.style.backgroundColor = '#d4edda';
                apiStatus.style.color = '#155724';
                apiStatusText.textContent = '✓ API key configured';
            }
            if (testApiKeyBtn) {
                testApiKeyBtn.style.display = 'inline-block';
            }
        } else {
            if (apiStatus && apiStatusText) {
                apiStatus.style.display = 'block';
                apiStatus.style.backgroundColor = '#f8d7da';
                apiStatus.style.color = '#721c24';
                apiStatusText.textContent = '⚠ Please configure your API key to use AI features';
            }
            if (testApiKeyBtn) {
                testApiKeyBtn.style.display = 'none';
            }
        }
    }

    async saveApiKey() {
        const apiKeyInput = document.getElementById('apiKeyInput');
        const apiStatus = document.getElementById('apiStatus');
        const apiStatusText = document.getElementById('apiStatusText');
        const testApiKeyBtn = document.getElementById('testApiKeyBtn');

        if (!apiKeyInput || !apiKeyInput.value.trim()) {
            this.showMessage('Please enter an API key', 'error');
            return;
        }

        const apiKey = apiKeyInput.value.trim();
        
        // Don't save if it's the masked value
        if (apiKey === '••••••••••••••••••••••••••••••••••••') {
            this.showMessage('API key is already saved', 'info');
            return;
        }

        try {
            // Show loading state while setting API key
            this.showLoading(true, 'Configuring AI service...');
            
            // Wait for AI service to be ready before trying to set the API key
            const aiService = await this.waitForAIService();
            
            if (!aiService) {
                throw new Error('AI service failed to initialize. Please refresh the page and try again.');
            }
            
            await aiService.setApiKey(apiKey);
            
            // Mask the input
            apiKeyInput.value = '••••••••••••••••••••••••••••••••••••';
            
            // Update status
            if (apiStatus && apiStatusText) {
                apiStatus.style.display = 'block';
                apiStatus.style.backgroundColor = '#d4edda';
                apiStatus.style.color = '#155724';
                apiStatusText.textContent = '✓ API key saved successfully';
            }
            
            if (testApiKeyBtn) {
                testApiKeyBtn.style.display = 'inline-block';
            }
            
            this.showMessage('API key saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving API key:', error);
            this.showMessage('Error saving API key: ' + error.message, 'error');
        } finally {
            // Always hide loading state
            this.showLoading(false);
        }
    }

    async testApiKey() {
        const apiStatus = document.getElementById('apiStatus');
        const apiStatusText = document.getElementById('apiStatusText');

        try {
            this.showLoading(true, 'Testing API key...');
            
            // Wait for AI service to be ready
            const aiService = await this.waitForAIService();
            
            if (!aiService) {
                throw new Error('AI service failed to initialize. Please refresh the page and try again.');
            }

            if (!aiService.hasValidApiKey()) {
                this.showMessage('Please save an API key first', 'error');
                return;
            }

            const result = await aiService.testApiKey();
            
            if (apiStatus && apiStatusText) {
                apiStatus.style.backgroundColor = '#d4edda';
                apiStatus.style.color = '#155724';
                apiStatusText.textContent = '✓ API key is working correctly!';
            }
            
            this.showMessage('API key test successful!', 'success');
        } catch (error) {
            console.error('Error testing API key:', error);
            
            if (apiStatus && apiStatusText) {
                apiStatus.style.backgroundColor = '#f8d7da';
                apiStatus.style.color = '#721c24';
                apiStatusText.textContent = '✗ API key test failed: ' + error.message;
            }
            
            this.showMessage('API key test failed: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    setupDragAndDrop() {
        const uploadArea = document.getElementById('uploadArea');
        if (!uploadArea) return;
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileUpload(files[0]);
            }
        });
    }
    
    handleFileUpload(file) {
        if (!file || !file.name.endsWith('.csv')) {
            this.showMessage('Please select a valid CSV file.', 'error');
            return;
        }
        
        // Check file size (50MB limit)
        const maxSize = 50 * 1024 * 1024;
        if (file.size > maxSize) {
            this.showMessage('File too large. Please use files under 50MB', 'error');
            return;
        }
        
        this.showLoading(true, 'Processing file...');
        
        // Check cache first
        const cacheKey = this.getCacheKey('fileUpload', { name: file.name, size: file.size, lastModified: file.lastModified });
        const cachedResult = this.getCache(cacheKey);
        
        if (cachedResult) {
            console.log('Using cached file result');
            this.csvData = cachedResult.data;
            this.displayFileInfo(file, cachedResult.meta);
            this.showQueryInterface();
            this.showLoading(false);
            this.showMessage(`File loaded from cache! ${this.csvData.length} records.`, 'success');
            return;
        }
        
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim(),
            transform: (value) => value ? value.toString().trim() : '',
            worker: file.size > 1024 * 1024, // Use web worker for large files
            complete: async (results) => {
                try {
                    if (results.errors.length > 0) {
                        console.warn('CSV parsing warnings:', results.errors);
                    }
                    
                    const cleanedData = this.validateAndCleanData(results.data, file.name);
                    if (!cleanedData.isValid) {
                        this.showLoading(false);
                        this.showMessage(cleanedData.message, 'error');
                        return;
                    }
                    
                    this.csvData = cleanedData.data;
                    
                    // Cache the result
                    const resultMeta = { data: this.csvData, meta: { fields: Object.keys(this.csvData[0] || {}) } };
                    this.setCache(cacheKey, resultMeta);
                    
                    // Execute operations in parallel
                    const operations = [
                        this.analyzeDataStructure(),
                        this.generateSuggestions()
                    ];
                    
                    await Promise.allSettled(operations);
                    
                    this.displayFileInfo(file, resultMeta);
                    this.showQueryInterface();
                    this.showLoading(false);
                    this.showMessage(`File processed successfully! ${this.csvData.length} valid records loaded.`, 'success');
                } catch (error) {
                    this.showLoading(false);
                    this.showMessage('Error processing file: ' + error.message, 'error');
                    console.error('File processing error:', error);
                }
            },
            error: (error) => {
                this.showLoading(false);
                this.showMessage('Error reading file: ' + error.message, 'error');
            }
        });
    }
    
    async loadSampleData() {
        console.log('Loading sample data...');
        this.showLoading(true, 'Loading and validating sample data...');
        
        Papa.parse(this.sampleData, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim(),
            transform: (value) => value ? value.toString().trim() : '',
            complete: async (results) => {
                try {
                    console.log('Sample data parsed:', results.data.length, 'rows');
                    
                    // Validate and clean sample data
                    const cleanedData = this.validateAndCleanData(results.data, 'sample-employee-data.csv');
                    if (!cleanedData.isValid) {
                this.showLoading(false);
                        this.showMessage(cleanedData.message, 'error');
                        return;
                    }
                    
                    this.csvData = cleanedData.data;
                    console.log('Final sample data:', this.csvData.length, 'rows');
                    
                    await this.analyzeDataStructure();
                    this.displayFileInfo(
                        { name: 'sample-employee-data.csv', size: this.sampleData.length }, 
                        { data: this.csvData, meta: { fields: Object.keys(this.csvData[0] || {}) } }
                    );
                this.showQueryInterface();
                    await this.generateSuggestions();
                    this.showLoading(false);
                    this.showMessage(`Sample data loaded successfully! ${this.csvData.length} valid records processed.`, 'success');
                } catch (error) {
                    console.error('Error processing sample data:', error);
                    this.showLoading(false);
                    this.showMessage('Error loading sample data: ' + error.message, 'error');
                }
            },
            error: (error) => {
                console.error('Error parsing sample data:', error);
                this.showLoading(false);
                this.showMessage('Error parsing sample data: ' + error.message, 'error');
            }
        });
    }
    
    // Enhanced data validation and cleaning method with accurate counting
    validateAndCleanData(rawData, fileName = 'uploaded file') {
        console.log('Starting data validation for:', fileName);
        console.log('Raw data received:', rawData?.length || 0, 'rows');
        
        if (!rawData || !Array.isArray(rawData)) {
            return { isValid: false, message: 'Invalid data format.' };
        }

        if (rawData.length === 0) {
            return { isValid: false, message: 'The CSV file is empty.' };
        }

        // Step 1: Remove completely empty rows (where all values are empty/null)
        const nonEmptyRows = rawData.filter(row => {
            if (!row || typeof row !== 'object') return false;
            return Object.values(row).some(value => 
                value !== null && 
                value !== undefined && 
                value.toString().trim() !== ''
            );
        });

        console.log('After removing empty rows:', nonEmptyRows.length, 'rows');

        if (nonEmptyRows.length === 0) {
            return { isValid: false, message: 'No valid data rows found in the file.' };
        }

        // Step 2: Get and validate headers
        const allHeaders = Object.keys(nonEmptyRows[0] || {});
        console.log('Original headers:', allHeaders);

        if (allHeaders.length === 0) {
            return { isValid: false, message: 'No valid columns found in the file.' };
        }

        // Step 3: Filter out meaningless columns
        const validHeaders = allHeaders.filter(header => {
            const cleanHeader = header.trim();
            
            // Remove generic/auto-generated column names
            if (!cleanHeader || cleanHeader.match(/^(column|field|unnamed|null|undefined|\d+)$/i)) {
                console.log('Removing generic header:', header);
                return false;
            }
            
            // Check if column has any meaningful data (at least 10% non-empty values)
            const nonEmptyValues = nonEmptyRows.filter(row => {
                const value = row[header];
                return value !== null && 
                       value !== undefined && 
                       value.toString().trim() !== '';
            });
            
            const hasEnoughData = nonEmptyValues.length >= Math.max(1, Math.ceil(nonEmptyRows.length * 0.1));
            
            if (!hasEnoughData) {
                console.log('Removing column with insufficient data:', header, 
                           `(${nonEmptyValues.length}/${nonEmptyRows.length} non-empty)`);
                return false;
            }
            
            return true;
        });

        console.log('Valid headers after filtering:', validHeaders);

        if (validHeaders.length === 0) {
            return { isValid: false, message: 'No columns with sufficient data found.' };
        }

        // Step 4: Clean and restructure data with only valid columns
        const cleanedRows = nonEmptyRows.map(row => {
            const cleanRow = {};
            validHeaders.forEach(header => {
                let value = row[header];
                if (value !== null && value !== undefined) {
                    value = value.toString().trim();
                    // Convert empty strings to null for consistent handling
                    cleanRow[header] = value === '' ? null : value;
                } else {
                    cleanRow[header] = null;
                }
            });
            return cleanRow;
        });

        // Step 5: Final quality check - ensure rows have meaningful data
        const qualityThreshold = Math.ceil(validHeaders.length * 0.2); // At least 20% of columns should have data
        const meaningfulRows = cleanedRows.filter(row => {
            const nonNullValues = Object.values(row).filter(val => val !== null && val !== '');
            return nonNullValues.length >= qualityThreshold;
        });

        console.log('After quality filtering:', meaningfulRows.length, 'rows');

        if (meaningfulRows.length === 0) {
            return { isValid: false, message: 'No rows with sufficient data quality found.' };
        }

        // Step 6: Remove duplicate rows (optional, but helpful for data quality)
        const uniqueRows = this.removeDuplicateRows(meaningfulRows);
        console.log('After removing duplicates:', uniqueRows.length, 'rows');

        const removedRows = rawData.length - uniqueRows.length;
        const removedColumns = allHeaders.length - validHeaders.length;

        let qualityMessage = `Successfully processed ${uniqueRows.length} valid records with ${validHeaders.length} columns.`;
        
        if (removedRows > 0 || removedColumns > 0) {
            qualityMessage += ` Removed: ${removedRows} low-quality rows`;
            if (removedColumns > 0) {
                qualityMessage += `, ${removedColumns} empty/invalid columns`;
            }
            qualityMessage += '.';
        }

        return {
            isValid: true,
            data: uniqueRows,
            message: qualityMessage,
            originalRows: rawData.length,
            cleanedRows: uniqueRows.length,
            validColumns: validHeaders.length,
            removedRows: removedRows,
            removedColumns: removedColumns,
            dataQuality: this.assessOverallDataQuality({
                totalRows: uniqueRows.length,
                validColumns: validHeaders.length,
                completeness: (uniqueRows.length / rawData.length) * 100
            })
        };
    }

    // Helper method to remove duplicate rows
    removeDuplicateRows(rows) {
        const seen = new Set();
        return rows.filter(row => {
            // Create a hash of the row values for comparison
            const rowHash = JSON.stringify(Object.values(row).sort());
            if (seen.has(rowHash)) {
                return false;
            }
            seen.add(rowHash);
            return true;
        });
    }

    // Enhanced data quality assessment
    assessOverallDataQuality(stats) {
        const { totalRows, validColumns, completeness } = stats;
        
        let score = 0;
        
        // Row count score (0-25 points)
        if (totalRows >= 100) score += 25;
        else if (totalRows >= 50) score += 20;
        else if (totalRows >= 20) score += 15;
        else if (totalRows >= 10) score += 10;
        else score += 5;
        
        // Column count score (0-25 points)
        if (validColumns >= 10) score += 25;
        else if (validColumns >= 5) score += 20;
        else if (validColumns >= 3) score += 15;
        else if (validColumns >= 2) score += 10;
        else score += 5;
        
        // Completeness score (0-50 points)
        score += Math.round(completeness / 2);
        
        if (score >= 85) return 'Excellent';
        if (score >= 70) return 'Good';
        if (score >= 50) return 'Fair';
        return 'Poor';
    }

    // Enhanced data structure analysis with better column detection
    async analyzeDataStructure() {
        if (!this.csvData || this.csvData.length === 0) return;
        
        try {
            // Perform detailed column analysis for internal use only
            const columnAnalysis = this.performDetailedColumnAnalysis();
            
            // Store for internal use but don't display
                this.dataStructure = {
                    detailedColumnAnalysis: columnAnalysis,
                    totalRows: this.csvData.length,
                    totalColumns: Object.keys(this.csvData[0]).length,
                    columns: Object.keys(this.csvData[0]),
                    success: true
                };
            
            console.log('Data structure analyzed internally:', this.dataStructure);
        } catch (error) {
            console.error('Error analyzing data structure:', error);
        }
    }

    performDetailedColumnAnalysis() {
        const columns = Object.keys(this.csvData[0] || {});
        const analysis = {};
        
        columns.forEach(col => {
            const values = this.csvData.map(row => row[col]).filter(val => val !== null && val !== undefined && val !== '');
            const totalValues = this.csvData.length;
            const nonNullValues = values.length;
            
            // Basic stats
            const uniqueValues = [...new Set(values)];
            const nullCount = totalValues - nonNullValues;
            const nullPercentage = (nullCount / totalValues) * 100;
            
            // Type detection
            const numericValues = values.filter(val => !isNaN(parseFloat(val)) && isFinite(val));
            const dateValues = values.filter(val => !isNaN(Date.parse(val)));
            const booleanValues = values.filter(val => /^(true|false|yes|no|1|0)$/i.test(val.toString()));
            
            let type = 'text';
            let subtype = 'string';
            
            if (numericValues.length > nonNullValues * 0.8) {
                type = 'numeric';
                // Check if integers
                const integerValues = numericValues.filter(val => Number.isInteger(parseFloat(val)));
                subtype = integerValues.length === numericValues.length ? 'integer' : 'decimal';
            } else if (dateValues.length > nonNullValues * 0.7) {
                type = 'date';
                subtype = 'datetime';
            } else if (booleanValues.length > nonNullValues * 0.8) {
                type = 'boolean';
                subtype = 'boolean';
            } else if (uniqueValues.length < nonNullValues * 0.5 && uniqueValues.length < 20) {
                type = 'categorical';
                subtype = 'category';
            }
            
            // Statistical analysis for numeric columns
            let stats = {};
            if (type === 'numeric' && numericValues.length > 0) {
                const numbers = numericValues.map(v => parseFloat(v));
                numbers.sort((a, b) => a - b);
                
                stats = {
                    min: Math.min(...numbers),
                    max: Math.max(...numbers),
                    mean: numbers.reduce((sum, val) => sum + val, 0) / numbers.length,
                    median: numbers[Math.floor(numbers.length / 2)],
                    std: this.calculateStandardDeviation(numbers)
                };
            }
            
            analysis[col] = {
                type,
                subtype,
                totalValues,
                nonNullValues,
                nullCount,
                nullPercentage: Math.round(nullPercentage * 100) / 100,
                uniqueCount: uniqueValues.length,
                uniquePercentage: Math.round((uniqueValues.length / nonNullValues) * 10000) / 100,
                sampleValues: uniqueValues.slice(0, 5),
                hasNulls: nullCount > 0,
                dataQuality: this.assessDataQuality(nullPercentage, uniqueValues.length, nonNullValues),
                stats,
                isUsefulForAnalysis: this.isColumnUsefulForAnalysis(type, uniqueValues.length, nonNullValues, nullPercentage)
            };
        });
        
        return analysis;
    }

    calculateStandardDeviation(numbers) {
        const mean = numbers.reduce((sum, val) => sum + val, 0) / numbers.length;
        const squaredDiffs = numbers.map(val => Math.pow(val - mean, 2));
        const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / numbers.length;
        return Math.sqrt(avgSquaredDiff);
    }

    assessDataQuality(nullPercentage, uniqueCount, nonNullCount) {
        if (nullPercentage > 50) return 'poor';
        if (nullPercentage > 20) return 'fair';
        if (uniqueCount === 1) return 'poor'; // All same values
        if (uniqueCount === nonNullCount && nonNullCount > 100) return 'excellent'; // All unique (like IDs)
        return 'good';
    }

    isColumnUsefulForAnalysis(type, uniqueCount, nonNullCount, nullPercentage) {
        if (nullPercentage > 80) return false; // Too many nulls
        if (uniqueCount === 1) return false; // No variation
        if (type === 'text' && uniqueCount === nonNullCount && nonNullCount > 50) return false; // Likely IDs
        return true;
    }

    assessOverallDataQuality(columnAnalysis) {
        const qualityScores = Object.values(columnAnalysis).map(col => {
            switch (col.dataQuality) {
                case 'excellent': return 4;
                case 'good': return 3;
                case 'fair': return 2;
                case 'poor': return 1;
                default: return 2;
            }
        });
        
        const avgScore = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
        
        if (avgScore >= 3.5) return 'Excellent';
        if (avgScore >= 2.5) return 'Good';
        if (avgScore >= 1.5) return 'Fair';
        return 'Poor';
    }

    suggestAnalysisTypes(columnAnalysis) {
        const types = [];
        const numericCols = Object.values(columnAnalysis).filter(col => col.type === 'numeric' && col.isUsefulForAnalysis);
        const categoricalCols = Object.values(columnAnalysis).filter(col => col.type === 'categorical' && col.isUsefulForAnalysis);
        
        if (numericCols.length >= 2) types.push('correlation');
        if (numericCols.length >= 1) types.push('statistical');
        if (categoricalCols.length >= 1) types.push('categorical');
        if (numericCols.length >= 1 && categoricalCols.length >= 1) types.push('comparative');
        
        return types.length > 0 ? types : ['descriptive'];
    }

    displayFallbackSuggestions() {
        if (!this.csvData || this.csvData.length === 0) return;
        
        const columns = Object.keys(this.csvData[0]);
        const numericColumns = columns.filter(col => {
            const values = this.csvData.slice(0, 10).map(row => row[col]);
            const numericValues = values.filter(val => !isNaN(parseFloat(val)) && val !== '');
            return numericValues.length > values.length * 0.7;
        });
        
        const categoricalColumns = columns.filter(col => {
            const values = this.csvData.slice(0, 20).map(row => row[col]).filter(val => val && val.toString().trim());
            const uniqueValues = [...new Set(values)];
            return uniqueValues.length < values.length * 0.5 && uniqueValues.length > 1;
        });
        
        const dateColumns = columns.filter(col => {
            const lowerCol = col.toLowerCase();
            return lowerCol.includes('date') || lowerCol.includes('time') || lowerCol.includes('year');
        });
        
        const interestingSuggestions = [];
        
        // Modern visualization suggestions with specific chart types
        if (numericColumns.length >= 2 && categoricalColumns.length >= 1) {
            interestingSuggestions.push(`Create a bubble chart showing ${numericColumns[0]} vs ${numericColumns[1]} grouped by ${categoricalColumns[0]}`);
            interestingSuggestions.push(`Show correlation heatmap between ${numericColumns.slice(0, 3).join(', ')}`);
        }
        
        if (categoricalColumns.length >= 1 && numericColumns.length >= 1) {
            interestingSuggestions.push(`Create a radar chart comparing ${numericColumns[0]} across different ${categoricalColumns[0]}`);
            interestingSuggestions.push(`Show distribution of ${numericColumns[0]} by ${categoricalColumns[0]} using violin plot style`);
            interestingSuggestions.push(`Create a treemap visualization of ${categoricalColumns[0]} by ${numericColumns[0]}`);
        }
        
        if (dateColumns.length >= 1 && numericColumns.length >= 1) {
            interestingSuggestions.push(`Show trend analysis of ${numericColumns[0]} over ${dateColumns[0]} with area chart`);
            interestingSuggestions.push(`Create time series decomposition of ${numericColumns[0]} by ${dateColumns[0]}`);
        }
        
        if (numericColumns.length >= 3) {
            interestingSuggestions.push(`Create 3D scatter plot with ${numericColumns[0]}, ${numericColumns[1]}, and ${numericColumns[2]}`);
            interestingSuggestions.push(`Show parallel coordinates plot for ${numericColumns.slice(0, 4).join(', ')}`);
        }
        
        if (categoricalColumns.length >= 2) {
            interestingSuggestions.push(`Create sunburst chart showing hierarchy of ${categoricalColumns[0]} and ${categoricalColumns[1]}`);
            interestingSuggestions.push(`Show sankey diagram flow between ${categoricalColumns[0]} and ${categoricalColumns[1]}`);
        }
        
        // Enhanced visualization-focused suggestions
        if (numericColumns.length > 0) {
            interestingSuggestions.push(`Create histogram showing distribution pattern of ${numericColumns[0]} with statistical insights`);
            interestingSuggestions.push(`Show bar chart of top 10 highest ${numericColumns[0]} values`);
            interestingSuggestions.push(`Generate box plot to find outliers and anomalies in ${numericColumns[0]} data`);
        }
        
        if (categoricalColumns.length > 0) {
            interestingSuggestions.push(`Create interactive pie chart breakdown of ${categoricalColumns[0]} categories`);
            interestingSuggestions.push(`Show percentage distribution of ${categoricalColumns[0]} with modern donut chart`);
            interestingSuggestions.push(`Generate horizontal bar chart ranking ${categoricalColumns[0]} by frequency`);
        }
        
        if (numericColumns.length >= 2) {
            interestingSuggestions.push(`Create scatter plot showing correlation between ${numericColumns[0]} and ${numericColumns[1]}`);
            interestingSuggestions.push(`Generate bubble chart with ${numericColumns[0]} vs ${numericColumns[1]} relationship`);
            interestingSuggestions.push(`Show dual-axis line chart comparing ${numericColumns[0]} and ${numericColumns[1]} trends`);
        }
        
        // Visual insights and patterns
        interestingSuggestions.push(`Create comprehensive chart dashboard showing key visual insights`);
        interestingSuggestions.push(`Generate multi-chart analysis revealing the strongest data patterns`);
        interestingSuggestions.push(`Show interactive visualization highlighting the most important relationships`);
        
        // Performance and comparison analysis
        if (categoricalColumns.length >= 1 && numericColumns.length >= 1) {
            interestingSuggestions.push(`Create multi-series bar chart comparing ${numericColumns[0]} across ${categoricalColumns[0]}`);
            interestingSuggestions.push(`Generate horizontal bar chart ranking ${categoricalColumns[0]} by ${numericColumns[0]} values`);
            interestingSuggestions.push(`Show stacked bar chart breaking down ${numericColumns[0]} by ${categoricalColumns[0]} categories`);
        }
        
        // Ensure we have at least 8-10 suggestions
        if (interestingSuggestions.length < 8) {
            const additionalSuggestions = [
                `Create advanced box plot analysis showing statistical distributions`,
                `Generate radar chart for multi-dimensional data comparison`,
                `Show area chart with trend forecasting and patterns`,
                `Create interactive multi-chart dashboard for data exploration`,
                `Generate comparative bar chart analysis with benchmark indicators`,
                `Show heatmap visualization revealing data correlations and patterns`
            ];
            
            additionalSuggestions.forEach(suggestion => {
                if (interestingSuggestions.length < 10) {
                    interestingSuggestions.push(suggestion);
                }
            });
        }
        
        // Add a note about AI features and modern visualizations
        if (!this.aiService || !this.aiServiceReady || !this.aiService.hasValidApiKey()) {
            const suggestionsContainer = document.getElementById('suggestions');
            if (suggestionsContainer) {
                const aiNote = document.createElement('div');
                aiNote.style.cssText = 'margin-bottom: 1rem; padding: 0.75rem; background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%); border-radius: 8px; font-size: 0.9rem; color: #1565c0; border: 1px solid rgba(33, 150, 243, 0.2);';
                aiNote.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <span style="font-size: 1.2em;">🚀</span>
                        <strong>Unlock Advanced Visualizations!</strong>
                                    </div>
                    <p style="margin: 0; line-height: 1.4;">
                        Configure your Google AI API key above to access intelligent chart recommendations, 
                        modern visualization types (bubble charts, radar plots, heatmaps), and AI-powered insights 
                        that automatically choose the best way to visualize your data!
                    </p>
                `;
                suggestionsContainer.appendChild(aiNote);
            }
        }
        
        this.displaySuggestions(interestingSuggestions.slice(0, 10));
    }

    // Enhanced method for generating data-aware, business-focused fallback suggestions
    generateDataAwareFallbacks(data) {
        if (!data || data.length === 0) return [];
        
        const columns = Object.keys(data[0]);
        const suggestions = [];
        
        // Perform comprehensive data analysis
        const analysis = this.analyzeDataForBusinessSuggestions(data, columns);
        
        // Priority 1: Performance & Ranking Queries (High Business Value)
        if (analysis.numericColumns.length > 0 && analysis.categoricalColumns.length > 0) {
            const numCol = analysis.numericColumns[0];
            const catCol = analysis.categoricalColumns[0];
            
            suggestions.push(`Which ${catCol} has the highest ${numCol} performance?`);
            suggestions.push(`Show top 10 ${catCol} ranked by ${numCol} values`);
            suggestions.push(`Create performance comparison chart of ${numCol} across all ${catCol}`);
            
            // Add financial/business context if detected
            if (analysis.hasFinancialData) {
                suggestions.push(`Compare revenue performance across different ${catCol} categories`);
            }
            if (analysis.hasPerformanceData) {
                suggestions.push(`Show performance ranking analysis by ${catCol} with ${numCol} metrics`);
            }
        }
        
        // Priority 2: Distribution & Pattern Analysis
        if (analysis.numericColumns.length > 0) {
            const numCol = analysis.numericColumns[0];
            suggestions.push(`Show distribution pattern of ${numCol} with detailed histogram analysis`);
            suggestions.push(`Find outliers and anomalies in ${numCol} data using statistical visualization`);
            
            if (analysis.numericColumns.length > 1) {
                const numCol2 = analysis.numericColumns[1];
                suggestions.push(`What's the correlation between ${numCol} and ${numCol2}?`);
                suggestions.push(`Create scatter plot showing ${numCol} vs ${numCol2} relationship patterns`);
            }
        }
        
        // Priority 3: Composition & Breakdown Analysis
        if (analysis.categoricalColumns.length > 0) {
            const catCol = analysis.categoricalColumns[0];
            suggestions.push(`Show percentage breakdown of ${catCol} categories with interactive pie chart`);
            suggestions.push(`What's the composition distribution of ${catCol} in the dataset?`);
            
            if (analysis.categoricalColumns.length > 1) {
                const catCol2 = analysis.categoricalColumns[1];
                suggestions.push(`Compare distribution patterns between ${catCol} and ${catCol2} categories`);
            }
        }
        
        // Priority 4: Time-based Analysis (if applicable)
        if (analysis.dateColumns.length > 0 && analysis.numericColumns.length > 0) {
            const dateCol = analysis.dateColumns[0];
            const numCol = analysis.numericColumns[0];
            suggestions.push(`Show ${numCol} trend over ${dateCol} with comprehensive line chart`);
            suggestions.push(`How has ${numCol} performance changed over time in ${dateCol}?`);
        }
        
        // Priority 5: Advanced Business Insights
        if (suggestions.length < 8) {
            if (analysis.hasBusinessMetrics) {
                suggestions.push(`Create executive dashboard showing key business performance indicators`);
                suggestions.push(`Show comprehensive business metrics analysis with multiple chart views`);
            } else {
                suggestions.push(`Generate multi-dimensional analysis revealing key data patterns`);
                suggestions.push(`Create comprehensive visualization dashboard of important insights`);
            }
            
            suggestions.push(`Show the most significant relationships and trends in this dataset`);
            suggestions.push(`Generate actionable insights visualization for decision-making`);
        }
        
        return suggestions.slice(0, 10);
    }

    // New method for business-focused data analysis
    analyzeDataForBusinessSuggestions(data, columns) {
        const analysis = {
            numericColumns: [],
            categoricalColumns: [],
            dateColumns: [],
            hasFinancialData: false,
            hasPerformanceData: false,
            hasBusinessMetrics: false,
            businessContext: []
        };
        
        columns.forEach(col => {
            const values = data.slice(0, 50).map(row => row[col]).filter(val => val !== null && val !== undefined && val !== '');
            const uniqueValues = [...new Set(values)];
            const numericValues = values.filter(val => !isNaN(parseFloat(val)) && isFinite(val));
            const lowerCol = col.toLowerCase();
            
            // Classify column types with business context
            if (numericValues.length > values.length * 0.7) {
                analysis.numericColumns.push(col);
                
                // Detect business-relevant numeric data
                if (lowerCol.includes('price') || lowerCol.includes('cost') || lowerCol.includes('revenue') || 
                    lowerCol.includes('sales') || lowerCol.includes('amount') || lowerCol.includes('value') ||
                    lowerCol.includes('profit') || lowerCol.includes('income')) {
                    analysis.hasFinancialData = true;
                    analysis.businessContext.push(`${col}: Financial metric`);
                } else if (lowerCol.includes('score') || lowerCol.includes('rating') || lowerCol.includes('performance') ||
                          lowerCol.includes('efficiency') || lowerCol.includes('quality')) {
                    analysis.hasPerformanceData = true;
                    analysis.businessContext.push(`${col}: Performance indicator`);
                } else if (lowerCol.includes('count') || lowerCol.includes('quantity') || lowerCol.includes('number') ||
                          lowerCol.includes('volume') || lowerCol.includes('units')) {
                    analysis.businessContext.push(`${col}: Quantity measure`);
                }
            } else if (uniqueValues.length < values.length * 0.5 && uniqueValues.length > 1 && uniqueValues.length < 25) {
                analysis.categoricalColumns.push(col);
                
                // Detect business-relevant categorical data
                if (lowerCol.includes('department') || lowerCol.includes('category') || lowerCol.includes('type') || 
                    lowerCol.includes('group') || lowerCol.includes('class') || lowerCol.includes('segment')) {
                    analysis.businessContext.push(`${col}: Business classification`);
                } else if (lowerCol.includes('status') || lowerCol.includes('state') || lowerCol.includes('condition') ||
                          lowerCol.includes('stage') || lowerCol.includes('phase')) {
                    analysis.businessContext.push(`${col}: Status indicator`);
                } else if (lowerCol.includes('region') || lowerCol.includes('location') || lowerCol.includes('area') ||
                          lowerCol.includes('territory') || lowerCol.includes('zone')) {
                    analysis.businessContext.push(`${col}: Geographic dimension`);
                }
            } else if (lowerCol.includes('date') || lowerCol.includes('time') || lowerCol.includes('year') || 
                      lowerCol.includes('month') || lowerCol.includes('day') || lowerCol.includes('period')) {
                analysis.dateColumns.push(col);
                analysis.businessContext.push(`${col}: Time dimension`);
            }
        });
        
        // Determine if we have business metrics
        analysis.hasBusinessMetrics = analysis.hasFinancialData || analysis.hasPerformanceData || 
                                     (analysis.numericColumns.length > 0 && analysis.categoricalColumns.length > 0);
        
        return analysis;
    }
    
    // Enhanced file info display with accurate statistics
    displayFileInfo(file, results) {
        const fileInfoSection = document.getElementById('fileInfoSection');
        const fileStats = document.getElementById('fileStats');
        const dataPreview = document.getElementById('dataPreview');
        
        if (!fileInfoSection || !fileStats || !dataPreview) {
            console.error('Required elements not found');
            return;
        }
        
        // Use actual data for statistics
        const columns = Object.keys(this.csvData[0] || {});
        const rows = this.csvData.length;
        const fileSize = this.formatFileSize(file.size || new Blob([JSON.stringify(this.csvData)]).size);
        
        // Calculate data quality metrics
        const totalCells = rows * columns.length;
        const filledCells = this.csvData.reduce((count, row) => {
            return count + Object.values(row).filter(val => val !== null && val !== undefined && val !== '').length;
        }, 0);
        const completeness = totalCells > 0 ? ((filledCells / totalCells) * 100).toFixed(1) : 0;
        
        fileStats.innerHTML = `
            <div class="stat-item">
                <div class="stat-label">File Name</div>
                <div class="stat-value">${file.name}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">File Size</div>
                <div class="stat-value">${fileSize}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Valid Rows</div>
                <div class="stat-value">${rows.toLocaleString()}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Columns</div>
                <div class="stat-value">${columns.length}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Data Completeness</div>
                <div class="stat-value">${completeness}%</div>
            </div>
        `;
        
        // Enhanced data preview with better handling
        const previewRows = this.csvData.slice(0, 5);
        const tableHtml = `
            <h4>📋 Data Preview & Column Analysis</h4>
            <div class="data-overview">
                <div class="overview-stats">
                    <div class="overview-item">
                        <span class="overview-label">Total Records:</span>
                        <span class="overview-value">${rows.toLocaleString()}</span>
                    </div>
                    <div class="overview-item">
                        <span class="overview-label">Columns:</span>
                        <span class="overview-value">${columns.length}</span>
                    </div>
                    <div class="overview-item">
                        <span class="overview-label">Data Quality:</span>
                        <span class="overview-value">${completeness}% Complete</span>
                    </div>
                </div>
            </div>
            
            <div class="column-analysis-section">
                <h5>🔍 Column Details</h5>
                <div class="columns-overview-grid">
                    ${columns.map(col => {
                        const columnInfo = this.dataStructure?.detailedColumnAnalysis?.[col];
                        const columnType = columnInfo?.type || this.getColumnType(col);
                        const uniqueCount = columnInfo?.uniqueCount || 'N/A';
                        const sampleValues = columnInfo?.sampleValues || [];
                        const nullPercentage = columnInfo?.nullPercentage || 0;
                        const completeness = (100 - nullPercentage).toFixed(1);
                        
                        return `
                            <div class="column-overview-card">
                                <div class="column-overview-header">
                                    <div class="column-overview-name">${col}</div>
                                    <div class="column-overview-type ${columnType}">${columnType}</div>
                                </div>
                                <div class="column-overview-stats">
                                    <div class="column-stat">
                                        <span class="stat-icon">🔢</span>
                                        <span class="stat-text">${uniqueCount} unique values</span>
                                    </div>
                                    <div class="column-stat">
                                        <span class="stat-icon">✅</span>
                                        <span class="stat-text">${completeness}% complete</span>
                                    </div>
                                    ${sampleValues.length > 0 ? `
                                    <div class="column-stat">
                                        <span class="stat-icon">📝</span>
                                        <span class="stat-text">e.g., ${sampleValues.slice(0, 2).join(', ')}</span>
                                    </div>
                                    ` : ''}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            
            <div class="table-wrapper">
                <h5>📊 Sample Data (First 5 rows)</h5>
                <table class="preview-table">
                    <thead>
                        <tr>
                            ${columns.map(col => {
                                const columnType = this.dataStructure?.detailedColumnAnalysis?.[col]?.type || this.getColumnType(col);
                                return `<th>
                                    <div class="column-header-content">
                                        <span class="column-name">${col}</span>
                                        <span class="column-type-badge ${columnType}">${columnType}</span>
                                    </div>
                                </th>`;
                            }).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${previewRows.map(row => `
                            <tr>
                                ${columns.map(col => {
                                    let value = row[col];
                                    if (value === null || value === undefined || value === '') {
                                        value = '<span class="null-value">—</span>';
                                    } else if (typeof value === 'number') {
                                        value = value.toLocaleString();
                                    }
                                    return `<td>${value}</td>`;
                                }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        dataPreview.innerHTML = tableHtml;
        fileInfoSection.style.display = 'block';
    }
    
    getColumnType(columnName) {
        // Enhanced column type detection
        if (this.dataStructure?.detailedColumnAnalysis?.[columnName]) {
            return this.dataStructure.detailedColumnAnalysis[columnName].type;
        }
        
        const lowerName = columnName.toLowerCase();
        if (lowerName.includes('date') || lowerName.includes('time')) return 'date';
        if (lowerName.includes('id') || lowerName.includes('number')) return 'numeric';
        if (lowerName.includes('name') || lowerName.includes('title')) return 'text';
        if (lowerName.includes('amount') || lowerName.includes('price') || lowerName.includes('salary')) return 'numeric';
        return 'text';
    }
    
    showQueryInterface() {
        const querySection = document.getElementById('querySection');
        if (querySection) {
            querySection.style.display = 'block';
        }
    }
    
    async generateSuggestions() {
        if (!this.csvData) return;
        
        // Clear old suggestion cache to ensure fresh, improved suggestions
        this.clearSuggestionCache();
        
        // Check cache first (will be empty after clearing, but keeping for future calls)
        const cacheKey = this.getCacheKey('generateSuggestions', this.csvData.slice(0, 10));
        const cachedSuggestions = this.getCache(cacheKey);
        
        if (cachedSuggestions) {
            console.log('Using cached suggestions');
            this.displaySuggestions(cachedSuggestions);
            return;
        }
        
        try {
            // Wait for AI service to be ready
            const aiService = await this.waitForAIService();
            
            if (!aiService || !aiService.hasValidApiKey()) {
                console.log('No API key configured, using enhanced data-aware fallback suggestions');
                const dataAwareSuggestions = this.generateDataAwareFallbacks(this.csvData);
                this.displaySuggestions(dataAwareSuggestions);
                return;
            }
            
            this.showLoading(true, 'Generating AI-powered suggestions...');
            
            const result = await this.executeWithDuplicateCheck(
                'generateSuggestions',
                () => aiService.generateSuggestions(this.csvData)
            );
            
            if (result && result.success && result.suggestions.length > 0) {
                // Cache the suggestions
                this.setCache(cacheKey, result.suggestions);
                this.displaySuggestions(result.suggestions);
            } else {
                console.log('AI suggestions failed, using enhanced data-aware fallback');
                const dataAwareSuggestions = this.generateDataAwareFallbacks(this.csvData);
                this.displaySuggestions(dataAwareSuggestions);
            }
        } catch (error) {
            console.error('Error generating suggestions:', error);
            const dataAwareSuggestions = this.generateDataAwareFallbacks(this.csvData);
            this.displaySuggestions(dataAwareSuggestions);
        } finally {
            this.showLoading(false);
        }
    }

    displaySuggestions(suggestions) {
        const suggestionsContainer = document.getElementById('suggestions');
        if (!suggestionsContainer) return;
        
        // Create suggestions with proper event handling
        const suggestionsHtml = `
            <h4>💡 Suggested Questions</h4>
            <div class="suggestions-grid">
                ${suggestions.map((suggestion, index) => `
                    <button class="suggestion-btn" data-suggestion-index="${index}">
                        ${suggestion}
                    </button>
                `).join('')}
            </div>
        `;
        
        suggestionsContainer.innerHTML = suggestionsHtml;
        
        // Add event listeners to avoid syntax errors
        const suggestionButtons = suggestionsContainer.querySelectorAll('.suggestion-btn');
        suggestionButtons.forEach((button, index) => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.fillQuery(suggestions[index]);
            });
        });
    }
    
    fillQuery(query) {
        const queryInput = document.getElementById('queryInput');
        if (queryInput) {
            queryInput.value = query;
            queryInput.focus();
        }
    }
    
    async processQuery() {
        const queryInput = document.getElementById('queryInput');
        if (!queryInput || !queryInput.value.trim()) {
            this.showMessage('Please enter a query.', 'warning');
            return;
        }
        
        if (!this.csvData) {
            this.showMessage('Please upload a CSV file first.', 'warning');
            return;
        }

        // Prevent multiple concurrent queries
        if (this.isProcessing) {
            this.showMessage('Please wait for the current query to finish processing.', 'info');
            return;
        }
        
        const query = queryInput.value.trim();
        
        // Check cache first
        const cacheKey = this.getCacheKey('processQuery', { query, dataSize: this.csvData.length });
        const cachedResult = this.getCache(cacheKey);
        
        if (cachedResult) {
            console.log('Using cached query result');
            this.displayResults(cachedResult.result, query);
            if (cachedResult.aiSummary) {
                this.displayAISummary(cachedResult.aiSummary);
            }
            this.showMessage('Query processed successfully! (from cache)', 'success');
            return;
        }

        this.isProcessing = true;
        this.showLoading(true, 'Processing your query...');
        
        try {
            let result = null;
            let aiSummary = null;
            
            // Wait for AI service to be ready
            const aiService = await this.waitForAIService();
            
            if (aiService && aiService.hasValidApiKey()) {
                // Use duplicate check for AI requests
                const analysisResult = await this.executeWithDuplicateCheck(
                    `analyzeQuery_${query}`,
                    () => aiService.analyzeQueryWithStructure(this.csvData, query)
                );
                
                if (analysisResult && analysisResult.success) {
                    const queryStructure = analysisResult.analysis;
                    console.log('AI Query Structure:', queryStructure);
                    
                    result = await this.executeStructuredQuery(queryStructure, query);
                    
                    if (result) {
                        // Generate AI summary with duplicate check
                        this.showLoading(true, 'Generating AI insights...');
                        aiSummary = await this.executeWithDuplicateCheck(
                            `generateSummary_${query}`,
                            () => this.generateResultSummary(result, query, queryStructure)
                        );
                        result.aiSummary = aiSummary;
                        result.queryStructure = queryStructure;
                    }
                }
            }
            
            // Fallback to pattern matching if AI fails or no API key
            if (!result) {
                console.log('Using pattern matching fallback');
                this.showLoading(true, 'Analyzing query patterns...');
                result = this.parseQuery(query);
            
                if (result && aiService && aiService.hasValidApiKey()) {
                    aiSummary = await this.executeWithDuplicateCheck(
                        `generateBasicSummary_${query}`,
                        () => this.generateBasicResultSummary(result, query)
                    );
                    result.aiSummary = aiSummary;
                }
            }
            
            if (result && result.data) {
                // Cache the result
                this.setCache(cacheKey, { result, aiSummary });
                
                this.displayResults(result, query);
                this.showMessage('Query processed successfully!', 'success');
            } else {
                this.showMessage('Could not process your query. Please try rephrasing it.', 'error');
            }
        } catch (error) {
            console.error('Query processing error:', error);
            this.showMessage('Error processing query: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
            this.isProcessing = false;
        }
    }

    updatePagination(totalRows) {
        const pagination = document.getElementById('pagination');
        if (!pagination) return;

        const totalPages = Math.ceil(totalRows / this.rowsPerPage);
        if (totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }

        let paginationHtml = '<div class="pagination-controls">';
        
        // Previous button
        if (this.currentPage > 1) {
            paginationHtml += `<button class="btn btn--secondary pagination-btn" onclick="dashboard.goToPage(${this.currentPage - 1})">Previous</button>`;
        }

        // Page numbers
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);

        if (startPage > 1) {
            paginationHtml += `<button class="btn btn--secondary pagination-btn" onclick="dashboard.goToPage(1)">1</button>`;
            if (startPage > 2) {
                paginationHtml += '<span class="pagination-ellipsis">...</span>';
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === this.currentPage ? ' active' : '';
            paginationHtml += `<button class="btn btn--secondary pagination-btn${activeClass}" onclick="dashboard.goToPage(${i})">${i}</button>`;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHtml += '<span class="pagination-ellipsis">...</span>';
            }
            paginationHtml += `<button class="btn btn--secondary pagination-btn" onclick="dashboard.goToPage(${totalPages})">${totalPages}</button>`;
        }

        // Next button
        if (this.currentPage < totalPages) {
            paginationHtml += `<button class="btn btn--secondary pagination-btn" onclick="dashboard.goToPage(${this.currentPage + 1})">Next</button>`;
        }

        paginationHtml += '</div>';
        paginationHtml += `<div class="pagination-info">Showing ${Math.min(totalRows, this.rowsPerPage)} of ${totalRows} records</div>`;

        pagination.innerHTML = paginationHtml;
    }

    goToPage(page) {
        this.currentPage = page;
        this.updateTable(this.filteredData || this.csvData);
    }

    // New method for distribution analysis
    performDistribution(column) {
        if (!this.csvData || !column) return null;
        
        const values = this.csvData.map(row => row[column]).filter(val => val);
        const isNumeric = values.some(val => !isNaN(parseFloat(val)));
        
        if (isNumeric) {
            // Numeric distribution - create bins
            const numericValues = values.map(val => parseFloat(val)).filter(val => !isNaN(val));
            const min = Math.min(...numericValues);
            const max = Math.max(...numericValues);
            const binCount = Math.min(10, Math.ceil(Math.sqrt(numericValues.length)));
            const binSize = (max - min) / binCount;
            
            const bins = Array(binCount).fill(0).map((_, i) => ({
                range: `${(min + i * binSize).toFixed(1)}-${(min + (i + 1) * binSize).toFixed(1)}`,
                count: 0,
                min: min + i * binSize,
                max: min + (i + 1) * binSize
            }));
            
            numericValues.forEach(val => {
                const binIndex = Math.min(Math.floor((val - min) / binSize), binCount - 1);
                bins[binIndex].count++;
            });
            
            return {
                type: 'distribution',
                data: bins,
                column: column,
                chartType: 'histogram',
                summary: `Distribution of ${column}: ${numericValues.length} values from ${min.toFixed(2)} to ${max.toFixed(2)}`
            };
        } else {
            // Categorical distribution
            const counts = {};
            values.forEach(val => {
                counts[val] = (counts[val] || 0) + 1;
            });
            
            const data = Object.entries(counts)
                .sort(([,a], [,b]) => b - a)
                .map(([value, count]) => ({ category: value, count }));
            
            return {
                type: 'distribution',
                data: data,
                column: column,
                chartType: 'bar',
                summary: `Distribution of ${column}: ${Object.keys(counts).length} unique values`
            };
        }
    }

    // New method for trend analysis
    performTrend(columns) {
        if (!this.csvData || columns.length < 2) return null;
        
        const [xColumn, yColumn] = columns;
        const data = this.csvData
            .filter(row => row[xColumn] && row[yColumn])
            .map(row => ({
                x: row[xColumn],
                y: parseFloat(row[yColumn]) || row[yColumn]
            }))
            .sort((a, b) => {
                if (typeof a.x === 'string' && a.x.match(/\d{4}/)) {
                    return new Date(a.x) - new Date(b.x);
                }
                return a.x - b.x;
            });
        
        return {
            type: 'trend',
            data: data,
            columns: [xColumn, yColumn],
            chartType: 'line',
            summary: `Trend analysis of ${yColumn} over ${xColumn}: ${data.length} data points`
        };
    }

    // New method for filtering
    performFilter(columns, conditions) {
        if (!this.csvData || columns.length === 0) return null;
        
        // Simple filter implementation - can be enhanced based on conditions
        const filteredData = this.csvData.filter(row => {
            return columns.every(col => row[col] && row[col].toString().trim());
        });
        
        return {
            type: 'filter',
            data: filteredData.slice(0, 100), // Limit to first 100 results
            columns: columns,
            chartType: 'bar',
            summary: `Filtered data: ${filteredData.length} records match the criteria`
        };
    }
    
    determineChartType(query, analysis) {
        if (analysis?.queryStructure?.chartType) {
            return analysis.queryStructure.chartType;
        }
        
        const lowerQuery = query.toLowerCase();
        if (lowerQuery.includes('trend') || lowerQuery.includes('over time')) return 'line';
        if (lowerQuery.includes('distribution')) return 'histogram';
        if (lowerQuery.includes('correlation')) return 'scatter';
        if (lowerQuery.includes('group') || lowerQuery.includes('category')) return 'bar';
        if (lowerQuery.includes('pie') || lowerQuery.includes('proportion')) return 'pie';
        return 'bar';
    }
    
    async updateKPIs() {
        if (!this.csvData) return;
        
        try {
            // Wait for AI service to be ready before trying to get KPIs
            const aiService = await this.waitForAIService();
            
            if (!aiService || !aiService.hasValidApiKey()) {
                console.log('No AI service or API key available, skipping KPI generation');
                return;
            }
            
            const result = await aiService.getKPIs(this.csvData);
            if (result.success && result.kpis.length > 0) {
                this.displayKPIs(result.kpis);
            }
        } catch (error) {
            console.error('Error updating KPIs:', error);
        }
    }
    
    displayKPIs(kpis) {
        const kpiContainer = document.getElementById('kpiContainer');
        if (!kpiContainer) return;
        
        const kpiHtml = kpis.map(kpi => `
            <div class="kpi-card">
                <div class="kpi-value">${kpi.value}</div>
                <div class="kpi-label">${kpi.name}</div>
                <div class="kpi-insight">${kpi.insight}</div>
            </div>
        `).join('');

        kpiContainer.innerHTML = kpiHtml;
        
        // Show KPI section
        const kpiSection = document.getElementById('kpiSection');
        if (kpiSection) {
            kpiSection.style.display = 'block';
        }
    }

    displayResults(result, query) {
        console.log('Displaying results:', result);
        this.filteredData = result.data || this.csvData;
        
        // Store query structure for chart rendering
        this.currentQueryStructure = result.queryStructure || null;
        
        // Display AI summary if available
        if (result.aiSummary) {
            this.displayAISummary(result.aiSummary);
        }
        
        // Add query to history
        this.queryHistory.unshift(query);
        this.updateQueryHistory();
        
        this.updateTable(this.filteredData);
        this.updateSummary(result);
        this.updateChartInfo(result, query);
        
        // Switch to chart tab to show results
        this.switchTab('chart');
    }

    // Enhanced method to display AI summary
    displayAISummary(summary) {
        if (!summary) return;
        
        const summaryContainer = document.getElementById('aiSummaryContainer') || this.createAISummaryContainer();
        if (!summaryContainer) return;
        
        const summaryHtml = `
                <div class="ai-summary-card">
                    <div class="ai-summary-header">
                    <div class="ai-summary-icon">🤖</div>
                    <div class="ai-summary-title">
                        <h4>AI Analysis Summary</h4>
                    </div>
                </div>
                <div class="ai-summary-content">
                    <div class="ai-summary-text">${summary}</div>
                </div>
                <div class="ai-summary-footer">
                    <small>💡 This summary was generated by AI to help you understand your data insights</small>
                </div>
                </div>
            `;
        
        summaryContainer.innerHTML = summaryHtml;
            summaryContainer.style.display = 'block';
        
        // Scroll to show the summary
        setTimeout(() => {
            summaryContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    }

    // Enhanced method to create AI summary container
    createAISummaryContainer() {
        const chartTab = document.getElementById('chartTab');
        if (!chartTab) return null;
        
        let summaryContainer = document.getElementById('aiSummaryContainer');
        if (!summaryContainer) {
            summaryContainer = document.createElement('div');
            summaryContainer.id = 'aiSummaryContainer';
            summaryContainer.className = 'ai-summary-container';
            summaryContainer.style.display = 'none';
            
            // Insert before chart container
            const chartContainer = document.getElementById('chartContainer');
            if (chartContainer) {
                chartTab.insertBefore(summaryContainer, chartContainer);
            } else {
                chartTab.appendChild(summaryContainer);
            }
        }
        return summaryContainer;
    }

    updateSummary(result) {
        const summaryStats = document.getElementById('summaryStats');
        if (!summaryStats) return;

        let summaryHtml = '';
        
        if (result && result.data) {
            const data = result.data;
            const columns = Object.keys(data[0] || {});
            
            // Basic statistics
            summaryHtml += `
                <div class="summary-section">
                    <h4>📊 Data Overview</h4>
                    <div class="summary-grid">
                        <div class="summary-item">
                            <span class="summary-label">Total Records:</span>
                            <span class="summary-value">${data.length.toLocaleString()}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Columns:</span>
                            <span class="summary-value">${columns.length}</span>
                        </div>
                    </div>
                </div>
            `;

            // Column-specific statistics
            if (result.column) {
                const columnData = data.map(row => row[result.column]).filter(val => val != null && val !== '');
                const uniqueValues = [...new Set(columnData)];
                
                summaryHtml += `
                    <div class="summary-section">
                        <h4>📈 Column Analysis: ${result.column}</h4>
                        <div class="summary-grid">
                            <div class="summary-item">
                                <span class="summary-label">Values:</span>
                                <span class="summary-value">${columnData.length}</span>
                            </div>
                            <div class="summary-item">
                                <span class="summary-label">Unique:</span>
                                <span class="summary-value">${uniqueValues.length}</span>
                            </div>
                        </div>
                    </div>
                `;
                
                // Numeric statistics if applicable
                const numericValues = columnData.map(val => parseFloat(val)).filter(val => !isNaN(val));
                if (numericValues.length > 0) {
                    const avg = numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length;
                    const min = Math.min(...numericValues);
                    const max = Math.max(...numericValues);
                    
                    summaryHtml += `
                        <div class="summary-section">
                            <h4>🔢 Numeric Statistics</h4>
                            <div class="summary-grid">
                                <div class="summary-item">
                                    <span class="summary-label">Average:</span>
                                    <span class="summary-value">${avg.toFixed(2)}</span>
                                </div>
                                <div class="summary-item">
                                    <span class="summary-label">Min:</span>
                                    <span class="summary-value">${min}</span>
                                </div>
                                <div class="summary-item">
                                    <span class="summary-label">Max:</span>
                                    <span class="summary-value">${max}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }
            }

            // Query result summary
            if (result.summary) {
                summaryHtml += `
                    <div class="summary-section">
                        <h4>💡 Query Results</h4>
                        <p class="summary-description">${result.summary}</p>
                    </div>
                `;
            }
        } else {
            summaryHtml = `
                <div class="summary-section">
                    <h4>📋 No Results</h4>
                    <p class="summary-description">No data available to summarize.</p>
                </div>
            `;
        }
        
        summaryStats.innerHTML = summaryHtml;
    }

    // Enhanced method to generate AI summary of results
    async generateResultSummary(result, query, queryStructure) {
        try {
            // Wait for AI service to be ready
            const aiService = await this.waitForAIService();
            
            if (!aiService || !aiService.hasValidApiKey()) {
                return this.generateFallbackSummary(result, query);
            }
            
            const data = result.data;
            const dataPreview = Array.isArray(data) ? data.slice(0, 10) : [data];
            
            const summaryPrompt = `
            Analyze these query results and provide a concise, business-friendly summary in exactly 150-200 words:
            
            Original Query: "${query}"
            Query Type: ${queryStructure?.queryType || result.type || 'analysis'}
                            Chart Type: ${result.chartType || 'bar'}
            
            Results Summary:
            - Total Records Analyzed: ${Array.isArray(data) ? data.length : 1}
            - Result Type: ${result.type || 'data analysis'}
            ${result.summary ? `- Key Finding: ${result.summary}` : ''}
            
            Sample Results:
            ${JSON.stringify(dataPreview, null, 2)}
            
            Provide insights that include:
            1. What the analysis reveals (key findings)
            2. Notable patterns, trends, or outliers
            3. Business implications or actionable recommendations
            4. Context about data quality or limitations if relevant
            
            Write in clear, professional language suitable for business stakeholders. Focus on practical insights and avoid technical jargon.`;
            
            const summary = await aiService.generateResultSummary(summaryPrompt);
            return summary || this.generateFallbackSummary(result, query);
        } catch (error) {
            console.error('Error generating result summary:', error);
            return this.generateFallbackSummary(result, query);
        }
    }

    // Method to generate basic AI summary for pattern-matched queries
    async generateBasicResultSummary(result, query) {
        try {
            // Wait for AI service to be ready
            const aiService = await this.waitForAIService();
            
            if (!aiService || !aiService.hasValidApiKey()) {
                return this.generateFallbackSummary(result, query);
            }

            const summaryPrompt = `
            Provide a brief business summary (150-200 words) for this data analysis:
            
            Query: "${query}"
            Analysis Type: ${result.type}
            Result: ${result.summary || 'Analysis completed'}
            Data Points: ${Array.isArray(result.data) ? result.data.length : 1}
            
            Focus on:
            1. What this analysis tells us
            2. Key business insights
            3. Practical implications
            4. Recommendations for action
            
            Keep it concise and business-focused.`;

            const summary = await aiService.generateResultSummary(summaryPrompt);
            return summary || this.generateFallbackSummary(result, query);
        } catch (error) {
            console.error('Error generating basic summary:', error);
            return this.generateFallbackSummary(result, query);
        }
    }

    // Fallback summary generation without AI
    generateFallbackSummary(result, query) {
        const dataCount = Array.isArray(result.data) ? result.data.length : 1;
        const analysisType = result.type || 'analysis';
        
        let summary = `Analysis completed for query: "${query}". `;
        
        switch (analysisType) {
            case 'aggregate':
                summary += `Calculated ${result.operation} of ${result.column}: ${result.result?.toFixed(2) || 'N/A'}. `;
                summary += `This provides insight into the central tendency of your ${result.column} data. `;
                break;
            case 'group':
                summary += `Data grouped by ${result.column} showing ${dataCount} categories. `;
                summary += `This segmentation helps identify patterns and differences across groups. `;
                break;
            case 'correlation':
                summary += `Analyzed relationship between ${result.col1} and ${result.col2} using ${dataCount} data points. `;
                summary += `Correlation analysis helps understand how these variables relate to each other. `;
                break;
            case 'sort':
                summary += `Identified top ${result.count || dataCount} records by ${result.column}. `;
                summary += `This ranking helps prioritize and identify high-performing items. `;
                break;
            default:
                summary += `Processed ${dataCount} records for analysis. `;
                summary += `The results provide valuable insights into your data patterns. `;
        }
        
        summary += `Review the chart and table views for detailed findings. Consider exploring related questions to gain deeper insights.`;
        
        return summary;
    }

    // Missing utility methods
    setupChatInterface() {
        // Chat interface setup - placeholder for future chat functionality
        console.log('Chat interface setup completed');
    }

    showLoading(show, message = 'Loading...') {
        const loadingOverlay = document.getElementById('loadingOverlay');
        const loadingText = document.getElementById('loadingText');
        
        if (loadingOverlay) {
            if (show) {
                loadingOverlay.style.display = 'flex';
                if (loadingText) loadingText.textContent = message;
            } else {
                loadingOverlay.style.display = 'none';
            }
        }
    }

    showMessage(message, type = 'info') {
        const messageToast = document.getElementById('messageToast');
        const messageText = document.getElementById('messageText');
        
        if (messageToast && messageText) {
            messageText.textContent = message;
            messageToast.className = `message-toast message-toast--${type}`;
            messageToast.style.display = 'block';
            
            // Auto hide after 5 seconds
            setTimeout(() => {
                messageToast.style.display = 'none';
            }, 5000);
        }
    }

    switchTab(tabName) {
        // Remove active class from all tabs and content
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // Add active class to selected tab and content
        const selectedTab = document.querySelector(`[data-tab="${tabName}"]`);
        const selectedContent = document.getElementById(`${tabName}Tab`);
        
        if (selectedTab) selectedTab.classList.add('active');
        if (selectedContent) selectedContent.classList.add('active');
    }

    updateTable(data) {
        const tableContainer = document.getElementById('tableContainer');
        if (!tableContainer || !data || data.length === 0) return;

        const columns = Object.keys(data[0]);
        const startIndex = (this.currentPage - 1) * this.rowsPerPage;
        const endIndex = startIndex + this.rowsPerPage;
        const pageData = data.slice(startIndex, endIndex);

        let tableHtml = `
            <table class="data-table">
                <thead>
                    <tr>
                        ${columns.map(col => `<th>${col}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${pageData.map(row => `
                        <tr>
                            ${columns.map(col => {
                                let value = row[col];
                                if (value === null || value === undefined || value === '') {
                                    value = '<span class="null-value">—</span>';
                                } else if (typeof value === 'number') {
                                    value = value.toLocaleString();
                                }
                                return `<td>${value}</td>`;
                            }).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        tableContainer.innerHTML = tableHtml;
        this.updatePagination(data.length);
    }

    updateChartInfo(result, query) {
        const chartInfo = document.getElementById('chartInfo');
        if (!chartInfo) return;

        // First render the chart
        this.renderChart(result);

        let chartInfoHtml = '';
        
        // Add chart explanation if available from AI analysis
        if (result.queryStructure?.chartExplanation) {
            const explanation = result.queryStructure.chartExplanation;
            chartInfoHtml += `
                <div class="chart-explanation">
                    <h4>📊 Chart Guide</h4>
                    <div class="chart-explanation-grid">
                        <div class="explanation-item">
                            <strong>X-Axis:</strong> ${explanation.xAxisMeaning || 'Categories or groups'}
                        </div>
                        <div class="explanation-item">
                            <strong>Y-Axis:</strong> ${explanation.yAxisMeaning || 'Values being measured'}
                        </div>
                        <div class="explanation-item">
                            <strong>Data Points:</strong> ${explanation.dataInterval || 'Individual records'}
                        </div>
                        <div class="explanation-item">
                            <strong>How to Read:</strong> ${explanation.howToRead || 'Compare values across categories'}
                        </div>
                    </div>
                </div>
            `;
        }

        // Add basic chart information
        chartInfoHtml += `
            <div class="chart-basic-info">
                <h4>📈 Chart Information</h4>
                <div class="chart-info-grid">
                    <div class="info-item">
                        <span class="info-label">Query:</span>
                        <span class="info-value">${query}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Chart Type:</span>
                        <span class="info-value">${result.chartType || 'Bar Chart'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Data Points:</span>
                        <span class="info-value">${Array.isArray(result.data) ? result.data.length : 1}</span>
                    </div>
                </div>
            </div>
        `;

        chartInfo.innerHTML = chartInfoHtml;
    }

    renderChart(result) {
        const canvas = document.getElementById('resultsChart');
        const container = document.getElementById('chartContainer');
        
        if (!canvas || !container) return;

        // Destroy existing chart if it exists
        if (this.currentChart) {
            this.currentChart.destroy();
            this.currentChart = null;
        }

        // If chart type is table, hide canvas and show table instead
        if (!result.data || result.data.length === 0) {
            canvas.style.display = 'none';
            container.innerHTML = '<div class="no-chart-message">📊 No data available for visualization</div>';
            return;
        }

        canvas.style.display = 'block';
        const ctx = canvas.getContext('2d');

        try {
            const chartConfig = this.getChartConfig(result);
            this.currentChart = new Chart(ctx, chartConfig);
        } catch (error) {
            console.error('Error rendering chart:', error);
            container.innerHTML = '<div class="chart-error">⚠️ Unable to render chart. Please try a different visualization.</div>';
        }
    }

    getChartConfig(result) {
        const { chartType, data } = result;
        
        // Generate beautiful color palettes
        const colors = this.getColorPalette(data.length);
        
        switch (chartType) {
            case 'bar':
                return this.createBarChart(data, colors);
            case 'line':
                return this.createLineChart(data, colors);
            case 'pie':
                return this.createPieChart(data, colors);
            case 'doughnut':
                return this.createDoughnutChart(data, colors);
            case 'scatter':
                return this.createScatterChart(data, colors);
            case 'bubble':
                return this.createBubbleChart(data, colors);
            case 'radar':
                return this.createRadarChart(data, colors);
            case 'polarArea':
                return this.createPolarAreaChart(data, colors);
            case 'histogram':
                return this.createHistogramChart(data, colors);
            default:
                return this.createBarChart(data, colors);
        }
    }

    getColorPalette(count) {
        // Modern, accessible color palette
        const baseColors = [
            '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
            '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
            '#14B8A6', '#F43F5E', '#8B5CF6', '#22C55E', '#EAB308'
        ];
        
        const colors = [];
        for (let i = 0; i < count; i++) {
            colors.push(baseColors[i % baseColors.length]);
        }
        
        return colors;
    }

    createBarChart(data, colors) {
        // Get axis labels from query structure if available
        let xAxisLabel = 'Category';
        let yAxisLabel = 'Value';
        let chartTitle = 'Data Visualization';
        
        // Check if we have query structure with proper labels
        if (this.currentQueryStructure) {
            xAxisLabel = this.currentQueryStructure.xAxisLabel || xAxisLabel;
            yAxisLabel = this.currentQueryStructure.yAxisLabel || yAxisLabel;
            chartTitle = this.currentQueryStructure.chartTitle || chartTitle;
        }

        const labels = data.map(item => {
            // Find the most appropriate label field
            const keys = Object.keys(item);
            const labelKey = keys.find(key => 
                typeof item[key] === 'string' || 
                key.toLowerCase().includes('name') || 
                key.toLowerCase().includes('category') ||
                key.toLowerCase().includes('group') ||
                key.toLowerCase().includes('day') ||
                key.toLowerCase().includes('week') ||
                key.toLowerCase().includes('month')
            ) || keys[0];
            return item[labelKey];
        });

        const values = data.map(item => {
            // Find the most appropriate numeric field
            const keys = Object.keys(item);
            const valueKey = keys.find(key => 
                typeof item[key] === 'number' || 
                !isNaN(parseFloat(item[key]))
            );
            return parseFloat(item[valueKey]) || 0;
        });

        return {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: yAxisLabel,
                    data: values,
                    backgroundColor: colors.map(color => color + '80'), // Add transparency
                    borderColor: colors,
                    borderWidth: 2,
                    borderRadius: 8,
                    borderSkipped: false,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: chartTitle,
                        font: {
                            size: 16,
                            weight: 'bold'
                        },
                        padding: 20
                    },
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            title: function(context) {
                                return context[0].label;
                            },
                            label: function(context) {
                                return `${yAxisLabel}: ${context.parsed.y}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: yAxisLabel,
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            color: '#6B7280'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: xAxisLabel,
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#6B7280',
                            maxRotation: 45
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeInOutQuart'
                }
            }
        };
    }

    createLineChart(data, colors) {
        // Get axis labels from query structure if available
        let xAxisLabel = 'Category';
        let yAxisLabel = 'Value';
        let chartTitle = 'Trend Analysis';
        
        // Check if we have query structure with proper labels
        if (this.currentQueryStructure) {
            xAxisLabel = this.currentQueryStructure.xAxisLabel || xAxisLabel;
            yAxisLabel = this.currentQueryStructure.yAxisLabel || yAxisLabel;
            chartTitle = this.currentQueryStructure.chartTitle || chartTitle;
        }

        const labels = data.map((item, index) => {
            const keys = Object.keys(item);
            const labelKey = keys.find(key => 
                typeof item[key] === 'string' || 
                key.toLowerCase().includes('date') || 
                key.toLowerCase().includes('time') ||
                key.toLowerCase().includes('day') ||
                key.toLowerCase().includes('week') ||
                key.toLowerCase().includes('month')
            ) || index.toString();
            return item[labelKey] || index;
        });

        const values = data.map(item => {
            const keys = Object.keys(item);
            const valueKey = keys.find(key => 
                typeof item[key] === 'number' || 
                !isNaN(parseFloat(item[key]))
            );
            return parseFloat(item[valueKey]) || 0;
        });

        return {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: yAxisLabel,
                    data: values,
                    borderColor: colors[0],
                    backgroundColor: colors[0] + '20',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: colors[0],
                    pointBorderColor: '#FFFFFF',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: chartTitle,
                        font: {
                            size: 16,
                            weight: 'bold'
                        },
                        padding: 20
                    },
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            title: function(context) {
                                return context[0].label;
                            },
                            label: function(context) {
                                return `${yAxisLabel}: ${context.parsed.y}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: yAxisLabel,
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            color: '#6B7280'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: xAxisLabel,
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            color: '#6B7280',
                            maxRotation: 45
                        }
                    }
                },
                animation: {
                    duration: 1500,
                    easing: 'easeInOutQuart'
                }
            }
        };
    }

    createPieChart(data, colors) {
        // Get chart title from query structure if available
        let chartTitle = 'Distribution';
        
        // Check if we have query structure with proper labels
        if (this.currentQueryStructure) {
            chartTitle = this.currentQueryStructure.chartTitle || chartTitle;
        }

        const labels = data.map(item => {
            const keys = Object.keys(item);
            const labelKey = keys.find(key => 
                typeof item[key] === 'string' || 
                key.toLowerCase().includes('name') || 
                key.toLowerCase().includes('category') ||
                key.toLowerCase().includes('group') ||
                key.toLowerCase().includes('day') ||
                key.toLowerCase().includes('week')
            ) || keys[0];
            return item[labelKey];
        });

        const values = data.map(item => {
            const keys = Object.keys(item);
            const valueKey = keys.find(key => 
                typeof item[key] === 'number' || 
                !isNaN(parseFloat(item[key]))
            );
            return parseFloat(item[valueKey]) || 0;
        });

        return {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderColor: '#FFFFFF',
                    borderWidth: 3,
                    hoverBorderWidth: 4,
                    hoverBorderColor: '#FFFFFF'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: chartTitle,
                        font: {
                            size: 16,
                            weight: 'bold'
                        },
                        padding: 20
                    },
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${context.parsed} (${percentage}%)`;
                            }
                        }
                    }
                },
                animation: {
                    animateRotate: true,
                    animateScale: true,
                    duration: 1500
                }
            }
        };
    }

    createDoughnutChart(data, colors) {
        const config = this.createPieChart(data, colors);
        config.type = 'doughnut';
        config.options.plugins.legend.position = 'bottom';
        return config;
    }

    createScatterChart(data, colors) {
        const processedData = data.map(item => {
            const keys = Object.keys(item);
            const xKey = keys.find(key => key.includes('x') || typeof item[key] === 'number') || keys[0];
            const yKey = keys.find(key => key.includes('y') || (key !== xKey && typeof item[key] === 'number')) || keys[1];
            
            return {
                x: parseFloat(item[xKey]) || 0,
                y: parseFloat(item[yKey]) || 0
            };
        });

        return {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Data Points',
                    data: processedData,
                    backgroundColor: colors[0] + '80',
                    borderColor: colors[0],
                    borderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        borderWidth: 1,
                        cornerRadius: 8
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            color: '#6B7280'
                        }
                    },
                    x: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            color: '#6B7280'
                        }
                    }
                },
                animation: {
                    duration: 1000
                }
            }
        };
    }

    createBubbleChart(data, colors) {
        const processedData = data.map((item, index) => {
            const keys = Object.keys(item);
            const xKey = keys.find(key => key.includes('x') || typeof item[key] === 'number') || keys[0];
            const yKey = keys.find(key => key.includes('y') || (key !== xKey && typeof item[key] === 'number')) || keys[1];
            const rKey = keys.find(key => key.includes('r') || key.includes('size') || (key !== xKey && key !== yKey && typeof item[key] === 'number')) || keys[2];
            
            return {
                x: parseFloat(item[xKey]) || 0,
                y: parseFloat(item[yKey]) || 0,
                r: Math.max(5, (parseFloat(item[rKey]) || 10) / 2)
            };
        });

        return {
            type: 'bubble',
            data: {
                datasets: [{
                    label: 'Bubble Data',
                    data: processedData,
                    backgroundColor: colors.map(color => color + '60'),
                    borderColor: colors,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        borderWidth: 1,
                        cornerRadius: 8
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            color: '#6B7280'
                        }
                    },
                    x: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            color: '#6B7280'
                        }
                    }
                },
                animation: {
                    duration: 1200
                }
            }
        };
    }

    createRadarChart(data, colors) {
        const labels = Object.keys(data[0] || {}).filter(key => 
            typeof data[0][key] === 'number' || !isNaN(parseFloat(data[0][key]))
        );

        const datasets = data.slice(0, 3).map((item, index) => {
            const values = labels.map(label => parseFloat(item[label]) || 0);
            return {
                label: item.name || `Series ${index + 1}`,
                data: values,
                backgroundColor: colors[index] + '30',
                borderColor: colors[index],
                borderWidth: 2,
                pointBackgroundColor: colors[index],
                pointBorderColor: '#FFFFFF',
                pointRadius: 4
            };
        });

        return {
            type: 'radar',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            color: '#374151'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        borderWidth: 1,
                        cornerRadius: 8
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        pointLabels: {
                            color: '#6B7280'
                        },
                        ticks: {
                            color: '#6B7280'
                        }
                    }
                },
                animation: {
                    duration: 1000
                }
            }
        };
    }

    createPolarAreaChart(data, colors) {
        const config = this.createPieChart(data, colors);
        config.type = 'polarArea';
        config.options.scales = {
            r: {
                beginAtZero: true,
                grid: {
                    color: 'rgba(0, 0, 0, 0.1)'
                },
                ticks: {
                    color: '#6B7280'
                }
            }
        };
        return config;
    }

    createHistogramChart(data, colors) {
        // For histogram, we need to bin the data
        const values = data.map(item => {
            const keys = Object.keys(item);
            const valueKey = keys.find(key => typeof item[key] === 'number') || keys[0];
            return parseFloat(item[valueKey]) || 0;
        });

        // Create bins
        const min = Math.min(...values);
        const max = Math.max(...values);
        const binCount = Math.min(10, Math.ceil(Math.sqrt(values.length)));
        const binWidth = (max - min) / binCount;
        
        const bins = Array(binCount).fill(0);
        const binLabels = [];
        
        for (let i = 0; i < binCount; i++) {
            const binStart = min + i * binWidth;
            const binEnd = min + (i + 1) * binWidth;
            binLabels.push(`${binStart.toFixed(1)}-${binEnd.toFixed(1)}`);
        }
        
        values.forEach(value => {
            const binIndex = Math.min(Math.floor((value - min) / binWidth), binCount - 1);
            bins[binIndex]++;
        });

        return {
            type: 'bar',
            data: {
                labels: binLabels,
                datasets: [{
                    label: 'Frequency',
                    data: bins,
                    backgroundColor: colors[0] + '80',
                    borderColor: colors[0],
                    borderWidth: 2,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        borderWidth: 1,
                        cornerRadius: 8
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Frequency',
                            color: '#6B7280'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            color: '#6B7280'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Value Range',
                            color: '#6B7280'
                        },
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#6B7280',
                            maxRotation: 45
                        }
                    }
                },
                animation: {
                    duration: 1000
                }
            }
        };
    }

    updateQueryHistory() {
        const historyList = document.getElementById('historyList');
        if (!historyList) return;

        const recentQueries = this.queryHistory.slice(0, 5);
        
        if (recentQueries.length === 0) {
            historyList.innerHTML = '<p class="no-history">No queries yet</p>';
            return;
        }
        
        const historyHtml = recentQueries.map((historyItem, index) => `
            <div class="history-item" data-query-index="${index}">
                ${typeof historyItem === 'string' ? historyItem : historyItem.query}
            </div>
        `).join('');

        historyList.innerHTML = historyHtml;
        
        // Add event listeners to avoid syntax errors
        const historyItems = historyList.querySelectorAll('.history-item');
        historyItems.forEach((item, index) => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const historyItem = recentQueries[index];
                const query = typeof historyItem === 'string' ? historyItem : historyItem.query;
                this.fillQuery(query);
            });
        });
    }

    searchTable(searchTerm) {
        if (!this.csvData) return;

        if (!searchTerm.trim()) {
            this.filteredData = null;
            this.updateTable(this.csvData);
            return;
        }

        const filtered = this.csvData.filter(row => {
            return Object.values(row).some(value => 
                value && value.toString().toLowerCase().includes(searchTerm.toLowerCase())
            );
        });

        this.filteredData = filtered;
        this.currentPage = 1;
        this.updateTable(filtered);
    }

    exportData() {
        const dataToExport = this.filteredData || this.csvData;
        if (!dataToExport || dataToExport.length === 0) {
            this.showMessage('No data to export', 'warning');
            return;
        }

        const csv = Papa.unparse(dataToExport);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', 'exported_data.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            this.showMessage('Data exported successfully!', 'success');
        }
    }

    async executeStructuredQuery(queryStructure, originalQuery) {
        try {
            const { queryType, targetColumns, operation, filterConditions, chartType } = queryStructure;
            
            // Check if we need advanced data processing
            if (queryStructure.dataTransformation) {
                return await this.processAdvancedQuery(queryStructure, originalQuery);
            }
            
            // Default result structure
            let result = {
                type: queryType,
                data: [],
                chartType: chartType || 'bar',
                summary: '',
                queryStructure: queryStructure
            };

            // Execute the appropriate analysis method
            let analysisResult = null;
            
            switch (queryType) {
                case 'aggregation':
                    analysisResult = await this.performAggregation(targetColumns?.[0], operation);
                    break;
                case 'groupby':
                    analysisResult = await this.performGroupBy(targetColumns?.[0], targetColumns?.[1]);
                    break;
                case 'filter':
                    analysisResult = await this.performFilter(targetColumns || [], filterConditions || {});
                    break;
                case 'correlation':
                    analysisResult = await this.performCorrelation(targetColumns?.[0], targetColumns?.[1]);
                    break;
                case 'trend':
                    analysisResult = await this.performTrend(targetColumns || []);
                    break;
                case 'distribution':
                    analysisResult = await this.performDistribution(targetColumns?.[0]);
                    break;
                default:
                    analysisResult = await this.performFilter(targetColumns || [], {});
            }

            // Handle null results gracefully
            if (analysisResult && analysisResult.data) {
                result = {
                    ...result,
                    ...analysisResult,
                    chartType: chartType || analysisResult.chartType || 'bar',
                    queryStructure: queryStructure
                };
            } else {
                // Fallback for failed analysis
                result = {
                    ...result,
                    data: this.csvData.slice(0, 20),
                    chartType: 'bar',
                    summary: `Could not process "${originalQuery}" - showing sample data instead`,
                    error: 'Analysis failed - check column names and data types'
                };
            }

            return result;
        } catch (error) {
            console.error('Error executing structured query:', error);
            
            // Return a safe fallback result instead of null
            return {
                type: 'filter',
                data: this.csvData.slice(0, 20),
                chartType: 'bar',
                summary: `Error processing query: ${error.message}`,
                error: error.message,
                queryStructure: queryStructure
            };
        }
    }

    async processAdvancedQuery(queryStructure, originalQuery) {
        try {
            console.log('🔍 Processing advanced query:', originalQuery);
            console.log('📋 Query structure:', queryStructure);
            
            const { dataTransformation, visualization } = queryStructure;
            let processedData = [...this.csvData];
            
            // Validate we have data
            if (!processedData || processedData.length === 0) {
                throw new Error('No data available for processing');
            }
            
            const availableColumns = Object.keys(processedData[0]);
            console.log('📊 Available columns:', availableColumns);
            
            // Data validation and column mapping
            const columnMapping = {};
            
            // Step 1: Extract day of week if needed
            if (dataTransformation.extractDayOfWeek) {
                const dateColumnName = dataTransformation.extractDayOfWeek;
                console.log('📅 Extracting day of week from:', dateColumnName);
                
                // Find the actual date column with flexible matching
                let actualDateColumn = availableColumns.find(col => 
                    col.toLowerCase() === dateColumnName.toLowerCase()
                );
                
                if (!actualDateColumn) {
                    actualDateColumn = availableColumns.find(col => 
                        col.toLowerCase().includes(dateColumnName.toLowerCase()) ||
                        dateColumnName.toLowerCase().includes(col.toLowerCase())
                    );
                }
                
                if (!actualDateColumn) {
                    // Try to find any date-like column
                    actualDateColumn = availableColumns.find(col => {
                        const sampleValue = processedData[0][col];
                        return sampleValue && !isNaN(Date.parse(sampleValue));
                    });
                }
                
                if (actualDateColumn) {
                    console.log('✅ Using date column:', actualDateColumn);
                    columnMapping.dateColumn = actualDateColumn;
                    
                    let validDates = 0;
                    processedData = processedData.map(row => {
                        const dateValue = row[actualDateColumn];
                        if (dateValue) {
                            const date = new Date(dateValue);
                            if (!isNaN(date.getTime())) {
                                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                                row.day_of_week = dayNames[date.getDay()];
                                validDates++;
                            } else {
                                row.day_of_week = 'Invalid Date';
                            }
                        } else {
                            row.day_of_week = 'No Date';
                        }
                        return row;
                    });
                    
                    console.log(`✅ Day of week extraction completed. Valid dates: ${validDates}/${processedData.length}`);
                } else {
                    console.error('❌ No suitable date column found');
                    throw new Error('Date column not found for day of week extraction');
                }
            }
            
            // Step 2: Identify and validate columns for rate calculation
            let numeratorColumn = null;
            let denominatorColumn = null;
            
            if (dataTransformation.calculateRate) {
                const { numerator, denominator } = dataTransformation.calculateRate;
                console.log('🧮 Setting up rate calculation:', { numerator, denominator });
                
                // Find numerator column with flexible matching
                numeratorColumn = availableColumns.find(col => 
                    col.toLowerCase() === numerator.toLowerCase()
                );
                
                if (!numeratorColumn) {
                    numeratorColumn = availableColumns.find(col => 
                        col.toLowerCase().includes(numerator.toLowerCase()) ||
                        numerator.toLowerCase().includes(col.toLowerCase())
                    );
                }
                
                // Find denominator column with flexible matching
                denominatorColumn = availableColumns.find(col => 
                    col.toLowerCase() === denominator.toLowerCase()
                );
                
                if (!denominatorColumn) {
                    denominatorColumn = availableColumns.find(col => 
                        col.toLowerCase().includes(denominator.toLowerCase()) ||
                        denominator.toLowerCase().includes(col.toLowerCase())
                    );
                }
                
                console.log('🔍 Rate calculation columns found:', { numeratorColumn, denominatorColumn });
                
                if (!numeratorColumn || !denominatorColumn) {
                    console.warn('⚠️ Rate calculation columns not found, trying common patterns');
                    
                    // Fallback to common email marketing patterns
                    if (!numeratorColumn) {
                        numeratorColumn = availableColumns.find(col => 
                            col.toLowerCase().includes('open') || 
                            col.toLowerCase().includes('click') ||
                            col.toLowerCase().includes('response')
                        );
                    }
                    
                    if (!denominatorColumn) {
                        denominatorColumn = availableColumns.find(col => 
                            col.toLowerCase().includes('sent') || 
                            col.toLowerCase().includes('email') ||
                            col.toLowerCase().includes('total') ||
                            col.toLowerCase().includes('deliver')
                        );
                    }
                }
                
                if (!numeratorColumn || !denominatorColumn) {
                    console.error('❌ Cannot find columns for rate calculation');
                    throw new Error(`Rate calculation failed: numerator '${numerator}' or denominator '${denominator}' column not found`);
                }
                
                // Validate that columns contain numeric data
                const numeratorSample = processedData.slice(0, 10).map(row => parseFloat(row[numeratorColumn])).filter(val => !isNaN(val));
                const denominatorSample = processedData.slice(0, 10).map(row => parseFloat(row[denominatorColumn])).filter(val => !isNaN(val));
                
                if (numeratorSample.length === 0 || denominatorSample.length === 0) {
                    throw new Error('Rate calculation columns do not contain valid numeric data');
                }
                
                columnMapping.numeratorColumn = numeratorColumn;
                columnMapping.denominatorColumn = denominatorColumn;
                console.log('✅ Rate calculation columns validated:', columnMapping);
            }
            
            // Step 3: Determine grouping column
            let groupingColumn = null;
            const groupByField = dataTransformation.groupByColumn;
            
            if (groupByField === 'day_of_week' || groupByField.includes('day')) {
                groupingColumn = 'day_of_week';
                console.log('📅 Grouping by day of week');
            } else {
                // Find the actual grouping column
                groupingColumn = availableColumns.find(col => 
                    col.toLowerCase() === groupByField.toLowerCase()
                );
                
                if (!groupingColumn) {
                    groupingColumn = availableColumns.find(col => 
                        col.toLowerCase().includes(groupByField.toLowerCase()) ||
                        groupByField.toLowerCase().includes(col.toLowerCase())
                    );
                }
                
                if (!groupingColumn) {
                    // Fallback to first non-numeric column
                    groupingColumn = availableColumns.find(col => {
                        const sampleValue = processedData[0][col];
                        return isNaN(parseFloat(sampleValue));
                    }) || availableColumns[0];
                }
                
                console.log('📊 Grouping by column:', groupingColumn);
            }
            
            columnMapping.groupingColumn = groupingColumn;
            
            // Step 4: Group data and calculate aggregations
            const groups = {};
            let validRecords = 0;
            
            processedData.forEach((row, index) => {
                let key;
                
                if (groupingColumn === 'day_of_week') {
                    key = row.day_of_week;
                } else {
                    key = row[groupingColumn];
                }
                
                // Skip invalid keys
                if (!key || key === 'Invalid Date' || key === 'No Date' || key === null || key === undefined) {
                    return;
                }
                
                if (!groups[key]) {
                    groups[key] = [];
                }
                groups[key].push(row);
                validRecords++;
            });
            
            console.log(`📊 Grouped ${validRecords} records into ${Object.keys(groups).length} groups:`, Object.keys(groups));
            
            if (Object.keys(groups).length === 0) {
                throw new Error('No valid groups created from data');
            }
            
            // Step 5: Calculate aggregated values for each group
            const aggregatedData = Object.entries(groups).map(([key, rows]) => {
                const result = { 
                    [groupingColumn]: key,
                    group_name: key,
                    count: rows.length
                };
                
                if (dataTransformation.calculateRate && numeratorColumn && denominatorColumn) {
                    // Calculate rate: sum of numerators / sum of denominators * 100
                    const totalNumerator = rows.reduce((sum, row) => {
                        const val = parseFloat(row[numeratorColumn]) || 0;
                        return sum + val;
                    }, 0);
                    
                    const totalDenominator = rows.reduce((sum, row) => {
                        const val = parseFloat(row[denominatorColumn]) || 0;
                        return sum + val;
                    }, 0);
                    
                    result.rate = totalDenominator > 0 ? (totalNumerator / totalDenominator * 100) : 0;
                    result.total_numerator = totalNumerator;
                    result.total_denominator = totalDenominator;
                    
                    console.log(`📊 ${key}: ${totalNumerator}/${totalDenominator} = ${result.rate.toFixed(2)}%`);
                    
                } else if (dataTransformation.aggregationType === 'average') {
                    // Calculate average of numeric columns
                    const numericCols = availableColumns.filter(col => {
                        const sampleValue = rows[0][col];
                        return !isNaN(parseFloat(sampleValue));
                    });
                    
                    if (numericCols.length > 0) {
                        const targetCol = numericCols[0]; // Use first numeric column
                        const values = rows.map(row => parseFloat(row[targetCol]) || 0);
                        result.value = values.reduce((sum, val) => sum + val, 0) / values.length;
                        result.target_column = targetCol;
                    }
                    
                } else if (dataTransformation.aggregationType === 'sum') {
                    // Calculate sum of numeric columns
                    const numericCols = availableColumns.filter(col => {
                        const sampleValue = rows[0][col];
                        return !isNaN(parseFloat(sampleValue));
                    });
                    
                    if (numericCols.length > 0) {
                        const targetCol = numericCols[0]; // Use first numeric column
                        const values = rows.map(row => parseFloat(row[targetCol]) || 0);
                        result.value = values.reduce((sum, val) => sum + val, 0);
                        result.target_column = targetCol;
                    }
                }
                
                return result;
            });
            
            // Step 6: Sort the results
            const sortBy = dataTransformation.sortBy || 'rate';
            const sortOrder = dataTransformation.sortOrder || 'desc';
            
            aggregatedData.sort((a, b) => {
                let aVal, bVal;
                
                if (sortBy === 'rate' && a.rate !== undefined) {
                    aVal = a.rate;
                    bVal = b.rate;
                } else if (sortBy === 'value' && a.value !== undefined) {
                    aVal = a.value;
                    bVal = b.value;
                } else {
                    aVal = a.count;
                    bVal = b.count;
                }
                
                return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
            });
            
            // Step 7: Limit results if specified
            if (dataTransformation.limit && dataTransformation.limit > 0) {
                aggregatedData.splice(parseInt(dataTransformation.limit));
            }
            
            console.log('✅ Final aggregated data:', aggregatedData);
            
            // Step 8: Create meaningful summary
            let summary = `Analyzed ${processedData.length} records grouped by ${groupingColumn}`;
            if (dataTransformation.calculateRate && aggregatedData.length > 0) {
                const topResult = aggregatedData[0];
                summary = `${topResult.group_name} has the highest rate at ${topResult.rate.toFixed(2)}% (${topResult.total_numerator}/${topResult.total_denominator})`;
            } else if (aggregatedData.length > 0) {
                const topResult = aggregatedData[0];
                summary = `${topResult.group_name} has the highest value with ${topResult.value || topResult.count}`;
            }
            
            return {
                type: queryStructure.queryType,
                data: aggregatedData,
                chartType: visualization.chartType || 'bar',
                summary: summary,
                queryStructure: {
                    ...queryStructure,
                    xAxisLabel: visualization.xAxisLabel,
                    yAxisLabel: visualization.yAxisLabel,
                    chartTitle: visualization.chartTitle
                },
                processingDetails: {
                    originalRecords: processedData.length,
                    validRecords: validRecords,
                    groupsCreated: aggregatedData.length,
                    columnMapping: columnMapping,
                    calculationType: dataTransformation.aggregationType || 'rate'
                }
            };
            
        } catch (error) {
            console.error('❌ Error in advanced query processing:', error);
            
            // Provide detailed error information
            return {
                type: 'error',
                data: [],
                chartType: 'bar',
                summary: `Processing failed: ${error.message}`,
                error: error.message,
                queryStructure: queryStructure,
                processingDetails: {
                    errorType: error.name,
                    errorMessage: error.message,
                    availableColumns: this.csvData.length > 0 ? Object.keys(this.csvData[0]) : []
                }
            };
        }
    }

    parseQuery(query) {
        const lowerQuery = query.toLowerCase();
        
        for (const pattern of this.queryPatterns) {
            const match = lowerQuery.match(pattern.pattern);
            if (match) {
                return this.executePatternQuery(pattern, match, query);
            }
        }
        
        // Default fallback
        return {
            type: 'filter',
            data: this.csvData.slice(0, 50),
            chartType: 'bar',
            summary: `Showing first 50 records for query: "${query}"`
        };
    }

    executePatternQuery(pattern, match, originalQuery) {
        const { type, operation, column } = pattern;
        
        switch (type) {
            case 'aggregate':
                return this.performAggregation(column, operation);
            case 'sort':
                const count = match[1] ? parseInt(match[1]) : 10;
                return this.performSort(column, operation, count);
            case 'group':
                return this.performGroupBy(column);
            case 'filter':
                return this.performFilter([column], {});
            case 'correlation':
                return this.performCorrelation(pattern.col1, pattern.col2);
            default:
                return {
                    type: 'display',
                    data: this.csvData.slice(0, 20),
                    chartType: 'bar',
                    summary: `Displaying data for: ${originalQuery}`
                };
        }
    }

    performAggregation(column, operation) {
        if (!this.csvData || !column) return null;
        
        const values = this.csvData.map(row => parseFloat(row[column])).filter(val => !isNaN(val));
        if (values.length === 0) return null;
        
        let result;
        switch (operation) {
            case 'mean':
                result = values.reduce((sum, val) => sum + val, 0) / values.length;
                break;
            case 'sum':
                result = values.reduce((sum, val) => sum + val, 0);
                break;
            case 'max':
                result = Math.max(...values);
                break;
            case 'min':
                result = Math.min(...values);
                break;
            case 'count':
                result = values.length;
                break;
            default:
                result = values.reduce((sum, val) => sum + val, 0) / values.length;
        }
        
        return {
            type: 'aggregate',
            operation: operation,
            column: column,
            result: result,
            data: [{ [column]: result, operation: operation }],
            chartType: 'bar',
            summary: `${operation} of ${column}: ${result.toFixed(2)}`
        };
    }

    performGroupBy(column, valueColumn = null) {
        if (!this.csvData || !column) return null;
        
        const groups = {};
        this.csvData.forEach(row => {
            const key = row[column];
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(row);
        });
        
        const data = Object.entries(groups).map(([key, rows]) => {
            const result = { [column]: key, count: rows.length };
            
            if (valueColumn) {
                const values = rows.map(row => parseFloat(row[valueColumn])).filter(val => !isNaN(val));
                if (values.length > 0) {
                    result[valueColumn] = values.reduce((sum, val) => sum + val, 0) / values.length;
                }
            }
            
            return result;
        });
        
        return {
            type: 'group',
            column: column,
            data: data,
            chartType: 'bar',
            summary: `Grouped by ${column}: ${data.length} categories`
        };
    }

    performSort(column, direction, count = 10) {
        if (!this.csvData || !column) return null;
        
        const sorted = [...this.csvData].sort((a, b) => {
            const aVal = parseFloat(a[column]) || 0;
            const bVal = parseFloat(b[column]) || 0;
            return direction === 'desc' ? bVal - aVal : aVal - bVal;
        });
        
        return {
            type: 'sort',
            column: column,
            direction: direction,
            count: count,
            data: sorted.slice(0, count),
            chartType: 'bar',
            summary: `Top ${count} records by ${column}`
        };
    }

    performCorrelation(col1, col2) {
        if (!this.csvData || !col1 || !col2) return null;
        
        const data = this.csvData
            .filter(row => row[col1] && row[col2])
            .map(row => ({
                x: parseFloat(row[col1]) || row[col1],
                y: parseFloat(row[col2]) || row[col2],
                [col1]: row[col1],
                [col2]: row[col2]
            }))
            .filter(point => !isNaN(point.x) && !isNaN(point.y));
        
        return {
            type: 'correlation',
            col1: col1,
            col2: col2,
            data: data,
            chartType: 'scatter',
            summary: `Correlation between ${col1} and ${col2}: ${data.length} data points`
        };
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Initialize the dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.dashboard = new CSVDashboard();
});

// Ensure dashboard is available globally for onclick events
if (typeof window !== 'undefined') {
    window.dashboard = window.dashboard || null;
}