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

// Ultra-fast content extraction with minimal processing
async function extractContent(url) {
  try {
    console.log(`Extracting content from: ${url}`);
    
    const response = await axios.get(url, {
      timeout: 5000, // 5 second timeout - very aggressive
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DroughtBot/1.0)'
      }
    });
    
    // Minimal text extraction
    const html = response.data;
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return textContent.substring(0, 1500); // Very limited content
  } catch (error) {
    console.error(`Error extracting content from ${url}:`, error.message);
    return `Error: ${error.message}`;
  }
}

// Main handler function with aggressive timeout prevention
exports.handler = async (event, context) => {
  console.log('Function started - ultra-fast mode');
  
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

    // Limit to 1 URL maximum for ultra-fast processing
    const limitedUrls = urls.slice(0, 1);
    console.log(`Processing ${limitedUrls.length} URL for region: ${region}`);

    // Extract content from URL with timeout protection
    let allContent = '';
    const processedUrls = [];

    for (const url of limitedUrls) {
      try {
        const content = await Promise.race([
          extractContent(url),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Content extraction timeout')), 6000)
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

    // Very limited content size
    const maxContentLength = 2000;
    if (allContent.length > maxContentLength) {
      allContent = allContent.substring(0, maxContentLength) + '\n\n[Content truncated]';
    }

    // Simple prompt
    const basePrompt = custom_prompt || `Provide a brief drought analysis for ${region}. Focus on current conditions and key concerns. Keep it very concise.`;

    const fullPrompt = `${basePrompt}\n\nContent:\n${allContent}`;

    console.log('Sending request to OpenAI...');

    // Call OpenAI API with very strict timeout
    const completion = await Promise.race([
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a drought analyst. Provide very concise analysis."
          },
          {
            role: "user",
            content: fullPrompt
          }
        ],
        max_tokens: 500, // Very limited tokens
        temperature: 0.3
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OpenAI API timeout')), 8000)
      )
    ]);

    const analysis = completion.choices[0].message.content;

    // Save the data
    savedData = {
      urls: processedUrls,
      custom_prompt: custom_prompt || '',
      region: region || 'Global Overview'
    };

    console.log('Analysis completed successfully - under 10 seconds');

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
