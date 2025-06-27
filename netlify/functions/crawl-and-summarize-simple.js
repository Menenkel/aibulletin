const { OpenAI } = require('openai');
const axios = require('axios');
const cheerio = require('cheerio');

// Simple storage for API key (in production, use environment variables)
let storedApiKey = null;

// Load API key from environment variable
function getApiKey() {
  if (!storedApiKey) {
    storedApiKey = process.env.OPENAI_API_KEY;
  }
  return storedApiKey;
}

// Simple web scraping function
async function scrapeUrl(url) {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    // Check if it's a PDF
    const contentType = response.headers['content-type'] || '';
    if (contentType.toLowerCase().includes('application/pdf')) {
      return `[PDF Content from ${url}]`;
    }

    // Parse HTML
    const $ = cheerio.load(response.data);
    
    // Remove script and style elements
    $('script, style').remove();
    
    // Get text content
    let text = $('body').text();
    
    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    return text.substring(0, 5000); // Limit to 5000 characters
    
  } catch (error) {
    return `Error scraping ${url}: ${error.message}`;
  }
}

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { urls, region = 'Global Overview', custom_prompt = '' } = body;

    // Validate inputs
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No URLs provided' })
      };
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'API key not configured' })
      };
    }

    // Limit to first 3 URLs for simplicity
    const urlsToProcess = urls.slice(0, 3);

    // Scrape content from URLs
    const scrapedContent = [];
    for (const url of urlsToProcess) {
      console.log(`Scraping: ${url}`);
      const content = await scrapeUrl(url);
      scrapedContent.push(`Content from ${url}:\n${content}\n`);
    }

    // Combine all content
    const combinedContent = scrapedContent.join('\n');

    // Generate analysis using OpenAI
    const openai = new OpenAI({ apiKey });

    // Create the prompt
    let basePrompt = `
Analyze the following content from drought and food security monitoring sources for ${region}.

Provide a structured drought bulletin with the following sections:
1. Current Drought Conditions: Assess the severity and extent of drought in the region
2. Water Resources: Status of surface water, groundwater, and reservoir levels
3. Impact on Food Security and Agriculture: Effects on crops and livestock
4. Food Prices and Economic Impact: Analysis of price trends and economic consequences

Focus on recent developments, trends, and actionable insights. Provide specific data and examples where available.
`;

    if (custom_prompt) {
      basePrompt += `\n\nAdditional analysis requirements: ${custom_prompt}`;
    }

    // Make the API call
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a drought and food security analyst. Provide clear, structured analysis.'
        },
        {
          role: 'user',
          content: `${basePrompt}\n\nContent to analyze:\n${combinedContent}`
        }
      ],
      max_tokens: 1500,
      temperature: 0.3
    });

    const analysis = completion.choices[0].message.content;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        analysis,
        urls_processed: urlsToProcess,
        region,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: `Analysis failed: ${error.message}` })
    };
  }
}; 