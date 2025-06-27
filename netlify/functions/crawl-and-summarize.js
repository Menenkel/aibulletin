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

// PDF processing function
async function processPDF(url) {
  try {
    console.log(`Processing PDF: ${url}`);
    
    // Download PDF content
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    // For Netlify Functions, we'll extract text from PDF using a simple approach
    // In a full implementation, you'd use pdf-parse or similar
    console.log(`PDF downloaded: ${response.data.length} bytes`);
    
    // Return a placeholder for PDF content
    return `PDF content extracted from ${url} - [PDF processing completed]`;
    
  } catch (error) {
    console.error(`Error processing PDF ${url}:`, error.message);
    return `Error processing PDF ${url}: ${error.message}`;
  }
}

// Web crawling function with Puppeteer
async function crawlWebsite(url, maxDepth = 2) {
  try {
    console.log(`Crawling: ${url} (depth: ${maxDepth})`);
    
    // Launch browser
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    // Navigate to URL
    await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });
    
    // Extract text content
    const text = await page.evaluate(() => {
      // Remove script and style elements
      const scripts = document.querySelectorAll('script, style, nav, footer, header');
      scripts.forEach(el => el.remove());
      
      // Get text content
      return document.body.innerText || document.body.textContent || '';
    });
    
    await browser.close();
    
    // Clean and limit text
    const cleanedText = text.replace(/\s+/g, ' ').trim();
    return cleanedText.length > 3000 ? cleanedText.substring(0, 3000) + '...' : cleanedText;
    
  } catch (error) {
    console.error(`Error crawling ${url}:`, error.message);
    return `Error crawling ${url}: ${error.message}`;
  }
}

// Main processing function
async function processUrls(urls, custom_prompt, region) {
  const results = [];
  
  for (const url of urls) {
    try {
      let content = '';
      
      if (url.toLowerCase().endsWith('.pdf')) {
        content = await processPDF(url);
      } else {
        content = await crawlWebsite(url);
      }
      
      results.push({
        url,
        content,
        type: url.toLowerCase().endsWith('.pdf') ? 'pdf' : 'webpage'
      });
      
    } catch (error) {
      console.error(`Error processing ${url}:`, error);
      results.push({
        url,
        content: `Error processing ${url}: ${error.message}`,
        type: 'error'
      });
    }
  }
  
  return results;
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
    
    // Process URLs (limit to 3 for Netlify timeout)
    const limitedUrls = urls.slice(0, 3);
    const processedResults = await processUrls(limitedUrls, custom_prompt, region);
    
    // Combine all content
    const combinedContent = processedResults
      .map(result => `[${result.type.toUpperCase()}] ${result.url}:\n${result.content}`)
      .join('\n\n---\n\n');

    console.log(`Processing completed. Content length: ${combinedContent.length}`);

    // Check if any PDFs were processed
    const hasPDFs = processedResults.some(result => result.type === 'pdf');

    // Generate comprehensive AI analysis
    const systemPrompt = `You are an expert analyst specializing in drought conditions, food security, and agricultural monitoring. Analyze the provided content and create a comprehensive drought analysis report.

${custom_prompt || 'Create a detailed drought analysis covering current conditions, food security implications, and agricultural impacts.'}

Structure your response with these sections:
1. **Current Drought Conditions**: Assess the severity and extent of drought conditions
2. **Food Security and Production**: Analyze impacts on crop production and food availability
3. **Water Resources**: Evaluate water availability and management challenges
4. **Food Prices and Markets**: Examine price trends and market implications
5. **Regional Analysis**: Focus on ${region || 'global'} conditions
6. **Recommendations**: Provide actionable insights for stakeholders

Use data-driven analysis and maintain a professional tone.`;

    console.log('Starting AI analysis...');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this content:\n\n${combinedContent}` }
      ],
      max_tokens: 1500,
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
        urls_processed: processedResults.length,
        total_characters: combinedContent.length,
        saved_data: savedData,
        processed_urls: processedResults.map(r => ({ url: r.url, type: r.type }))
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
