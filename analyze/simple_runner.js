require('dotenv').config();
const ChatGPTAnalyzer = require('./analyzer');
const fs = require('fs');
const path = require('path');

async function runAnalysis() {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
        console.error('Please set OPENAI_API_KEY in your .env file');
        process.exit(1);
    }
    
    const analyzer = new ChatGPTAnalyzer(apiKey);
    
    // Configuration: Update these paths as needed
    const config = {
        inputDir: './input_files',
        outputDir: './analysis_results',
        filePattern: '*.json' // or specific filenames
    };
    
    try {
        // Get all JSON files from input directory
        const inputFiles = fs.readdirSync(config.inputDir)
            .filter(file => file.endsWith('.json'))
            .map(file => path.join(config.inputDir, file));
        
        if (inputFiles.length === 0) {
            console.log('No JSON files found in input directory');
            return;
        }
        
        console.log(`Found ${inputFiles.length} files to process:`);
        inputFiles.forEach(file => console.log(`  - ${file}`));
        console.log('');
        
        // Process all files
        const results = await analyzer.batchProcess(inputFiles, config.outputDir);
        
        // Print summary
        console.log('\n' + '='.repeat(50));
        console.log('ANALYSIS COMPLETE');
        console.log('='.repeat(50));
        
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        console.log(`✓ Successful: ${successful.length}`);
        console.log(`✗ Failed: ${failed.length}`);
        
        if (failed.length > 0) {
            console.log('\nFailed files:');
            failed.forEach(result => {
                console.log(`  - ${result.inputFile}: ${result.error}`);
            });
        }
        
        if (successful.length > 0) {
            console.log('\nOutput files created:');
            successful.forEach(result => {
                console.log(`  - ${result.outputFile}`);
            });
        }
        
    } catch (error) {
        console.error('Error during analysis:', error.message);
        process.exit(1);
    }
}

// Handle command line arguments for single file processing
async function processSingleFile(inputFile, outputFile) {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
        console.error('Please set OPENAI_API_KEY in your .env file');
        process.exit(1);
    }
    
    const analyzer = new ChatGPTAnalyzer(apiKey);
    
    try {
        await analyzer.processFile(inputFile, outputFile);
        console.log(`✓ Analysis complete: ${outputFile}`);
    } catch (error) {
        console.error(`✗ Analysis failed: ${error.message}`);
        process.exit(1);
    }
}

// Check command line arguments
const args = process.argv.slice(2);

if (args.length === 2) {
    // Single file mode: node run_analysis.js input.json output.txt
    processSingleFile(args[0], args[1]);
} else if (args.length === 0) {
    // Batch mode: node run_analysis.js
    runAnalysis();
} else {
    console.log('Usage:');
    console.log('  Batch mode: node run_analysis.js');
    console.log('  Single file: node run_analysis.js <input_file> <output_file>');
    console.log('');
    console.log('Examples:');
    console.log('  node run_analysis.js tweets_batch1.json analysis_batch1.txt');
    console.log('  node run_analysis.js');
}