const axios = require('axios');
const OpenAI = require('openai');
const cheerio = require('cheerio');
const pdf = require('pdf-parse');

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

// PDF text extraction function
async function extractTextFromPDF(pdfUrl) {
  try {
    console.log(`Processing PDF: ${pdfUrl}`);
    const response = await axios.get(pdfUrl, {
      responseType: 'arraybuffer',
      timeout: 15000, // Reduced timeout for Netlify
    });
    
    const data = await pdf(response.data);
    return data.text;
  } catch (error) {
    console.error(`Error processing PDF ${pdfUrl}:`, error.message);
    return `Error processing PDF: ${error.message}`;
  }
}

// Web crawling function
async function crawlUrl(url, depth = 1, maxDepth = 1, visited = new Set()) {
  if (depth > maxDepth || visited.has(url)) {
    return '';
  }
  
  visited.add(url);
  
  try {
    console.log(`Crawling: ${url} (depth: ${depth})`);
    
    // Check if it's a PDF URL
    if (url.toLowerCase().endsWith('.pdf')) {
      console.log(`Detected PDF URL: ${url}`);
      return await extractTextFromPDF(url);
    }
    
    const response = await axios.get(url, {
      timeout: 8000, // Reduced timeout for Netlify
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    // Remove script and style elements
    $('script, style, nav, footer, header').remove();
    
    let text = $('body').text();
    
    // Clean up text and limit length for Netlify
    text = text.replace(/\s+/g, ' ').trim();
    if (text.length > 5000) {
      text = text.substring(0, 5000) + '... [Content truncated for processing]';
    }
    
    // Only follow links if explicitly requested and not at max depth
    if (depth < maxDepth && depth === 1) {
      const links = $('a[href]').map((i, el) => $(el).attr('href')).get();
      const baseUrl = new URL(url);
      
      // Limit to 2 links to avoid timeout
      for (const link of links.slice(0, 2)) {
        try {
          const absoluteUrl = new URL(link, baseUrl).href;
          if (absoluteUrl.startsWith('http') && !visited.has(absoluteUrl)) {
            const linkText = await crawlUrl(absoluteUrl, depth + 1, maxDepth, visited);
            if (linkText) {
              text += '\n\n' + linkText;
            }
          }
        } catch (error) {
          console.error(`Error following link ${link}:`, error.message);
        }
      }
    }
    
    return text;
  } catch (error) {
    console.error(`Error crawling ${url}:`, error.message);
    return `Error crawling ${url}: ${error.message}`;
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
    console.log('Function started with method:', event.httpMethod);
    console.log('Event body:', event.body);
    
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
    const { urls, custom_prompt, region, follow_links = false, max_depth = 1 } = body;

    console.log('Request body parsed:', { urls, follow_links, max_depth, custom_prompt, region });

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
    console.log('Saved data for future reference:', savedData);

    console.log('Starting URL crawling...');
    
    // Limit to 2 URLs to avoid timeout
    const limitedUrls = urls.slice(0, 2);
    
    // Crawl all URLs with timeout protection
    const crawlPromises = limitedUrls.map(url => 
      Promise.race([
        crawlUrl(url, 1, follow_links ? Math.min(max_depth, 1) : 1, new Set()),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Crawl timeout')), 6000)
        )
      ]).catch(error => {
        console.error(`Crawl failed for ${url}:`, error.message);
        return `Error crawling ${url}: ${error.message}`;
      })
    );
    
    const crawledTexts = await Promise.all(crawlPromises);
    const combinedText = crawledTexts.join('\n\n---\n\n');

    console.log(`Crawling completed. Total text length: ${combinedText.length}`);

    // Check if any PDFs were processed
    const hasPDFs = limitedUrls.some(url => url.toLowerCase().endsWith('.pdf'));

    // Generate AI analysis
    const systemPrompt = `You are an expert analyst specializing in drought conditions, food security, and agricultural monitoring. Analyze the provided content and create a comprehensive AI drought analysis report.

${custom_prompt || 'Create a comprehensive drought analysis covering current conditions, food security, water resources, and food prices.'}

IMPORTANT: Structure your response with these EXACT section headers:
- Current Drought Conditions
- Food Security and Production
- Water Resources
- Food Prices

Each section should be detailed and based on the provided content. If information is not available for a section, indicate this clearly.`;

    console.log('Starting AI analysis...');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Please analyze the following content and provide a structured drought analysis:\n\n${combinedText}` }
      ],
      max_tokens: 1000, // Reduced for faster response
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
        saved_data: savedData, // Include saved data in response
      }),
    };

  } catch (error) {
    console.error('Function error:', error);
    console.error('Error stack:', error.stack);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message,
        stack: error.stack
      }),
    };
  }
};
