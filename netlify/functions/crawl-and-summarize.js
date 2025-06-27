const axios = require('axios');
const OpenAI = require('openai');

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

// Simplified text extraction function
async function extractTextFromUrl(url) {
  try {
    console.log(`Processing URL: ${url}`);
    
    // Check if it's a PDF URL
    if (url.toLowerCase().endsWith('.pdf')) {
      console.log(`PDF detected: ${url}`);
      return `PDF content from ${url} - [PDF processing would be implemented here]`;
    }
    
    const response = await axios.get(url, {
      timeout: 5000, // Very short timeout for Netlify
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    // Simple text extraction - just get the text content
    const text = response.data.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Limit text length
    return text.length > 2000 ? text.substring(0, 2000) + '...' : text;
    
  } catch (error) {
    console.error(`Error processing ${url}:`, error.message);
    return `Error processing ${url}: ${error.message}`;
  }
}

// Main function
exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    console.log('Function started');
    
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }

    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    const body = JSON.parse(event.body);
    const { urls, custom_prompt, region } = body;

    console.log('Request received:', { urls: urls?.length, custom_prompt: !!custom_prompt, region });

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'URLs array is required' }),
      };
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not configured');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'OpenAI API key not configured' }),
      };
    }

    // Save the data for future reference
    savedData = {
      urls: urls,
      custom_prompt: custom_prompt || '',
      region: region || 'Global Overview'
    };

    console.log('Starting URL processing...');
    
    // Limit to 1 URL to avoid timeout
    const limitedUrls = urls.slice(0, 1);
    
    // Process URLs with timeout protection
    const textPromises = limitedUrls.map(url => 
      Promise.race([
        extractTextFromUrl(url),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Processing timeout')), 4000)
        )
      ]).catch(error => {
        console.error(`Processing failed for ${url}:`, error.message);
        return `Error processing ${url}: ${error.message}`;
      })
    );
    
    const extractedTexts = await Promise.all(textPromises);
    const combinedText = extractedTexts.join('\n\n---\n\n');

    console.log(`Processing completed. Text length: ${combinedText.length}`);

    // Check if any PDFs were processed
    const hasPDFs = limitedUrls.some(url => url.toLowerCase().endsWith('.pdf'));

    // Generate AI analysis with shorter prompt
    const systemPrompt = `You are an expert analyst specializing in drought conditions and food security. Analyze the provided content and create a brief drought analysis report.

${custom_prompt || 'Create a brief drought analysis covering current conditions and food security.'}

Structure your response with these sections:
- Current Drought Conditions
- Food Security and Production
- Water Resources
- Food Prices

Keep each section concise.`;

    console.log('Starting AI analysis...');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this content:\n\n${combinedText}` }
      ],
      max_tokens: 800, // Very short for faster response
      temperature: 0.3,
    });

    const summary = completion.choices[0].message.content;
    console.log('AI analysis completed');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        summary,
        pdf_support: hasPDFs,
        urls_processed: limitedUrls.length,
        total_characters: combinedText.length,
        saved_data: savedData,
      }),
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message,
      }),
    };
  }
};
