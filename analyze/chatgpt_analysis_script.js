import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: path.resolve('/root/programming/clarityFeed/.env') });

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

    async analyzeContent(content) {
        try {
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
                            content: `${this.systemPrompt}\n\nHere is the tweet data:\n\n${content}`
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

    async analyzeFile(filePath) {
        try {
            // Read the file content
            const fileContent = fs.readFileSync(filePath, 'utf8');
            return await this.analyzeContent(fileContent);
        } catch (error) {
            console.error('Error reading file:', error.message);
            throw error;
        }
    }

    async processFile(inputFilePath, outputFilePath) {
        try {
            console.log(`Processing file: ${inputFilePath}`);
            
            const analysis = await this.analyzeFile(inputFilePath);
            
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

    // Process multiple files with chunking support for large files
    async processLargeFile(filePath, outputDir = './output', chunkSize = 50) {
        try {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const tweets = JSON.parse(fileContent);
            
            if (!Array.isArray(tweets)) {
                throw new Error('File content is not a JSON array of tweets');
            }

            const fileName = path.basename(filePath, path.extname(filePath));
            const chunks = [];
            
            // Split tweets into chunks
            for (let i = 0; i < tweets.length; i += chunkSize) {
                chunks.push(tweets.slice(i, i + chunkSize));
            }

            console.log(`Processing ${tweets.length} tweets in ${chunks.length} chunks`);

            const results = [];
            for (let i = 0; i < chunks.length; i++) {
                try {
                    console.log(`Processing chunk ${i + 1}/${chunks.length}`);
                    
                    const chunkContent = JSON.stringify(chunks[i], null, 2);
                    const analysis = await this.analyzeContent(chunkContent);
                    
                    const outputFile = path.join(outputDir, `${fileName}_chunk_${i + 1}_analysis.txt`);
                    fs.writeFileSync(outputFile, analysis, 'utf8');
                    
                    results.push({
                        chunk: i + 1,
                        outputFile,
                        success: true,
                        tweetsInChunk: chunks[i].length
                    });

                    // Delay between chunks to avoid rate limiting
                    if (i < chunks.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                    
                } catch (error) {
                    console.error(`Failed to process chunk ${i + 1}:`, error.message);
                    results.push({
                        chunk: i + 1,
                        success: false,
                        error: error.message
                    });
                }
            }

            return results;
        } catch (error) {
            console.error(`Error processing large file ${filePath}:`, error.message);
            throw error;
        }
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
    
    // Example 1: Process multiple files
    const inputFiles = [
        'output/sadra1/tweets_2025-09-15_06-30-58__scroll--6_profile--sadra1.json',
        'output/sadra1/tweets_2025-09-15_07-25-10__scroll--6_profile--sadra1.json',
        'output/sadra1/tweets_2025-09-15_07-14-05__scroll--6_profile--sadra1.json'
    ];
    
    try {
        console.log('Starting batch processing...');
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

    // Example 2: Process a large file with chunking
    /*
    try {
        console.log('\nProcessing large file with chunking...');
        const chunkResults = await analyzer.processLargeFile(
            '../output/sadra1/large_tweets_file.json',
            './analysis_results',
            30 // tweets per chunk
        );
        
        console.log('\nChunk processing completed!');
        console.log('Chunk results:');
        chunkResults.forEach(result => {
            console.log(`Chunk ${result.chunk}: ${result.success ? '✓ Success' : '✗ Failed'}`);
            if (result.success) {
                console.log(`  Processed ${result.tweetsInChunk} tweets`);
            } else {
                console.log(`  Error: ${result.error}`);
            }
        });
        
    } catch (error) {
        console.error('Chunk processing failed:', error.message);
    }
    */
}
main();