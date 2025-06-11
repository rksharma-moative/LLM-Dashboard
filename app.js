import AIService from './aiService.js';

class CSVDashboard {
    constructor() {
        this.csvData = null;
        this.currentChart = null;
        this.queryHistory = [];
        this.currentPage = 1;
        this.rowsPerPage = 20;
        this.filteredData = null;
        this.aiService = new AIService(); // API key will be loaded from localStorage
        this.chatHistory = [];
        this.isChatOpen = false;
        this.dataStructure = null; // Store analyzed data structure
        
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
        this.setupEventListeners();
        this.setupDragAndDrop();
        this.setupChatInterface();
        this.setupApiKeyManagement();
        this.checkApiKeyStatus();
        console.log('Dashboard initialized');
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
        if (tableSearch) tableSearch.addEventListener('input', (e) => this.searchTable(e.target.value));
        
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        // Query input enter key
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

        if (this.aiService.hasValidApiKey()) {
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
            this.aiService.setApiKey(apiKey);
            
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
            this.showMessage('Error saving API key: ' + error.message, 'error');
        }
    }

    async testApiKey() {
        const apiStatus = document.getElementById('apiStatus');
        const apiStatusText = document.getElementById('apiStatusText');

        if (!this.aiService.hasValidApiKey()) {
            this.showMessage('Please save an API key first', 'error');
            return;
        }

        try {
            this.showLoading(true, 'Testing API key...');
            const result = await this.aiService.testApiKey();
            
            if (apiStatus && apiStatusText) {
                apiStatus.style.backgroundColor = '#d4edda';
                apiStatus.style.color = '#155724';
                apiStatusText.textContent = '✓ API key is working correctly!';
            }
            
            this.showMessage('API key test successful!', 'success');
        } catch (error) {
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
        
        this.showLoading(true, 'Uploading and analyzing file...');
        
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim(), // Clean headers
            transform: (value) => value ? value.toString().trim() : '', // Clean values
            complete: async (results) => {
                try {
                if (results.errors.length > 0) {
                        console.warn('CSV parsing warnings:', results.errors);
                    }
                    
                    // Validate and clean data
                    const cleanedData = this.validateAndCleanData(results.data, file.name);
                    if (!cleanedData.isValid) {
                        this.showLoading(false);
                        this.showMessage(cleanedData.message, 'error');
                    return;
                }
                    
                    this.csvData = cleanedData.data;
                    await this.analyzeDataStructure();
                    this.displayFileInfo(file, { data: this.csvData, meta: { fields: Object.keys(this.csvData[0] || {}) } });
                this.showQueryInterface();
                    await this.generateSuggestions();
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
            // Perform detailed column analysis
            const columnAnalysis = this.performDetailedColumnAnalysis();
            
            // Try AI analysis first
            const structureAnalysis = await this.aiService.analyzeCSVStructure(this.csvData);
            if (structureAnalysis.success) {
                // Merge AI analysis with our detailed analysis
                this.dataStructure = {
                    ...structureAnalysis,
                    detailedColumnAnalysis: columnAnalysis
                };
                console.log('Data structure analyzed with AI:', this.dataStructure);
            } else {
                // Fallback to our analysis
                this.dataStructure = {
                    analysis: this.generateFallbackAnalysis(columnAnalysis),
                    columnAnalysis: columnAnalysis,
                    detailedColumnAnalysis: columnAnalysis,
                    totalRows: this.csvData.length,
                    totalColumns: Object.keys(this.csvData[0]).length,
                    columns: Object.keys(this.csvData[0]),
                    success: true
                };
                console.log('Data structure analyzed with fallback:', this.dataStructure);
            }
            
            this.displayDataStructureAnalysis(this.dataStructure);
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

    generateFallbackAnalysis(columnAnalysis) {
        const totalColumns = Object.keys(columnAnalysis).length;
        const numericColumns = Object.values(columnAnalysis).filter(col => col.type === 'numeric').length;
        const categoricalColumns = Object.values(columnAnalysis).filter(col => col.type === 'categorical').length;
        const usefulColumns = Object.values(columnAnalysis).filter(col => col.isUsefulForAnalysis).length;
        
        return `Dataset Analysis:
        
Total Columns: ${totalColumns}
Useful for Analysis: ${usefulColumns}
Numeric Columns: ${numericColumns}
Categorical Columns: ${categoricalColumns}

Data Quality: ${this.assessOverallDataQuality(columnAnalysis)}

This dataset appears to be suitable for ${this.suggestAnalysisTypes(columnAnalysis).join(', ')} analysis.`;
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

    displayDataStructureAnalysis(analysis) {
        const analysisSection = document.getElementById('dataAnalysisSection');
        if (!analysisSection) return;

        // Ensure we have analysis content
        const analysisText = analysis.analysis || this.generateFallbackAnalysis(analysis.columnAnalysis || analysis.detailedColumnAnalysis);
        const columnAnalysis = analysis.columnAnalysis || analysis.detailedColumnAnalysis || {};

        const analysisHtml = `
            <div class="card">
                <div class="card__body">
                    <h3>📊 Data Structure Analysis</h3>
                    <div class="analysis-content">
                        <div class="analysis-overview">
                            <div class="analysis-text">${analysisText.replace(/\n/g, '<br>')}</div>
                        </div>
                        
                        ${Object.keys(columnAnalysis).length > 0 ? `
                        <div class="column-breakdown">
                            <h4>📋 Column Details:</h4>
                            <div class="columns-grid">
                                ${Object.entries(columnAnalysis).map(([col, info]) => `
                                    <div class="column-card">
                                        <div class="column-header">
                                            <div class="column-name">${col}</div>
                                            <div class="column-type ${info.type}">${info.type}</div>
                                        </div>
                                        <div class="column-stats">
                                            <div class="stat-row">
                                                <span class="stat-label">Unique Values:</span>
                                                <span class="stat-value">${info.uniqueCount || 'N/A'}</span>
                                            </div>
                                            ${info.nullPercentage !== undefined ? `
                                            <div class="stat-row">
                                                <span class="stat-label">Completeness:</span>
                                                <span class="stat-value">${(100 - info.nullPercentage).toFixed(1)}%</span>
                                            </div>
                                            ` : ''}
                                            ${info.sampleValues && info.sampleValues.length > 0 ? `
                                            <div class="stat-row">
                                                <span class="stat-label">Sample:</span>
                                                <span class="stat-value">${info.sampleValues.slice(0, 3).join(', ')}</span>
                                            </div>
                                            ` : ''}
                                            ${info.stats && info.stats.mean !== undefined ? `
                                            <div class="stat-row">
                                                <span class="stat-label">Average:</span>
                                                <span class="stat-value">${info.stats.mean.toFixed(2)}</span>
                                            </div>
                                            ` : ''}
                                        </div>
                                        <div class="column-quality ${info.dataQuality || 'good'}">${info.dataQuality || 'good'} quality</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        ` : ''}
                        
                        <div class="analysis-insights">
                            <h4>💡 Key Insights:</h4>
                            <ul class="insights-list">
                                <li>Dataset contains ${this.csvData.length.toLocaleString()} records across ${Object.keys(columnAnalysis).length} columns</li>
                                <li>${Object.values(columnAnalysis).filter(col => col.type === 'numeric').length} numeric columns available for statistical analysis</li>
                                <li>${Object.values(columnAnalysis).filter(col => col.type === 'categorical').length} categorical columns for grouping and segmentation</li>
                                <li>Overall data quality: ${this.assessOverallDataQuality(columnAnalysis)}</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        `;

        analysisSection.innerHTML = analysisHtml;
        analysisSection.style.display = 'block';
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
            <h4>Data Preview (First 5 rows of ${rows} total)</h4>
            <div class="table-wrapper">
                <table class="preview-table">
                    <thead>
                        <tr>
                            ${columns.map(col => {
                                const columnType = this.dataStructure?.detailedColumnAnalysis?.[col]?.type || this.getColumnType(col);
                                return `<th>${col} <span class="column-type ${columnType}">${columnType}</span></th>`;
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
        if (this.dataStructure?.columnAnalysis?.[columnName]) {
            return this.dataStructure.columnAnalysis[columnName].type;
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
        
        if (!this.aiService.hasValidApiKey()) {
            console.log('No API key configured, using fallback suggestions');
            this.displayFallbackSuggestions();
            return;
        }
        
        try {
            this.showLoading(true, 'Generating AI-powered suggestions...');
            const result = await this.aiService.generateSuggestions(this.csvData);
            
            if (result.success && result.suggestions.length > 0) {
                this.displaySuggestions(result.suggestions);
            } else {
                console.warn('Failed to generate AI suggestions:', result.error);
                this.displayFallbackSuggestions();
            }
        } catch (error) {
            console.error('Error generating suggestions:', error);
            this.displayFallbackSuggestions();
        } finally {
            this.showLoading(false);
        }
    }

    displaySuggestions(suggestions) {
        const suggestionsContainer = document.getElementById('suggestions');
        if (!suggestionsContainer) return;
        
        // Clear existing content
        suggestionsContainer.innerHTML = `
            <h4>💡 Suggested Analysis Questions</h4>
            <div class="suggestions-grid" id="suggestionsGrid">
            </div>
        `;
        
        const suggestionsGrid = document.getElementById('suggestionsGrid');
        
        // Create suggestion buttons with proper event listeners
        suggestions.forEach(suggestion => {
            const button = document.createElement('button');
            button.className = 'suggestion-btn';
            button.textContent = suggestion;
            button.addEventListener('click', () => {
                this.fillQuery(suggestion);
            });
            suggestionsGrid.appendChild(button);
        });
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
        
        const fallbackSuggestions = [];
        
        // Add suggestions based on data structure
        if (numericColumns.length > 0) {
            fallbackSuggestions.push(`What is the average ${numericColumns[0]}?`);
            fallbackSuggestions.push(`Show top 10 by ${numericColumns[0]}`);
            if (numericColumns.length > 1) {
                fallbackSuggestions.push(`Show correlation between ${numericColumns[0]} and ${numericColumns[1]}`);
            }
        }
        
        if (categoricalColumns.length > 0) {
            fallbackSuggestions.push(`Group by ${categoricalColumns[0]}`);
            if (numericColumns.length > 0) {
                fallbackSuggestions.push(`Average ${numericColumns[0]} by ${categoricalColumns[0]}`);
            }
        }
        
        // Add general suggestions
        fallbackSuggestions.push(`Show distribution of ${columns[0]}`);
        fallbackSuggestions.push(`Count total records`);
        
        // Ensure we have at least 5 suggestions
        if (fallbackSuggestions.length < 5) {
            const additionalSuggestions = [
                `Display first 20 rows`,
                `Find maximum values`,
                `Show data summary`,
                `Count unique values`,
                `Filter data by value`
            ];
            
            additionalSuggestions.forEach(suggestion => {
                if (fallbackSuggestions.length < 6) {
                    fallbackSuggestions.push(suggestion);
                }
            });
        }
        
        // Add a note about AI features
        if (!this.aiService.hasValidApiKey()) {
            const suggestionsContainer = document.getElementById('suggestions');
            if (suggestionsContainer) {
                const aiNote = document.createElement('div');
                aiNote.style.cssText = 'margin-bottom: 1rem; padding: 0.75rem; background: #e3f2fd; border-radius: 6px; font-size: 0.9rem; color: #1565c0;';
                aiNote.innerHTML = '💡 <strong>Tip:</strong> Configure your Google AI API key above to get intelligent, context-aware suggestions and analysis!';
                suggestionsContainer.appendChild(aiNote);
            }
        }
        
        this.displaySuggestions(fallbackSuggestions.slice(0, 6));
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
        
        const query = queryInput.value.trim();
        this.showLoading(true, 'Processing your query...');
        
        try {
            let result = null;
            let aiSummary = null;
            
            if (this.aiService.hasValidApiKey()) {
                // Use AI-powered structured query analysis
                this.showLoading(true, 'Analyzing query with AI...');
                const structuredAnalysis = await this.aiService.analyzeQueryWithStructure(this.csvData, query);
                
                if (structuredAnalysis.success) {
                    const queryStructure = structuredAnalysis.analysis;
                    console.log('AI Query structure:', queryStructure);
                    
                    // Process the query based on the structured analysis
                    this.showLoading(true, 'Executing analysis...');
                    result = await this.executeStructuredQuery(queryStructure, query);
                    
                    if (result) {
                        // Generate AI summary of results
                        this.showLoading(true, 'Generating AI insights...');
                        aiSummary = await this.generateResultSummary(result, query, queryStructure);
                        result.aiSummary = aiSummary;
                    }
                }
            }
            
            // Fallback to pattern matching if AI failed or no API key
            if (!result) {
                console.log('Using pattern matching for query:', query);
                this.showLoading(true, 'Analyzing with pattern matching...');
                result = this.parseQuery(query);
                
                // Generate basic summary even without AI
                if (result && this.aiService.hasValidApiKey()) {
                    try {
                        this.showLoading(true, 'Generating insights...');
                        aiSummary = await this.generateBasicResultSummary(result, query);
                        result.aiSummary = aiSummary;
                    } catch (error) {
                        console.warn('Failed to generate AI summary:', error);
                    }
                }
            }
            
            if (result) {
                // Display results with AI summary
                this.displayResults(result, query);
                this.updateChart(result, query);
                this.updateQueryHistory();
                this.updateKPIs();
                
                this.showMessage('Analysis completed successfully!', 'success');
            } else {
                this.showMessage('Could not understand your query. Please try rephrasing or use one of the suggested questions.', 'warning');
            }
        } catch (error) {
            console.error('Error processing query:', error);
            this.showMessage('Error processing query. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // Enhanced method to execute structured queries with better operation handling
    async executeStructuredQuery(queryStructure, originalQuery) {
        const { queryType, targetColumns, operation, visualization } = queryStructure;
        
        try {
            let result = null;
            
            switch (queryType) {
                case 'aggregation':
                    result = this.performAggregation(operation, targetColumns[0]);
                    break;
                case 'groupby':
                    // Enhanced groupby with operation support
                    if (targetColumns.length >= 2) {
                        result = this.performGroupByWithOperation(targetColumns[0], targetColumns[1], operation);
                    } else {
                        result = this.performGroupBy(targetColumns[0]);
                    }
                    break;
                case 'filter':
                    result = this.performFilter(targetColumns, queryStructure.filterConditions);
                    break;
                case 'correlation':
                    if (targetColumns.length >= 2) {
                        result = this.performCorrelation(targetColumns[0], targetColumns[1]);
                    }
                    break;
                case 'distribution':
                    result = this.performDistribution(targetColumns[0]);
                    break;
                case 'trend':
                    result = this.performTrend(targetColumns);
                    break;
                default:
                    result = this.performDisplay(targetColumns[0]);
            }
            
            if (result) {
                result.queryStructure = queryStructure;
                result.originalQuery = originalQuery;
                // Intelligently select chart type
                result.chartType = this.selectIntelligentChartType(result, queryStructure);
            }
            
            return result;
        } catch (error) {
            console.error('Error executing structured query:', error);
            return null;
        }
    }

    // New method for groupby with operations (avg, sum, count, etc.)
    performGroupByWithOperation(groupColumn, valueColumn, operation = 'count') {
        if (!this.csvData || !groupColumn) return null;
        
        const groups = {};
        
        // Group the data
        this.csvData.forEach(row => {
            const groupKey = row[groupColumn];
            if (!groupKey) return;
            
            if (!groups[groupKey]) {
                groups[groupKey] = [];
            }
            groups[groupKey].push(row);
        });
        
        // Apply operation
        const result = Object.entries(groups).map(([groupKey, rows]) => {
            let value;
            
            switch (operation.toLowerCase()) {
                case 'avg':
                case 'average':
                    if (valueColumn) {
                        const values = rows.map(row => parseFloat(row[valueColumn])).filter(val => !isNaN(val));
                        value = values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
                    } else {
                        value = rows.length;
                    }
                    break;
                case 'sum':
                    if (valueColumn) {
                        const values = rows.map(row => parseFloat(row[valueColumn])).filter(val => !isNaN(val));
                        value = values.reduce((sum, val) => sum + val, 0);
                    } else {
                        value = rows.length;
                    }
                    break;
                case 'max':
                    if (valueColumn) {
                        const values = rows.map(row => parseFloat(row[valueColumn])).filter(val => !isNaN(val));
                        value = values.length > 0 ? Math.max(...values) : 0;
                    } else {
                        value = rows.length;
                    }
                    break;
                case 'min':
                    if (valueColumn) {
                        const values = rows.map(row => parseFloat(row[valueColumn])).filter(val => !isNaN(val));
                        value = values.length > 0 ? Math.min(...values) : 0;
                    } else {
                        value = rows.length;
                    }
                    break;
                case 'count':
                default:
                    value = rows.length;
                    break;
            }
            
            return {
                [groupColumn]: groupKey,
                [valueColumn ? `${operation}_${valueColumn}` : 'count']: value
            };
        });
        
        // Sort by value descending
        result.sort((a, b) => {
            const aVal = Object.values(a)[1];
            const bVal = Object.values(b)[1];
            return bVal - aVal;
        });
        
        return {
            type: 'groupby',
            data: result,
            columns: [groupColumn, valueColumn ? `${operation}_${valueColumn}` : 'count'],
            summary: `Grouped ${this.csvData.length} records by ${groupColumn} with ${operation} operation`
        };
    }

    // Intelligent chart type selection (alias for compatibility)
    selectIntelligentChartType(result, queryStructure) {
        return this.selectOptimalChartType(result, queryStructure);
    }

    // Intelligent chart type selection
    selectOptimalChartType(result, queryStructure) {
        const data = result.data;
        const columns = Object.keys(data[0] || {});
        
        // Use detailed column analysis if available
        const columnAnalysis = this.dataStructure?.detailedColumnAnalysis || {};
        
        const numericColumns = columns.filter(col => 
            columnAnalysis[col]?.type === 'numeric' || 
            this.isNumericColumn(col, data)
        );
        
        const categoricalColumns = columns.filter(col => 
            columnAnalysis[col]?.type === 'categorical' || 
            this.isCategoricalColumn(col, data)
        );

        const dateColumns = columns.filter(col => 
            columnAnalysis[col]?.type === 'date' || 
            this.isDateColumn(col, data)
        );

        // Decision tree for chart selection
        if (result.type === 'correlation' && numericColumns.length >= 2) {
            return 'scatter';
        }
        
        if (result.type === 'distribution') {
            return numericColumns.length > 0 ? 'histogram' : 'bar';
        }

        if (result.type === 'trend' && dateColumns.length > 0) {
            return 'line';
        }
        
        if (result.type === 'group' || categoricalColumns.length > 0) {
            const uniqueCategories = [...new Set(data.map(row => row[categoricalColumns[0]]))].length;
            if (uniqueCategories <= 6) {
                return uniqueCategories <= 4 ? 'pie' : 'doughnut';
            } else {
                return 'bar';
            }
        }
        
        if (numericColumns.length === 2) {
            return 'scatter';
        }
        
        if (numericColumns.length === 1 && categoricalColumns.length >= 1) {
            return 'bar';
        }
        
        if (dateColumns.length > 0 && numericColumns.length > 0) {
            return 'line';
        }

        // Default fallback
        return 'bar';
    }
    
    // Enhanced Bar Chart Configuration
    getEnhancedBarConfig(result, xAxis = null, yAxis = null) {
        const data = result.data;
        if (!data || !Array.isArray(data) || data.length === 0) {
            return null;
        }

        const columns = Object.keys(data[0] || {});
        if (columns.length === 0) {
            return null;
        }
        
        // Use AI-suggested axes or find the best columns
        const categoricalCol = xAxis || this.findBestCategoricalColumn(columns, data) || columns[0];
        const numericCol = yAxis || this.findBestNumericColumn(columns, data);
        
        // Prepare data based on suggested or detected columns
        let chartData, labels;
        
        if (result.type === 'group' || result.type === 'groupby') {
            if (result.groups) {
                labels = Object.keys(result.groups);
                chartData = labels.map(label => (result.groups[label] || []).length);
            } else {
                // Fallback: group by first categorical column
                const grouped = this.groupAndAggregate(data, categoricalCol, numericCol || 'count', 'count');
                labels = Object.keys(grouped);
                chartData = Object.values(grouped);
            }
        } else if (result.type === 'aggregate' && result.result !== undefined) {
            // Single aggregate result
            labels = [result.column || 'Result'];
            chartData = [result.result];
        } else if (categoricalCol && numericCol) {
            // Group by categorical column and aggregate numeric column
            const grouped = this.groupAndAggregate(data, categoricalCol, numericCol);
            labels = Object.keys(grouped).slice(0, 15); // Limit to 15 categories for readability
            chartData = labels.map(key => grouped[key]);
        } else if (numericCol) {
            // Create histogram-like bars for numeric data
            const bins = this.createBins(data, numericCol, 8);
            labels = bins.map(bin => `${bin.min.toFixed(1)}-${bin.max.toFixed(1)}`);
            chartData = bins.map(bin => bin.count);
        } else {
            // Fallback: count occurrences of first column
            const counts = this.countOccurrences(data, categoricalCol);
            const sortedEntries = Object.entries(counts)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10); // Limit to top 10
            labels = sortedEntries.map(([key]) => key);
            chartData = sortedEntries.map(([,value]) => value);
        }

        // Ensure we have valid data
        if (!labels || !chartData || labels.length === 0 || chartData.length === 0) {
            return null;
        }

        return {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: numericCol || result.operation || 'Count',
                    data: chartData,
                    backgroundColor: this.generateColors(labels.length, 0.7),
                    borderColor: this.generateColors(labels.length, 1),
                    borderWidth: 1,
                    borderRadius: 4,
                    borderSkipped: false,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: this.generateChartTitle(result, categoricalCol, numericCol),
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const value = typeof context.parsed.y === 'number' ? 
                                    context.parsed.y.toLocaleString() : context.parsed.y;
                                return `${context.dataset.label}: ${value}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: categoricalCol || 'Categories',
                            font: { weight: 'bold' }
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 0
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: numericCol || result.operation || 'Count',
                            font: { weight: 'bold' }
                        },
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return typeof value === 'number' ? value.toLocaleString() : value;
                            }
                        }
                    }
                }
            }
        };
    }

    // Enhanced Line Chart Configuration
    getEnhancedLineConfig(result, xAxis = null, yAxis = null) {
        const data = result.data;
        const columns = Object.keys(data[0] || {});
        
        // Use AI-suggested axes or auto-detect
        const xCol = xAxis || this.findBestDateColumn(columns, data) || columns[0];
        const yCol = yAxis || this.findBestNumericColumn(columns, data);
        
        if (!yCol) {
            return this.getEnhancedBarConfig(result, xAxis, yAxis); // Fallback
        }
        
        let labels, datasets;
        
        // Check if x-axis is date/time
        const isDateCol = this.isDateColumn(xCol, data);
        
        if (isDateCol) {
            // Time series data
            const sortedData = [...data].sort((a, b) => new Date(a[xCol]) - new Date(b[xCol]));
            labels = sortedData.map(row => new Date(row[xCol]).toLocaleDateString());
            
            datasets = [{
                label: yCol,
                data: sortedData.map(row => parseFloat(row[yCol]) || 0),
                borderColor: this.getColorPalette()[0],
                backgroundColor: this.getColorPalette()[0] + '20',
                fill: false,
                tension: 0.1,
                pointRadius: 3,
                pointHoverRadius: 5
            }];
        } else {
            // Categorical or sequential data
            labels = data.map(row => row[xCol]);
            datasets = [{
                label: yCol,
                data: data.map(row => parseFloat(row[yCol]) || 0),
                borderColor: this.getColorPalette()[0],
                backgroundColor: this.getColorPalette()[0] + '20',
                fill: false,
                tension: 0.1,
                pointRadius: 3,
                pointHoverRadius: 5
            }];
        }
                
        return {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: this.generateChartTitle(result, xCol, yCol)
                    },
                    legend: {
                        display: false
                            }
                        },
                        scales: {
                            x: {
                                title: {
                                    display: true,
                            text: xCol
                        },
                        ticks: {
                            callback: function(value) {
                                return typeof value === 'number' ? value.toLocaleString() : value;
                            }
                                }
                            },
                            y: {
                                title: {
                                    display: true,
                            text: yCol
                        },
                        ticks: {
                            callback: function(value) {
                                return typeof value === 'number' ? value.toLocaleString() : value;
                            }
                                }
                            }
                        }
                    }
                };
    }

    // Enhanced Histogram Configuration
    getEnhancedHistogramConfig(result) {
        const data = result.data;
        const columns = Object.keys(data[0] || {});
        const numericCol = this.findBestNumericColumn(columns, data);
        
        if (!numericCol) {
            return this.getEnhancedBarConfig(result); // Fallback
        }
        
        const values = data.map(row => parseFloat(row[numericCol])).filter(val => !isNaN(val));
        const bins = this.createHistogramBins(values, 10);
        
        const labels = bins.map(bin => `${bin.min.toFixed(1)}-${bin.max.toFixed(1)}`);
        const chartData = bins.map(bin => bin.count);

                return {
                    type: 'bar',
                    data: {
                labels: labels,
                        datasets: [{
                    label: 'Frequency',
                    data: chartData,
                    backgroundColor: this.getColorPalette()[0] + '80',
                    borderColor: this.getColorPalette()[0],
                    borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            title: {
                                display: true,
                        text: `Distribution of ${numericCol}`
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Frequency'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: numericCol
                        }
                    }
                }
            }
        };
    }

    // Enhanced Pie Chart Configuration
    getEnhancedPieConfig(result) {
        const data = result.data;
        
        let labels, chartData;
        
        if (result.type === 'group') {
            labels = Object.keys(result.groups || {});
            chartData = labels.map(label => (result.groups[label] || []).length);
        } else {
            const columns = Object.keys(data[0] || {});
            const categoricalCol = this.findBestCategoricalColumn(columns, data);
            const numericCol = this.findBestNumericColumn(columns, data);
            
            if (categoricalCol) {
                if (numericCol) {
                    const grouped = this.groupAndAggregate(data, categoricalCol, numericCol);
                    labels = Object.keys(grouped);
                    chartData = Object.values(grouped);
                } else {
                    const counts = this.countOccurrences(data, categoricalCol);
                    labels = Object.keys(counts);
                    chartData = Object.values(counts);
                }
            } else {
                return null; // No suitable data for pie chart
            }
        }
        
        // Limit to top 8 categories for readability
        if (labels.length > 8) {
            const combined = labels.map((label, index) => ({ label, value: chartData[index] }))
                .sort((a, b) => b.value - a.value);
            
            const top7 = combined.slice(0, 7);
            const others = combined.slice(7).reduce((sum, item) => sum + item.value, 0);
            
            labels = [...top7.map(item => item.label), 'Others'];
            chartData = [...top7.map(item => item.value), others];
        }

        return {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: chartData,
                    backgroundColor: this.generateColors(labels.length, 0.8),
                    borderColor: this.generateColors(labels.length, 1),
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: this.generateChartTitle(result)
                    },
                    legend: {
                        position: 'right',
                        labels: {
                            boxWidth: 12,
                            padding: 15
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${context.parsed.toLocaleString()} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        };
    }

    // Enhanced Scatter Plot Configuration
    getEnhancedScatterConfig(result, xAxis = null, yAxis = null) {
        const data = result.data;
        const columns = Object.keys(data[0] || {});
        const numericCols = this.findAllNumericColumns(columns, data);
        
        if (numericCols.length < 2) {
            return this.getEnhancedBarConfig(result); // Fallback
        }
        
        // Use AI-suggested axes or auto-detect
        const xCol = xAxis || numericCols[0];
        const yCol = yAxis || numericCols[1];
        const sizeCol = numericCols[2]; // Optional third dimension
        
        const scatterData = data.map(row => {
            const point = {
                x: parseFloat(row[xCol]) || 0,
                y: parseFloat(row[yCol]) || 0
            };
            
            if (sizeCol) {
                point.r = Math.max(3, Math.min(20, (parseFloat(row[sizeCol]) || 1) / 10));
            }
            
            return point;
        });

        return {
            type: sizeCol ? 'bubble' : 'scatter',
            data: {
                datasets: [{
                    label: `${yCol} vs ${xCol}`,
                    data: scatterData,
                    backgroundColor: this.getColorPalette()[0] + '60',
                    borderColor: this.getColorPalette()[0],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `${yCol} vs ${xCol}`
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: xCol
                        },
                        ticks: {
                            callback: function(value) {
                                return typeof value === 'number' ? value.toLocaleString() : value;
                            }
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: yCol
                        },
                        ticks: {
                            callback: function(value) {
                                return typeof value === 'number' ? value.toLocaleString() : value;
                            }
                        }
                    }
                }
            }
        };
    }

    // Update chart with intelligent chart selection
    updateChart(result, query, aiSuggestions = null) {
        const chartContainer = document.getElementById('chartContainer');
        if (!chartContainer) {
            console.error('Chart container not found');
            return;
        }

        // Destroy existing chart if it exists
        if (this.currentChart) {
            this.currentChart.destroy();
            this.currentChart = null;
        }

        // Clear container and create canvas
        chartContainer.innerHTML = '';
        const canvas = document.createElement('canvas');
        canvas.id = 'dataChart';
        canvas.style.maxHeight = '400px';
        chartContainer.appendChild(canvas);

        // Get chart configuration based on type
        let chartConfig = null;
        const chartType = result.chartType || this.selectOptimalChartType(result);

        // Use AI suggestions if available
        const xAxis = aiSuggestions?.xAxis;
        const yAxis = aiSuggestions?.yAxis;

        console.log('Creating chart of type:', chartType, 'for result:', result);

        try {
            switch (chartType) {
                case 'bar':
                    chartConfig = this.getEnhancedBarConfig(result, xAxis, yAxis);
                    break;
                case 'line':
                    chartConfig = this.getEnhancedLineConfig(result, xAxis, yAxis);
                    break;
                case 'pie':
                    chartConfig = this.getEnhancedPieConfig(result);
                    break;
                case 'doughnut':
                    chartConfig = this.getEnhancedDoughnutConfig(result);
                    break;
                case 'scatter':
                    chartConfig = this.getEnhancedScatterConfig(result, xAxis, yAxis);
                    break;
                case 'histogram':
                    chartConfig = this.getEnhancedHistogramConfig(result);
                    break;
                case 'area':
                    chartConfig = this.getEnhancedAreaConfig(result, xAxis, yAxis);
                    break;
                case 'radar':
                    chartConfig = this.getEnhancedRadarConfig(result);
                    break;
                case 'polarArea':
                    chartConfig = this.getEnhancedPolarAreaConfig(result);
                    break;
                case 'bubble':
                    chartConfig = this.getEnhancedBubbleConfig(result);
                    break;
                default:
                    chartConfig = this.getEnhancedBarConfig(result, xAxis, yAxis);
            }

            // If no chart config was generated, create a minimal fallback chart
            if (!chartConfig) {
                chartConfig = this.createMinimalFallbackChart(result);
            }

            if (chartConfig) {
                const ctx = canvas.getContext('2d');
                this.currentChart = new Chart(ctx, chartConfig);
                this.updateChartInfo(result, query);
                console.log('Chart created successfully');
            } else {
                this.displayNoChartMessage(result, query);
            }
        } catch (error) {
            console.error('Error creating chart:', error);
            // Try to create a simple fallback chart
            try {
                const fallbackConfig = this.createMinimalFallbackChart(result);
                if (fallbackConfig) {
                    const ctx = canvas.getContext('2d');
                    this.currentChart = new Chart(ctx, fallbackConfig);
                    this.updateChartInfo(result, query);
                } else {
                    this.displayNoChartMessage(result, query);
                }
            } catch (fallbackError) {
                console.error('Fallback chart creation failed:', fallbackError);
                this.displayNoChartMessage(result, query);
            }
        }
    }

    // New method to create minimal fallback charts
    createMinimalFallbackChart(result) {
        const data = result.data;
        if (!data || !Array.isArray(data) || data.length === 0) {
            return null;
        }

        const columns = Object.keys(data[0] || {});
        if (columns.length === 0) {
            return null;
        }

        // Create a simple bar chart showing data counts or first numeric column
        const numericColumns = columns.filter(col => this.isNumericColumn(col, data));
        const categoricalColumns = columns.filter(col => this.isCategoricalColumn(col, data));

        let labels = [];
        let chartData = [];
        let label = 'Count';

        if (result.type === 'aggregate' && result.result !== undefined) {
            // Single value result
            labels = [result.column || 'Result'];
            chartData = [result.result];
            label = result.operation || 'Value';
        } else if (categoricalColumns.length > 0) {
            // Group by first categorical column
            const groupCol = categoricalColumns[0];
            const counts = this.countOccurrences(data, groupCol);
            labels = Object.keys(counts).slice(0, 10); // Limit to 10 categories
            chartData = labels.map(key => counts[key]);
            label = 'Count';
        } else if (numericColumns.length > 0) {
            // Show distribution of first numeric column
            const numCol = numericColumns[0];
            const values = data.map(row => parseFloat(row[numCol])).filter(val => !isNaN(val));
            if (values.length > 0) {
                const bins = this.createHistogramBins(values, 8);
                labels = bins.map(bin => `${bin.min.toFixed(1)}-${bin.max.toFixed(1)}`);
                chartData = bins.map(bin => bin.count);
                label = 'Frequency';
            }
        } else {
            // Last resort: show row indices
            labels = data.slice(0, 10).map((_, index) => `Row ${index + 1}`);
            chartData = data.slice(0, 10).map(() => 1);
            label = 'Records';
        }

        if (labels.length === 0 || chartData.length === 0) {
            return null;
        }

        return {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: chartData,
                    backgroundColor: this.generateColors(labels.length, 0.7),
                    borderColor: this.generateColors(labels.length, 1),
                    borderWidth: 1,
                    borderRadius: 4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: result.summary || 'Data Visualization'
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return typeof value === 'number' ? value.toLocaleString() : value;
                            }
                        }
                    }
                }
            }
        };
    }

    // New method to display message when no chart can be created
    displayNoChartMessage(result, query) {
        const chartContainer = document.getElementById('chartContainer');
        if (!chartContainer) return;

        const messageHtml = `
            <div class="no-chart-message">
                <div class="no-chart-icon">📊</div>
                <h4>Visualization Not Available</h4>
                <p>Unable to create a chart for this query, but your results are available in the Table and Summary tabs.</p>
                <div class="result-summary">
                    <strong>Query:</strong> "${query}"<br>
                    <strong>Result:</strong> ${result.summary || 'Analysis completed successfully'}
                </div>
            </div>
        `;

        chartContainer.innerHTML = messageHtml;
        this.updateChartInfo(result, query);
    }

    // Enhanced chart generation with intelligent chart selection
    updateChartInfo(result, query) {
        const chartInfo = document.getElementById('chartInfo');
        if (!chartInfo) return;
        
        let infoText = `Query: "${query}"<br>`;
        
        switch (result.type) {
            case 'aggregate':
                infoText += `Calculated ${result.operation} of ${result.column}: ${result.result.toFixed(2)}`;
                break;
            case 'sort':
                infoText += `Showing top ${result.count} items sorted by ${result.column}`;
                break;
            case 'group':
                infoText += `Data grouped by ${result.column} showing ${result.data.length} categories`;
                break;
            case 'correlation':
                infoText += `Scatter plot showing relationship between ${result.col1} and ${result.col2}`;
                break;
            default:
                infoText += 'Data visualization generated based on your query';
        }
        
        chartInfo.innerHTML = infoText;
    }
    
    updateQueryHistory() {
        const historyList = document.getElementById('historyList');
        if (!historyList) return;
        
        const recentQueries = this.queryHistory.slice(0, 5);
        
        // Clear existing content
        historyList.innerHTML = '';
        
        // Create history items with proper event listeners
        recentQueries.forEach(query => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.textContent = query;
            historyItem.addEventListener('click', () => {
                this.fillQuery(query);
            });
            historyList.appendChild(historyItem);
        });
    }
    
    switchTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        const tabBtn = document.querySelector(`[data-tab="${tab}"]`);
        const tabContent = document.getElementById(`${tab}Tab`);
        
        if (tabBtn) tabBtn.classList.add('active');
        if (tabContent) tabContent.classList.add('active');
    }
    
    searchTable(searchTerm) {
        if (!this.csvData) return;
        
        const filteredData = this.csvData.filter(row => 
            Object.values(row).some(value => 
                value && value.toString().toLowerCase().includes(searchTerm.toLowerCase())
            )
        );
        
        this.currentPage = 1;
        this.updateTable(filteredData);
    }
    
    exportData() {
        if (!this.filteredData && !this.csvData) return;
        
        const dataToExport = this.filteredData || this.csvData;
        const csv = Papa.unparse(dataToExport);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'filtered_data.csv';
        a.click();
        window.URL.revokeObjectURL(url);
    }
    
    showLoading(show, text = 'Processing your query...') {
        const loadingOverlay = document.getElementById('loadingOverlay');
        const loadingText = document.getElementById('loadingText');
        if (loadingOverlay) {
            loadingOverlay.style.display = show ? 'flex' : 'none';
        }
        if (loadingText && text) {
            loadingText.textContent = text;
        }
    }
    
    showMessage(message, type = 'info') {
        const messageToast = document.getElementById('messageToast');
        const messageText = document.getElementById('messageText');
        
        if (messageToast && messageText) {
            messageText.textContent = message;
            messageToast.className = `message-toast ${type}`;
            messageToast.style.display = 'block';
            
            // Add show class for animation
            setTimeout(() => {
                messageToast.classList.add('show');
            }, 10);
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                messageToast.classList.remove('show');
                setTimeout(() => {
                    messageToast.style.display = 'none';
                }, 300);
            }, 5000);
        }
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    setupChatInterface() {
        const chatButton = document.createElement('button');
        chatButton.className = 'chat-button';
        chatButton.innerHTML = '💬';
        chatButton.onclick = () => this.toggleChat();
        document.body.appendChild(chatButton);

        const chatContainer = document.createElement('div');
        chatContainer.className = 'chat-container';
        chatContainer.style.display = 'none';
        chatContainer.innerHTML = `
            <div class="chat-header">
                <h3>AI Assistant</h3>
                <button class="close-chat">×</button>
            </div>
            <div class="chat-messages"></div>
            <div class="chat-input-container">
                <textarea class="chat-input" placeholder="Ask about your data..."></textarea>
                <button class="send-message">Send</button>
            </div>
        `;
        document.body.appendChild(chatContainer);

        // Chat event listeners
        const closeButton = chatContainer.querySelector('.close-chat');
        const sendButton = chatContainer.querySelector('.send-message');
        const chatInput = chatContainer.querySelector('.chat-input');

        closeButton.onclick = () => this.toggleChat();
        sendButton.onclick = () => this.sendChatMessage();
        chatInput.onkeypress = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendChatMessage();
            }
        };
    }

    toggleChat() {
        const chatContainer = document.querySelector('.chat-container');
        this.isChatOpen = !this.isChatOpen;
        chatContainer.style.display = this.isChatOpen ? 'flex' : 'none';
    }

    async sendChatMessage() {
        const chatInput = document.querySelector('.chat-input');
        const message = chatInput.value.trim();
        if (!message) return;

        const chatMessages = document.querySelector('.chat-messages');
        
        // Add user message
        this.addChatMessage('user', message);
        chatInput.value = '';

        if (!this.csvData) {
            this.addChatMessage('assistant', 'Please upload a CSV file first to analyze the data.');
            return;
        }

        try {
            this.showLoading(true);
            const { analysis, success } = await this.aiService.analyzeData(this.csvData, message);
            
            if (success) {
                this.addChatMessage('assistant', analysis);
                
                // Process the query to generate visualization
                const result = await this.processQueryForVisualization(message, analysis);
                if (result) {
                    this.displayResults(result, message);
                    this.addChatMessage('assistant', '📊 I\'ve generated a visualization based on your question. Check the main dashboard!');
                }
            } else {
                this.addChatMessage('assistant', 'Sorry, I encountered an error analyzing your data. Please try again.');
            }
        } catch (error) {
            console.error('Chat Error:', error);
            this.addChatMessage('assistant', 'Sorry, something went wrong. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }

    async processQueryForVisualization(query, analysis) {
        try {
            // Try to extract meaningful data for visualization
            const columns = Object.keys(this.csvData[0]);
            let result = null;

            // Check if query is about specific columns
            const numericColumns = columns.filter(col => {
                const sampleValues = this.csvData.slice(0, 10).map(row => row[col]).filter(val => val && !isNaN(parseFloat(val)));
                return sampleValues.length > 5;
            });

            const categoricalColumns = columns.filter(col => {
                const uniqueValues = [...new Set(this.csvData.slice(0, 50).map(row => row[col]))];
                return uniqueValues.length < 20 && uniqueValues.length > 1;
            });

            // Determine chart type based on query content
            let chartType = 'bar';
            if (query.toLowerCase().includes('trend') || query.toLowerCase().includes('over time')) {
                chartType = 'line';
            } else if (query.toLowerCase().includes('correlation') || query.toLowerCase().includes('relationship')) {
                chartType = 'scatter';
            } else if (query.toLowerCase().includes('distribution') || query.toLowerCase().includes('proportion')) {
                chartType = 'pie';
            }

            // Generate appropriate visualization data
            if (categoricalColumns.length > 0 && numericColumns.length > 0) {
                const categoryCol = categoricalColumns[0];
                const numericCol = numericColumns[0];
                
                // Group data by category and calculate averages
                const groupedData = {};
                this.csvData.forEach(row => {
                    const category = row[categoryCol];
                    const value = parseFloat(row[numericCol]);
                    if (category && !isNaN(value)) {
                        if (!groupedData[category]) {
                            groupedData[category] = { sum: 0, count: 0 };
                        }
                        groupedData[category].sum += value;
                        groupedData[category].count += 1;
                    }
                });

                const chartData = Object.keys(groupedData).map(category => ({
                    [categoryCol]: category,
                    [numericCol]: (groupedData[category].sum / groupedData[category].count).toFixed(2)
                }));

                result = {
                    type: 'ai_analysis',
                    query: query,
                    analysis: analysis,
                    data: chartData,
                    chartType: chartType,
                    columns: [categoryCol, numericCol]
                };
            } else if (numericColumns.length >= 2) {
                // Use first two numeric columns for scatter plot
                const data = this.csvData.slice(0, 100).map(row => ({
                    [numericColumns[0]]: parseFloat(row[numericColumns[0]]) || 0,
                    [numericColumns[1]]: parseFloat(row[numericColumns[1]]) || 0
                }));

                result = {
                    type: 'ai_analysis',
                    query: query,
                    analysis: analysis,
                    data: data,
                    chartType: 'scatter',
                    columns: numericColumns.slice(0, 2)
                };
            }

            return result;
        } catch (error) {
            console.error('Visualization processing error:', error);
            return null;
        }
    }

    addChatMessage(role, content) {
        const chatMessages = document.querySelector('.chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${role}-message`;
        messageDiv.innerHTML = `
            <div class="message-content">${content}</div>
            <div class="message-time">${new Date().toLocaleTimeString()}</div>
        `;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        this.chatHistory.push({ role, content });
    }

    handleChatVisualization(analysis) {
        // Extract visualization type from analysis
        const visualizationMatch = analysis.match(/visualization:?\s*([^\.]+)/i);
        if (visualizationMatch) {
            const vizType = visualizationMatch[1].toLowerCase();
            let chartType = 'bar';
            
            if (vizType.includes('line')) chartType = 'line';
            else if (vizType.includes('pie')) chartType = 'pie';
            else if (vizType.includes('scatter')) chartType = 'scatter';
            
            // Try to extract relevant data columns
            const columns = Object.keys(this.csvData[0]);
            if (columns.length >= 2) {
                const result = {
                    type: chartType,
                    data: this.csvData.slice(0, 10),
                    columns: columns.slice(0, 2)
                };
                this.displayResults(result, 'Visualization from chat');
            }
        }
    }

    // Enhanced method for aggregation with better error handling
    performAggregation(operation, column) {
        console.log('Performing aggregation:', operation, 'on column:', column);
        
        if (!this.csvData.some(row => row.hasOwnProperty(column))) {
            throw new Error(`Column "${column}" not found in data`);
        }
        
        const numericData = this.csvData
            .map(row => parseFloat(row[column]))
            .filter(val => !isNaN(val));
            
        if (numericData.length === 0) {
            throw new Error(`Column "${column}" does not contain numeric data`);
        }
        
        let result;
        switch (operation) {
            case 'mean':
            case 'avg':
                result = numericData.reduce((sum, val) => sum + val, 0) / numericData.length;
                break;
            case 'sum':
                result = numericData.reduce((sum, val) => sum + val, 0);
                break;
            case 'max':
                result = Math.max(...numericData);
                break;
            case 'min':
                result = Math.min(...numericData);
                break;
            case 'count':
                result = this.csvData.length;
                break;
            default:
                result = numericData.reduce((sum, val) => sum + val, 0) / numericData.length;
        }
        
        return {
            type: 'aggregate',
            operation: operation,
            column: column,
            result: result,
            data: this.csvData,
            chartType: 'bar',
            summary: `${operation.toUpperCase()} of ${column}: ${result.toFixed(2)}`
        };
    }

    // Enhanced method for grouping
    performGroupBy(column) {
        console.log('Performing group by:', column);
        
        const groups = this.csvData.reduce((acc, row) => {
            const key = row[column] || 'Unknown';
            if (!acc[key]) acc[key] = [];
            acc[key].push(row);
            return acc;
        }, {});
        
        const groupData = Object.entries(groups).map(([key, rows]) => ({
            group: key,
            count: rows.length,
            data: rows
        }));
        
        return {
            type: 'group',
            column: column,
            groups: groups,
            data: groupData,
            chartType: 'pie',
            summary: `Grouped by ${column}: ${Object.keys(groups).length} unique groups`
        };
    }

    // Enhanced method for correlation
    performCorrelation(col1, col2) {
        console.log('Performing correlation:', col1, 'vs', col2);
        
        const data = this.csvData
            .map(row => ({
                x: parseFloat(row[col1]),
                y: parseFloat(row[col2]),
                label: row[col1] + ' vs ' + row[col2]
            }))
            .filter(point => !isNaN(point.x) && !isNaN(point.y));
            
        if (data.length === 0) {
            throw new Error('No numeric data found for correlation');
        }
        
        return {
            type: 'correlation',
            col1: col1,
            col2: col2,
            data: data,
            originalData: this.csvData,
            chartType: 'scatter',
            summary: `Correlation between ${col1} and ${col2}: ${data.length} data points`
        };
    }

    // Enhanced method for display
    performDisplay(column) {
        console.log('Performing display for column:', column);
        
        return {
            type: 'display',
            column: column,
            data: this.csvData,
            chartType: this.getColumnType(column) === 'numeric' ? 'histogram' : 'bar',
            summary: `Displaying ${column} data: ${this.csvData.length} records`
        };
    }

    // Enhanced method for parsing queries (fallback)
    parseQuery(query) {
        const columns = Object.keys(this.csvData[0] || {});
        console.log('Available columns:', columns);
        console.log('Parsing query:', query);
        
        const lowerQuery = query.toLowerCase();
        
        // Find mentioned columns in the query
        const mentionedColumns = columns.filter(col => 
            lowerQuery.includes(col.toLowerCase())
        );
        
        // Numeric and categorical column detection
        const numericColumns = columns.filter(col => this.isNumericColumn(col, this.csvData));
        const categoricalColumns = columns.filter(col => this.isCategoricalColumn(col, this.csvData));
        
        console.log('Mentioned columns:', mentionedColumns);
        console.log('Numeric columns:', numericColumns);
        console.log('Categorical columns:', categoricalColumns);
        
        // Dynamic pattern matching
        if (lowerQuery.includes('average') || lowerQuery.includes('mean')) {
            const targetColumn = mentionedColumns.find(col => numericColumns.includes(col)) || numericColumns[0];
            if (targetColumn) {
                return this.performAggregation('mean', targetColumn);
            }
        }
        
        if (lowerQuery.includes('sum') && (lowerQuery.includes('total') || mentionedColumns.length > 0)) {
            const targetColumn = mentionedColumns.find(col => numericColumns.includes(col)) || numericColumns[0];
            if (targetColumn) {
                return this.performAggregation('sum', targetColumn);
            }
        }
        
        if (lowerQuery.includes('count')) {
            if (mentionedColumns.length > 0) {
                return this.performAggregation('count', mentionedColumns[0]);
            } else {
                return this.performAggregation('count', columns[0]);
            }
        }
        
        if ((lowerQuery.includes('top') || lowerQuery.includes('highest')) && /\d+/.test(lowerQuery)) {
            const countMatch = lowerQuery.match(/\d+/);
            const count = countMatch ? parseInt(countMatch[0]) : 10;
            const targetColumn = mentionedColumns.find(col => numericColumns.includes(col)) || numericColumns[0] || columns[0];
            return this.performSort('desc', targetColumn, count);
        }
        
        if ((lowerQuery.includes('bottom') || lowerQuery.includes('lowest')) && /\d+/.test(lowerQuery)) {
            const countMatch = lowerQuery.match(/\d+/);
            const count = countMatch ? parseInt(countMatch[0]) : 10;
            const targetColumn = mentionedColumns.find(col => numericColumns.includes(col)) || numericColumns[0] || columns[0];
            return this.performSort('asc', targetColumn, count);
        }
        
        if (lowerQuery.includes('group') || (lowerQuery.includes('by') && mentionedColumns.length > 0)) {
            const groupColumn = mentionedColumns.find(col => categoricalColumns.includes(col)) || categoricalColumns[0];
            if (groupColumn) {
                if (lowerQuery.includes('average') || lowerQuery.includes('mean')) {
                    const valueColumn = mentionedColumns.find(col => numericColumns.includes(col)) || numericColumns[0];
                    if (valueColumn && valueColumn !== groupColumn) {
                        return this.performGroupByWithOperation(groupColumn, valueColumn, 'mean');
                    }
                }
                return this.performGroupBy(groupColumn);
            }
        }
        
        if (lowerQuery.includes('correlation') || lowerQuery.includes('relationship')) {
            const numericMentioned = mentionedColumns.filter(col => numericColumns.includes(col));
            if (numericMentioned.length >= 2) {
                return this.performCorrelation(numericMentioned[0], numericMentioned[1]);
            } else if (numericColumns.length >= 2) {
                return this.performCorrelation(numericColumns[0], numericColumns[1]);
            }
        }
        
        if (lowerQuery.includes('distribution') || lowerQuery.includes('spread')) {
            const targetColumn = mentionedColumns[0] || columns[0];
            return this.performDistribution(targetColumn);
        }
        
        if (lowerQuery.includes('maximum') || lowerQuery.includes('max')) {
            const targetColumn = mentionedColumns.find(col => numericColumns.includes(col)) || numericColumns[0];
            if (targetColumn) {
                return this.performAggregation('max', targetColumn);
            }
        }
        
        if (lowerQuery.includes('minimum') || lowerQuery.includes('min')) {
            const targetColumn = mentionedColumns.find(col => numericColumns.includes(col)) || numericColumns[0];
            if (targetColumn) {
                return this.performAggregation('min', targetColumn);
            }
        }
        
        if (lowerQuery.includes('show') || lowerQuery.includes('display')) {
            if (mentionedColumns.length > 0) {
                return this.performDisplay(mentionedColumns[0]);
            }
        }
        
        // Check for specific patterns (fallback to original patterns)
        for (const pattern of this.queryPatterns) {
            if (pattern.pattern.test(query)) {
                console.log('Pattern matched:', pattern);
                return this.executeQuery(pattern, query);
            }
        }
        
        // Default: show general overview if no specific pattern matches
        console.log('No pattern matched, showing overview');
        return {
            type: 'overview',
            data: this.csvData.slice(0, 100), // Limit to first 100 rows for overview
            columns: columns,
            chartType: 'table',
            summary: `Overview of dataset: ${this.csvData.length} records with ${columns.length} columns (${columns.join(', ')})`
        };
    }

    // Enhanced method for executing queries (fallback)
    executeQuery(pattern, originalQuery) {
        console.log('Executing query with pattern:', pattern);
        
        switch (pattern.type) {
            case 'aggregate':
                return this.performAggregation(pattern.operation, pattern.column);
                
            case 'sort':
                const countMatch = originalQuery.match(/(\d+)/);
                const count = countMatch ? parseInt(countMatch[1]) : 5;
                return this.performSort(pattern.operation, pattern.column, count);
                
            case 'filter':
                return this.performFilter([pattern.column], {});
                
            case 'group':
                return this.performGroupBy(pattern.column);
                
            case 'correlation':
                return this.performCorrelation(pattern.col1, pattern.col2);
                
            case 'display':
                return this.performDisplay(pattern.column);
                
            default:
                throw new Error('Unknown query type: ' + pattern.type);
        }
    }

    // Enhanced method for sorting
    performSort(order, column, count) {
        console.log('Performing sort:', order, 'on column:', column, 'count:', count);
        
        const sortedData = [...this.csvData].sort((a, b) => {
            const aVal = isNaN(parseFloat(a[column])) ? a[column] : parseFloat(a[column]);
            const bVal = isNaN(parseFloat(b[column])) ? b[column] : parseFloat(b[column]);
            
            if (order === 'desc') {
                return bVal > aVal ? 1 : -1;
            } else {
                return aVal > bVal ? 1 : -1;
            }
        });
        
        const resultData = sortedData.slice(0, count);
        
        return {
            type: 'sort',
            operation: order,
            column: column,
            count: count,
            data: resultData,
            chartType: 'bar',
            summary: `Top ${count} records by ${column} (${order}ending order)`
        };
    }

    // Utility methods for data analysis and chart generation
    
    isNumericColumn(column, data) {
        const sampleValues = data.slice(0, 20).map(row => row[column]).filter(val => val !== null && val !== undefined && val !== '');
        const numericValues = sampleValues.filter(val => !isNaN(parseFloat(val)) && isFinite(val));
        return numericValues.length > sampleValues.length * 0.7;
    }
    
    isCategoricalColumn(column, data) {
        const sampleValues = data.slice(0, 50).map(row => row[column]).filter(val => val !== null && val !== undefined && val !== '');
        const uniqueValues = [...new Set(sampleValues)];
        return uniqueValues.length < sampleValues.length * 0.5 && uniqueValues.length > 1 && uniqueValues.length <= 20;
    }
    
    isDateColumn(column, data) {
        const sampleValues = data.slice(0, 20).map(row => row[column]).filter(val => val !== null && val !== undefined && val !== '');
        const dateValues = sampleValues.filter(val => !isNaN(Date.parse(val)));
        return dateValues.length > sampleValues.length * 0.7;
    }
    
    findBestCategoricalColumn(columns, data) {
        return columns.find(col => this.isCategoricalColumn(col, data)) || null;
    }
    
    findBestNumericColumn(columns, data) {
        return columns.find(col => this.isNumericColumn(col, data)) || null;
    }
    
    findBestDateColumn(columns, data) {
        return columns.find(col => this.isDateColumn(col, data)) || null;
    }
    
    findAllNumericColumns(columns, data) {
        return columns.filter(col => this.isNumericColumn(col, data));
    }
    
    groupAndAggregate(data, groupColumn, valueColumn, operation = 'mean') {
        const groups = {};
        
        data.forEach(row => {
            const groupKey = row[groupColumn] || 'Unknown';
            const value = parseFloat(row[valueColumn]);
            
            if (!isNaN(value)) {
                if (!groups[groupKey]) {
                    groups[groupKey] = [];
                }
                groups[groupKey].push(value);
            }
        });
        
        const result = {};
        Object.keys(groups).forEach(key => {
            const values = groups[key];
            switch (operation) {
                case 'sum':
                    result[key] = values.reduce((sum, val) => sum + val, 0);
                    break;
                case 'count':
                    result[key] = values.length;
                    break;
                case 'max':
                    result[key] = Math.max(...values);
                    break;
                case 'min':
                    result[key] = Math.min(...values);
                    break;
                case 'mean':
                default:
                    result[key] = values.reduce((sum, val) => sum + val, 0) / values.length;
                    break;
            }
        });
        
        return result;
    }
    
    countOccurrences(data, column) {
        const counts = {};
        data.forEach(row => {
            const value = row[column] || 'Unknown';
            counts[value] = (counts[value] || 0) + 1;
        });
        return counts;
    }
    
    createBins(data, column, binCount = 10) {
        const values = data.map(row => parseFloat(row[column])).filter(val => !isNaN(val));
        if (values.length === 0) return [];
        
        const min = Math.min(...values);
        const max = Math.max(...values);
        const binSize = (max - min) / binCount;
        
        const bins = [];
        for (let i = 0; i < binCount; i++) {
            const binMin = min + i * binSize;
            const binMax = min + (i + 1) * binSize;
            const count = values.filter(val => val >= binMin && (i === binCount - 1 ? val <= binMax : val < binMax)).length;
            
            bins.push({
                min: binMin,
                max: binMax,
                count: count
            });
        }
        
        return bins;
    }
    
    createHistogramBins(values, binCount = 10) {
        if (values.length === 0) return [];
        
        const min = Math.min(...values);
        const max = Math.max(...values);
        const binSize = (max - min) / binCount;
        
        const bins = [];
        for (let i = 0; i < binCount; i++) {
            const binMin = min + i * binSize;
            const binMax = min + (i + 1) * binSize;
            const count = values.filter(val => val >= binMin && (i === binCount - 1 ? val <= binMax : val < binMax)).length;
            
            bins.push({
                min: binMin,
                max: binMax,
                count: count
            });
        }
        
        return bins;
    }
    
    generateColors(count, alpha = 1) {
        const colors = [
            `rgba(54, 162, 235, ${alpha})`,   // Blue
            `rgba(255, 99, 132, ${alpha})`,   // Red
            `rgba(255, 205, 86, ${alpha})`,   // Yellow
            `rgba(75, 192, 192, ${alpha})`,   // Teal
            `rgba(153, 102, 255, ${alpha})`,  // Purple
            `rgba(255, 159, 64, ${alpha})`,   // Orange
            `rgba(199, 199, 199, ${alpha})`,  // Grey
            `rgba(83, 102, 255, ${alpha})`,   // Indigo
            `rgba(255, 99, 255, ${alpha})`,   // Pink
            `rgba(99, 255, 132, ${alpha})`    // Green
        ];
        
        if (count <= colors.length) {
            return colors.slice(0, count);
        }
        
        // Generate additional colors if needed
        const result = [...colors];
        for (let i = colors.length; i < count; i++) {
            const hue = (i * 137.508) % 360; // Golden angle approximation
            result.push(`hsla(${hue}, 70%, 60%, ${alpha})`);
        }
        
        return result;
    }
    
    getColorPalette() {
        return [
            '#3498db', '#e74c3c', '#f39c12', '#2ecc71', '#9b59b6',
            '#1abc9c', '#34495e', '#e67e22', '#95a5a6', '#f1c40f'
        ];
    }
    
    generateChartTitle(result, xColumn = null, yColumn = null) {
        if (result.summary) {
            return result.summary;
        }
        
        switch (result.type) {
            case 'aggregate':
                return `${result.operation?.toUpperCase() || 'Analysis'} of ${result.column || 'Data'}`;
            case 'group':
                return `Distribution by ${result.column || 'Category'}`;
            case 'correlation':
                return `${yColumn || result.col2 || 'Y'} vs ${xColumn || result.col1 || 'X'}`;
            case 'trend':
                return `Trend Analysis: ${yColumn || 'Values'} over ${xColumn || 'Time'}`;
            case 'distribution':
                return `Distribution of ${xColumn || result.column || 'Values'}`;
            default:
                if (xColumn && yColumn) {
                    return `${yColumn} by ${xColumn}`;
                } else if (xColumn) {
                    return `Analysis of ${xColumn}`;
                }
                return 'Data Analysis';
        }
    }

    // Additional chart configurations
    
    getEnhancedDoughnutConfig(result) {
        const pieConfig = this.getEnhancedPieConfig(result);
        if (!pieConfig) return null;
        
        return {
            ...pieConfig,
            type: 'doughnut',
            options: {
                ...pieConfig.options,
                cutout: '60%',
                plugins: {
                    ...pieConfig.options.plugins,
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        };
    }
    
    getEnhancedAreaConfig(result, xAxis = null, yAxis = null) {
        const lineConfig = this.getEnhancedLineConfig(result, xAxis, yAxis);
        if (!lineConfig) return null;
        
        return {
            ...lineConfig,
            data: {
                ...lineConfig.data,
                datasets: lineConfig.data.datasets.map(dataset => ({
                    ...dataset,
                    fill: true,
                    backgroundColor: dataset.borderColor + '30'
                }))
            }
        };
    }
    
    getEnhancedRadarConfig(result) {
        const data = result.data;
        const columns = Object.keys(data[0] || {});
        const numericCols = this.findAllNumericColumns(columns, data).slice(0, 6); // Limit to 6 for readability
        
        if (numericCols.length < 3) {
            return this.getEnhancedBarConfig(result); // Fallback
        }
        
        // Calculate averages for each numeric column
        const averages = numericCols.map(col => {
            const values = data.map(row => parseFloat(row[col])).filter(val => !isNaN(val));
            return values.reduce((sum, val) => sum + val, 0) / values.length;
        });
        
        return {
            type: 'radar',
            data: {
                labels: numericCols,
                datasets: [{
                    label: 'Average Values',
                    data: averages,
                    backgroundColor: this.getColorPalette()[0] + '40',
                    borderColor: this.getColorPalette()[0],
                    borderWidth: 2,
                    pointBackgroundColor: this.getColorPalette()[0],
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: this.getColorPalette()[0]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Multi-dimensional Analysis'
                    }
                },
                scales: {
                    r: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return typeof value === 'number' ? value.toLocaleString() : value;
                            }
                        }
                    }
                }
            }
        };
    }
    
    getEnhancedPolarAreaConfig(result) {
        const pieConfig = this.getEnhancedPieConfig(result);
        if (!pieConfig) return null;
        
        return {
            ...pieConfig,
            type: 'polarArea',
            options: {
                ...pieConfig.options,
                scales: {
                    r: {
                        beginAtZero: true
                    }
                }
            }
        };
    }
    
    getEnhancedBubbleConfig(result) {
        const data = result.data;
        const columns = Object.keys(data[0] || {});
        const numericCols = this.findAllNumericColumns(columns, data);
        
        if (numericCols.length < 3) {
            return this.getEnhancedScatterConfig(result); // Fallback
        }
        
        const xCol = numericCols[0];
        const yCol = numericCols[1];
        const sizeCol = numericCols[2];
        
        const bubbleData = data.map(row => ({
            x: parseFloat(row[xCol]) || 0,
            y: parseFloat(row[yCol]) || 0,
            r: Math.max(3, Math.min(20, Math.abs(parseFloat(row[sizeCol]) || 1) / 10))
        }));
        
        return {
            type: 'bubble',
            data: {
                datasets: [{
                    label: `${yCol} vs ${xCol} (size: ${sizeCol})`,
                    data: bubbleData,
                    backgroundColor: this.getColorPalette()[0] + '60',
                    borderColor: this.getColorPalette()[0],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: this.generateChartTitle(result, xCol, yCol)
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: xCol
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: yCol
                        }
                    }
                }
            }
        };
    }

    // Enhanced table display with better data handling
    updateTable(data) {
        const tableContainer = document.getElementById('tableContainer');
        if (!tableContainer || !data || data.length === 0) {
            if (tableContainer) {
                tableContainer.innerHTML = '<div class="empty-state"><p>No data to display</p></div>';
            }
            return;
        }
        
        const columns = Object.keys(data[0]);
        
        // Filter out columns with all null/empty values
        const meaningfulColumns = columns.filter(col => {
            return data.some(row => row[col] !== null && row[col] !== undefined && row[col] !== '');
        });
        
        if (meaningfulColumns.length === 0) {
            tableContainer.innerHTML = '<div class="empty-state"><p>No meaningful data to display</p></div>';
            return;
        }
        
        const startIndex = (this.currentPage - 1) * this.rowsPerPage;
        const endIndex = startIndex + this.rowsPerPage;
        const pageData = data.slice(startIndex, endIndex);
        
        const tableHtml = `
            <table class="data-table">
                <thead>
                    <tr>
                        ${meaningfulColumns.map(col => {
                            const columnType = this.dataStructure?.detailedColumnAnalysis?.[col]?.type || 'text';
                            return `<th>${col} <span class="column-type ${columnType}">${columnType}</span></th>`;
                        }).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${pageData.map(row => `
                        <tr>
                            ${meaningfulColumns.map(col => {
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
            chartType: 'table',
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
            const result = await this.aiService.getKPIs(this.csvData);
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
                        <span class="ai-summary-badge">Powered by Gemini AI</span>
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
            if (!this.aiService || !this.aiService.hasValidApiKey()) {
                return this.generateFallbackSummary(result, query);
            }
            
            const data = result.data;
            const dataPreview = Array.isArray(data) ? data.slice(0, 10) : [data];
            
            const summaryPrompt = `
            Analyze these query results and provide a concise, business-friendly summary in exactly 150-200 words:
            
            Original Query: "${query}"
            Query Type: ${queryStructure?.queryType || result.type || 'analysis'}
            Chart Type: ${result.chartType || 'table'}
            
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
            
            const summary = await this.aiService.generateResultSummary(summaryPrompt);
            return summary || this.generateFallbackSummary(result, query);
        } catch (error) {
            console.error('Error generating result summary:', error);
            return this.generateFallbackSummary(result, query);
        }
    }

    // Method to generate basic AI summary for pattern-matched queries
    async generateBasicResultSummary(result, query) {
        try {
            if (!this.aiService || !this.aiService.hasValidApiKey()) {
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

            const summary = await this.aiService.generateResultSummary(summaryPrompt);
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
}

// Initialize the dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.dashboard = new CSVDashboard();
});

// Ensure dashboard is available globally for onclick events
if (typeof window !== 'undefined') {
    window.dashboard = window.dashboard || null;
}