import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: path.resolve('/root/programming/clarityFeed/.env') });

export class FreeAnalyzer {
    apiChoice: string;
    apiKey: string | undefined;
    baseUrl: string | undefined;
    systemPrompt: string;
    constructor(apiChoice = 'huggingface') {
        this.apiChoice = apiChoice;
        
        // Different free API options
        if (apiChoice === 'huggingface') {
            this.apiKey = process.env.HUGGINGFACE_API_KEY;
            this.baseUrl = 'https://api-inference.huggingface.co/models';
        } else if (apiChoice === 'groq') {
            this.apiKey = process.env.GROQ_API_KEY;
            this.baseUrl = 'https://api.groq.com/openai/v1';
        }
        
        // curl https://api.groq.com/openai/v1/chat/completions -s \
        // -H "Content-Type: application/json" \
        // -H "Authorization: Bearer your_key_here" \
        // -d '{
        // "model": "meta-llama/llama-4-scout-17b-16e-instruct",
        // "messages": [{
        //     "role": "user",
        //     "content": "Explain the importance of fast language models"
        // }]
        // }'


        this.systemPrompt = `You are a social media sentiment and topic analyst. I will provide you with a prompt containing a json that contains a number of tweet objects with their text content. For each tweet content, do two things:

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
        - Do not ask me clarifying questions; always produce your best analysis.
        return the results in json format`;
    }

    async analyzeWithHuggingFace(content) {
        // Use multiple models for different aspects
        const sentimentModel = 'cardiffnlp/twitter-roberta-base-sentiment-latest';
        const emotionModel = 'j-hartmann/emotion-english-distilroberta-base';
        
        try {
            // Get sentiment for each tweet
            const tweets = JSON.parse(content);
            const results = [];
            
            for (const tweet of tweets.slice(0, 10)) { // Limit for demo
                const tweetText = tweet.text || tweet.full_text || tweet.content || '';
                
                // Basic rule-based analysis (free!)
                const analysis = this.analyzeTextBasic(tweetText);
                results.push(analysis);
                
                // Small delay to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            return this.formatResults(results, tweets.slice(0, 10));
            
        } catch (error) {
            console.error('HuggingFace API error:', error);
            // Fallback to basic analysis
            return this.fallbackAnalysis(content);
        }
    }

    async analyzeWithGroq(content:string) {
        // Groq offers free tier with Llama models
        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messages: [
                        {
                            role: 'user',
                            content: `${this.systemPrompt}\n\nTweet data:\n${content}`
                        }
                    ],
                    "model": "openai/gpt-oss-120b",
                    "temperature": 1,
                    "max_completion_tokens": 8192,
                    "top_p": 1,
                    "stream": true,
                    "reasoning_effort": "medium",
                    "stop": null,
                    "response_format": {
                        "type": "json_object"
                    },
                })
            });

            if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Groq API failed: ${response.status} - ${errorText}`);
            }

            // Check if response is streaming (SSE format)
            const contentType = response.headers.get('content-type');
            if (contentType?.includes('text/event-stream')) {
                // Handle streaming response
                return await this.parseStreamingResponse(response);
            } else {
                // Handle normal JSON response
                const result = await response.json();
                return result.choices[0].message.content;
            }
            
        } catch (error) {
            console.error('Groq API error:', error);
            // return this.fallbackAnalysis(content);
            return `Error: Groq API error: ${error.message}`; // For now, just return the error
        }
    }
    async parseStreamingResponse(response) {
        const text = await response.text();
        const lines = text.split('\n');
        
        let fullContent = '';
        let fullReasoning = '';
        
        for (const line of lines) {
            if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                try {
                    const jsonStr = line.slice(6); // Remove 'data: ' prefix
                    const chunk = JSON.parse(jsonStr);
                    
                    if (chunk.choices?.[0]?.delta?.content) {
                        fullContent += chunk.choices[0].delta.content;
                    }
                    
                    if (chunk.choices?.[0]?.delta?.reasoning) {
                        fullReasoning += chunk.choices[0].delta.reasoning;
                    }
                } catch (e) {
                    // Skip invalid JSON chunks
                    continue;
                }
            }
        }
        
        // Return the actual content, not the reasoning
        return fullContent || fullReasoning || 'No content received';
    }

    async testGroqConnection() {
        console.log('=== TESTING GROQ CONNECTION ===');
        
        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messages: [
                        {
                            role: 'user',
                            content: `${this.systemPrompt}\n\nTweet data:\n [{"index":0,"content":"return a heiko in json format"}]`
                        }
                    ],
                    "model": "openai/gpt-oss-120b",
                    "temperature": 1,
                    "max_completion_tokens": 8192,
                    "top_p": 1,
                    "stream": true,
                    "reasoning_effort": "low",
                    "stop": null,
                    "response_format": {
                        "type": "json_object"
                    },
                })
            });

            console.log('Status:', response.status);
            console.log('Headers:', Object.fromEntries(response.headers));
            
            const text = await response.text();
            console.log('Raw response:', text);
            
            if (response.ok) {
                const json = JSON.parse(text);
                console.log('Parsed response:', json);
                return json;
            } else {
                console.error('API Error:', text);
                return null;
            }
        } catch (error) {
            console.error('Test failed:', error);
            return null;
        }
    }

    formatResults(analyses, tweets) {
        const jsonResults = analyses.map((analysis, i) => ({
            tweet_index: i,
            ...analysis
        }));
        
        // Generate batch insights
        const emotions = analyses.map(a => a.emotion);
        const topics = analyses.map(a => a.topic);
        const dominantEmotion = this.getMostFrequent(emotions);
        const dominantTopic = this.getMostFrequent(topics);
        
        const insights = [
            `• Dominant emotion: ${dominantEmotion}`,
            `• Primary topic: ${dominantTopic}`,
            `• Humor detected in ${analyses.filter(a => a.humor).length}/${analyses.length} tweets`,
            `• Political content: ${analyses.filter(a => a.political_alignment !== 'none').length}/${analyses.length} tweets`
        ];
        
        return JSON.stringify(jsonResults, null, 2) + '\n\n' + insights.join('\n');
    }

    getMostFrequent(arr) {
        const frequency = {};
        arr.forEach(item => frequency[item] = (frequency[item] || 0) + 1);
        return Object.keys(frequency).reduce((a, b) => frequency[a] > frequency[b] ? a : b);
    }

    fallbackAnalysis(content) {
        try {
            const tweets = JSON.parse(content);
            const analyses = tweets.map(tweet => {
                const text = tweet.text || tweet.full_text || '';
                return this.analyzeTextBasic(text);
            });
            
            return this.formatResults(analyses, tweets);
            
        } catch (error) {
            return `Error: Could not parse tweet data. ${error.message}`;
        }
    }

    async analyzeContent(content) {
        if (this.apiChoice === 'huggingface') {
            return await this.analyzeWithHuggingFace(content);
        } else if (this.apiChoice === 'groq') {
            return await this.analyzeWithGroq(content);
        } else {
            // Pure rule-based fallback (completely free)
            return this.fallbackAnalysis(content);
        }
    }
    async preProcess(fileContent:string) {
        const include_media_descriptions = true; // Set to true to include media alt texts
        const tweet_per_file:number|null = null; //maximum tweet analysis limit per file
        type fileContent = {
            tweets: Array<{
                content: string,
                media:Array<{src:string,alt:string}|null>
            }>
        }
        try {
            const data: fileContent = JSON.parse(fileContent);
            const texts = data.tweets.map((tweet,index )=> {
                if(tweet_per_file != null && index >= tweet_per_file){
                    return;
                }
                if(include_media_descriptions && tweet.media && tweet.media.length > 0){
                    let additionalText = '';
                    additionalText += "\n meta data: attached media descriptions of the tweet :";
                    for(const media of tweet.media){
                        if(media && media.alt){
                            const media_index = tweet.media.indexOf(media);
                            additionalText += `\n ${media_index + 1}th media description: ` + media.alt;
                        }
                    }
                    tweet.content += additionalText;
                }
                return tweet.content
            });
            return JSON.stringify(texts);
        } catch (error) {
            console.error('Pre-processing error:', error);
            throw error;
        }
    }
    async processFile(inputFilePath, outputFilePath) {
        try {
            console.log(`Processing file: ${inputFilePath}`);
            
            const fileContent = fs.readFileSync(inputFilePath, 'utf8');
            console.log(typeof fileContent," old length: ", fileContent.length);
            const preProcessedContent = await this.preProcess(fileContent);
            console.log(typeof preProcessedContent," new length: ", preProcessedContent.length);
            const analysis = await this.analyzeContent(preProcessedContent);
            
            fs.writeFileSync(outputFilePath, analysis, 'utf8');
            console.log(`Analysis saved to: ${outputFilePath}`);
            
            return analysis;
        } catch (error) {
            console.error(`Error processing file ${inputFilePath}:`, error.message);
            throw error;
        }
    }

    async batchProcess(inputFiles, outputDir = './analysis_results') {
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const results = [];
        
        for (const inputFile of inputFiles) {
            try {
                const sqlDateTime = new Date().toISOString()
                                    .slice(0, 19)
                                    .replace('T', '_')
                                    .replace(/:/g, '-');
                
                const fileName = path.basename(inputFile, path.extname(inputFile));
                const outputFile = path.join(outputDir, `analysedAt_${sqlDateTime}_${fileName}.json`);
                
                const result = await this.processFile(inputFile, outputFile);
                results.push({
                    inputFile,
                    outputFile,
                    success: true
                });
                console.log(result);
                
                // Small delay between files
                await new Promise(resolve => setTimeout(resolve, 500));
                
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
    analyzeTextBasic(text) {
    throw new Error('dont need basic analysis');
    }
}



// Usage example
export async function main() {
    // Choose your approach:
    // 'huggingface' - requires free HuggingFace account
    // 'groq' - requires free Groq account  
    // 'basic' - completely free, rule-based
    
    const analyzer = new FreeAnalyzer('groq'); // Start with basic
    // get args from cli or hard coded ones
    const cliInputFiles = process.argv.slice(2).filter(arg => arg.endsWith('.json'));
    
    const inputFiles = cliInputFiles.length > 0
        ? cliInputFiles
        : [
            // 'output/sadra1/tweets_2025-09-15_06-30-58__scroll--6_profile--sadra1.json',
            // 'output/sadra1/tweets_2025-09-15_07-25-10__scroll--6_profile--sadra1.json',
            // 'output/sadra1/tweets_2025-09-15_07-14-05__scroll--6_profile--sadra1.json',
            'output/sadra1/tweets_2025-09-20_08-45-07__scroll--5_profile--sadra1.json',
            'output/sadra1/tweets_2025-09-20_08-49-04__scroll--5_profile--sadra1.json'
        ];
    
    try {
        // await analyzer.testGroqConnection();
        console.log('Starting free analysis...');
        const results = await analyzer.batchProcess(inputFiles, './analysis_results');
        
        console.log('\nFree analysis completed!');
        results.forEach(result => {
            console.log(`${result.inputFile}: ${result.success ? '✓ Success' : '✗ Failed'}`);
        });
        
    } catch (error) {
        console.error('Analysis failed:', error.message);
    }
}

// Uncomment to run
main();