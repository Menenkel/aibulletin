const axios = require('axios');
const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Simple in-memory storage
let savedData = {
  urls: [],
  custom_prompt: '',
  region: 'Global Overview'
};

// Enhanced content extraction with better processing
async function extractContent(url) {
  try {
    console.log(`Extracting content from: ${url}`);
    
    const response = await axios.get(url, {
      timeout: 8000, // 8 second timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DroughtBot/1.0)'
      }
    });
    
    // Better text extraction
    const html = response.data;
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return textContent.substring(0, 3000); // More content per URL
  } catch (error) {
    console.error(`Error extracting content from ${url}:`, error.message);
    return `Error: ${error.message}`;
  }
}

// Main handler function with balanced timeout prevention
exports.handler = async (event, context) => {
  console.log('Function started - enhanced mode');
  
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

    const { urls, custom_prompt, region } = requestBody;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'URLs are required and must be an array' })
      };
    }

    // Process up to 3 URLs for better analysis
    const limitedUrls = urls.slice(0, 3);
    console.log(`Processing ${limitedUrls.length} URLs for region: ${region}`);

    // Extract content from URLs with timeout protection
    let allContent = '';
    const processedUrls = [];

    for (const url of limitedUrls) {
      try {
        const content = await Promise.race([
          extractContent(url),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Content extraction timeout')), 10000)
          )
        ]);
        
        allContent += `\n\n=== Content from ${url} ===\n${content}`;
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

    // Increased content size for better analysis
    const maxContentLength = 6000;
    if (allContent.length > maxContentLength) {
      allContent = allContent.substring(0, maxContentLength) + '\n\n[Content truncated]';
    }

    // Enhanced prompt for better analysis
    const basePrompt = custom_prompt || `Analyze the drought and food security situation for ${region}. Focus on:
1. Current drought conditions and severity
2. Impact on agriculture and food production
3. Water resource availability
4. Food security concerns
5. Key recommendations or alerts

Provide a comprehensive but concise analysis based on the available data.`;

    const fullPrompt = `${basePrompt}\n\nContent:\n${allContent}`;

    console.log('Sending request to OpenAI...');

    // Call OpenAI API with reasonable timeout
    const completion = await Promise.race([
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert drought and food security analyst. Provide comprehensive analysis based on the provided content. Focus on actionable insights and current conditions."
          },
          {
            role: "user",
            content: fullPrompt
          }
        ],
        max_tokens: 1000, // More tokens for better analysis
        temperature: 0.3
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OpenAI API timeout')), 12000)
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
        details: 'An error occurred during processing.'
      })
    };
  }
};
