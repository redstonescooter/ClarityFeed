const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

export class ChatGPTAnalyzer {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.openai.com/v1';
        this.systemPrompt = `You are a social media sentiment and topic analyst. I will provide you with a file containing number of tweet objects with their text content. For each tweet content, do two things:

1. Structured analysis (per tweet):
   - skip: true/false (true if purely promotional)
   - political_alignment: ["none", "left", "center", "right", "other"], with subtype if identifiable
   - topic: main subject
   - emotion: main emotion (anger, joy, sadness, fear, surprise, neutral)
   - humor: true/false
   - brief_note: one short line (min 5 max 15 words) giving any other notable cue (e.g., sarcasm, cultural ref, social commentary)

2. Higher-level insights (across all tweets in the batch):
   - Summary of dominant themes, tones, or patterns (≤5 sentences, concise).
   - Any surprising, subtle, or emergent observations that aren't obvious from the structured tags.

Rules:
- Always output JSON array for part 1 (one object per tweet).
- After the JSON array, provide the batch insights as short bullet points.
- Be concise, avoid long explanations.
- Do not ask me clarifying questions; always produce your best analysis.`;
    }

    async createThread() {
        try {
            const response = await fetch(`${this.baseUrl}/threads`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'OpenAI-Beta': 'assistants=v2'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to create thread: ${response.status} ${response.statusText}`);
            }

            const thread = await response.json();
            return thread.id;
        } catch (error) {
            console.error('Error creating thread:', error.message);
            throw error;
        }
    }

    async uploadFile(filePath) {
        try {
            const formData = new FormData();
            formData.append('file', fs.createReadStream(filePath));
            formData.append('purpose', 'assistants');

            const response = await fetch(`${this.baseUrl}/files`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Failed to upload file: ${response.status} ${response.statusText}`);
            }

            const file = await response.json();
            return file.id;
        } catch (error) {
            console.error('Error uploading file:', error.message);
            throw error;
        }
    }

    async sendMessage(threadId, fileId) {
        try {
            const response = await fetch(`${this.baseUrl}/threads/${threadId}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'OpenAI-Beta': 'assistants=v2'
                },
                body: JSON.stringify({
                    role: 'user',
                    content: this.systemPrompt,
                    attachments: [{
                        file_id: fileId,
                        tools: [{ type: 'code_interpreter' }]
                    }]
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to send message: ${response.status} ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error sending message:', error.message);
            throw error;
        }
    }

    async createRun(threadId) {
        try {
            const response = await fetch(`${this.baseUrl}/threads/${threadId}/runs`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'OpenAI-Beta': 'assistants=v2'
                },
                body: JSON.stringify({
                    assistant_id: 'asst_abc123', // You'll need to create an assistant first
                    instructions: 'Analyze the provided social media data according to the specified format.'
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to create run: ${response.status} ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error creating run:', error.message);
            throw error;
        }
    }

    async waitForRunCompletion(threadId, runId) {
        let run;
        do {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            
            const response = await fetch(`${this.baseUrl}/threads/${threadId}/runs/${runId}`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'OpenAI-Beta': 'assistants=v2'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to get run status: ${response.status} ${response.statusText}`);
            }

            run = await response.json();
            console.log(`Run status: ${run.status}`);
        } while (run.status === 'queued' || run.status === 'in_progress');

        return run;
    }

    async getMessages(threadId) {
        try {
            const response = await fetch(`${this.baseUrl}/threads/${threadId}/messages`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'OpenAI-Beta': 'assistants=v2'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to get messages: ${response.status} ${response.statusText}`);
            }

            const messages = await response.json();
            return messages.data;
        } catch (error) {
            console.error('Error getting messages:', error.message);
            throw error;
        }
    }

    // Alternative: Direct Chat Completions API (simpler approach)
    async analyzeWithChatCompletion(filePath) {
        try {
            // Read the file content
            const fileContent = fs.readFileSync(filePath, 'utf8');
            
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [
                        {
                            role: 'user',
                            content: `${this.systemPrompt}\n\nHere is the tweet data:\n\n${fileContent}`
                        }
                    ],
                    max_tokens: 4000,
                    temperature: 0.1
                })
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`API request failed: ${response.status} ${response.statusText}\n${errorBody}`);
            }

            const result = await response.json();
            return result.choices[0].message.content;
        } catch (error) {
            console.error('Error with chat completion:', error.message);
            throw error;
        }
    }

    async processFile(inputFilePath, outputFilePath) {
        try {
            console.log(`Processing file: ${inputFilePath}`);
            
            // Use the simpler Chat Completions API
            const analysis = await this.analyzeWithChatCompletion(inputFilePath);
            
            // Save the result
            fs.writeFileSync(outputFilePath, analysis, 'utf8');
            console.log(`Analysis saved to: ${outputFilePath}`);
            
            return analysis;
        } catch (error) {
            console.error(`Error processing file ${inputFilePath}:`, error.message);
            throw error;
        }
    }

    async batchProcess(inputFiles, outputDir = './output') {
        // Create output directory if it doesn't exist
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const results = [];
        
        for (const inputFile of inputFiles) {
            try {
                const fileName = path.basename(inputFile, path.extname(inputFile));
                const outputFile = path.join(outputDir, `${fileName}_analysis.txt`);
                
                const result = await this.processFile(inputFile, outputFile);
                results.push({
                    inputFile,
                    outputFile,
                    success: true,
                    result
                });
                
                // Add a small delay between requests to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`Failed to process ${inputFile}:`, error.message);
                results.push({
                    inputFile,
                    success: false,
                    error: error.message
                });
            }
        }
        
        return results;
    }
}

// Usage example
export async function main() {
    // Replace with your actual OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY || 'your-api-key-here';
    
    if (!apiKey || apiKey === 'your-api-key-here') {
        console.error('Please set your OPENAI_API_KEY environment variable or update the apiKey variable');
        process.exit(1);
    }
    
    const analyzer = new ChatGPTAnalyzer(apiKey);
    
    // Example: Process multiple files
    const inputFiles = [
        '../output/sadra1/tweets_2025-09-15_06-30-58__scroll--6_profile--sadra1.json',
        '../output/sadra1/tweets_2025-09-15_07-25-10__scroll--6_profile--sadra1.json',
        '../output/sadra1/tweets_2025-09-15_07-14-05__scroll--6_profile--sadra1.json'
    ];
    
    try {
        const results = await analyzer.batchProcess(inputFiles, './analysis_results');
        
        console.log('\nBatch processing completed!');
        console.log('Results summary:');
        results.forEach(result => {
            console.log(`${result.inputFile}: ${result.success ? '✓ Success' : '✗ Failed'}`);
            if (!result.success) {
                console.log(`  Error: ${result.error}`);
            }
        });
        
    } catch (error) {
        console.error('Batch processing failed:', error.message);
    }
}

