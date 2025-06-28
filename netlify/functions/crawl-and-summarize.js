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

// Simple content extraction function
async function extractContent(url) {
  try {
    console.log(`Extracting content from: ${url}`);
    
    const response = await axios.get(url, {
      timeout: 10000, // 10 second timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    // Extract text content from HTML
    const html = response.data;
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return textContent.substring(0, 3000); // Limit to 3000 characters
  } catch (error) {
    console.error(`Error extracting content from ${url}:`, error.message);
    return `Error extracting content from ${url}: ${error.message}`;
  }
}

// Main handler function
exports.handler = async (event, context) => {
  console.log('Function started');
  
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

    // Limit to 2 URLs maximum
    const limitedUrls = urls.slice(0, 2);
    console.log(`Processing ${limitedUrls.length} URLs for region: ${region}`);

    // Extract content from URLs
    let allContent = '';
    const processedUrls = [];

    for (const url of limitedUrls) {
      try {
        const content = await extractContent(url);
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

    // Limit content size
    const maxContentLength = 4000;
    if (allContent.length > maxContentLength) {
      allContent = allContent.substring(0, maxContentLength) + '\n\n[Content truncated]';
    }

    // Prepare the prompt
    const basePrompt = custom_prompt || `Provide a brief drought analysis for ${region} based on the following content. Focus on:
1. Current drought conditions
2. Impact on agriculture
3. Key concerns

Keep the response concise and structured.`;

    const fullPrompt = `${basePrompt}\n\nContent:\n${allContent}`;

    console.log('Sending request to OpenAI...');

    // Call OpenAI API with strict timeout
    const completion = await Promise.race([
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a drought analyst. Provide concise, accurate analysis."
          },
          {
            role: "user",
            content: fullPrompt
          }
        ],
        max_tokens: 1000, // Very limited tokens
        temperature: 0.3
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OpenAI API timeout')), 15000)
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
