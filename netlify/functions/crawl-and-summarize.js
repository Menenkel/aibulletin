const axios = require('axios');
const OpenAI = require('openai');
const puppeteer = require('puppeteer');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Simple in-memory storage for saved data
let savedData = {
  urls: [],
  custom_prompt: '',
  region: 'Global Overview'
};

// PDF processing function with reduced timeout
async function processPDF(url) {
  try {
    console.log(`Processing PDF: ${url}`);
    
    // Download PDF content with shorter timeout for Netlify
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000, // Reduced timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    // For Netlify Functions, we'll extract text from PDF using a simple approach
    // In a real implementation, you'd use a PDF parsing library
    return `PDF content from ${url} - [PDF processing would extract text here]`;
  } catch (error) {
    console.error(`Error processing PDF ${url}:`, error.message);
    return `Error processing PDF: ${error.message}`;
  }
}

// Web crawling function with optimized settings
async function crawlWebsite(url, maxDepth = 1) {
  let browser = null;
  try {
    console.log(`Crawling: ${url} (depth: ${maxDepth})`);
    
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    // Set shorter timeout for Netlify Functions
    await page.goto(url, { 
      waitUntil: 'domcontentloaded', // Changed from networkidle for faster loading
      timeout: 15000 // Reduced timeout
    });
    
    // Extract text content with timeout
    const content = await Promise.race([
      page.evaluate(() => {
        return document.body.innerText || document.body.textContent || '';
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Content extraction timeout')), 10000)
      )
    ]);
    
    return content.substring(0, 5000); // Limit content size
  } catch (error) {
    console.error(`Error crawling ${url}:`, error.message);
    return `Error crawling ${url}: ${error.message}`;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError.message);
      }
    }
  }
}

// Main handler function
exports.handler = async (event, context) => {
  console.log('Function started with event:', JSON.stringify(event, null, 2));
  
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  try {
    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers,
        body: ''
      };
    }

    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'OpenAI API key not configured' })
      };
    }

    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (error) {
      console.error('Error parsing request body:', error);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid JSON in request body' })
      };
    }

    const { urls, custom_prompt, region, follow_links, max_depth } = requestBody;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'URLs are required and must be an array' })
      };
    }

    // Limit number of URLs to prevent timeout
    const limitedUrls = urls.slice(0, 3);
    console.log(`Processing ${limitedUrls.length} URLs for region: ${region}`);

    // Collect content from all URLs with timeout protection
    let allContent = '';
    const processedUrls = [];

    for (const url of limitedUrls) {
      try {
        console.log(`Processing URL: ${url}`);
        
        if (url.toLowerCase().endsWith('.pdf')) {
          const pdfContent = await processPDF(url);
          allContent += `\n\n=== PDF Content from ${url} ===\n${pdfContent}`;
        } else {
          const webContent = await crawlWebsite(url, Math.min(max_depth || 1, 1));
          allContent += `\n\n=== Web Content from ${url} ===\n${webContent}`;
        }
        
        processedUrls.push(url);
      } catch (error) {
        console.error(`Error processing ${url}:`, error);
        allContent += `\n\n=== Error processing ${url} ===\n${error.message}`;
      }
    }

    if (!allContent.trim()) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'No content could be extracted from the provided URLs' })
      };
    }

    // Limit content size to prevent token limit issues
    const maxContentLength = 8000;
    if (allContent.length > maxContentLength) {
      allContent = allContent.substring(0, maxContentLength) + '\n\n[Content truncated due to length limits]';
    }

    // Prepare the prompt for OpenAI
    const basePrompt = custom_prompt || `Analyze the following content and provide a comprehensive drought analysis for ${region}. Focus on:
1. Current drought conditions and severity
2. Impact on agriculture and food security
3. Water availability and management
4. Climate patterns and trends
5. Recommendations for stakeholders
6. Key risks and concerns

Please structure your response with clear sections and actionable insights.`;

    const fullPrompt = `${basePrompt}\n\nContent to analyze:\n${allContent}`;

    console.log('Sending request to OpenAI...');

    // Call OpenAI API with timeout protection
    const completion = await Promise.race([
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert drought analyst with deep knowledge of climate science, agriculture, and water resource management. Provide detailed, accurate, and actionable analysis."
          },
          {
            role: "user",
            content: fullPrompt
          }
        ],
        max_tokens: 2000, // Reduced token limit
        temperature: 0.3
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OpenAI API timeout')), 25000)
      )
    ]);

    const analysis = completion.choices[0].message.content;

    // Save the data
    savedData = {
      urls: processedUrls,
      custom_prompt: custom_prompt || '',
      region: region || 'Global Overview'
    };

    console.log('Analysis completed successfully');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        analysis,
        processed_urls: processedUrls,
        region: region || 'Global Overview',
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        details: 'An error occurred during processing. Please check the logs for more details.'
      })
    };
  }
};
