const axios = require('axios');
const OpenAI = require('openai');
const cheerio = require('cheerio');
const pdf = require('pdf-parse');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// PDF text extraction function
async function extractTextFromPDF(pdfUrl) {
  try {
    console.log(`Downloading PDF: ${pdfUrl}`);
    const response = await axios.get(pdfUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    
    const data = await pdf(response.data);
    return data.text;
  } catch (error) {
    console.error(`Error processing PDF ${pdfUrl}:`, error.message);
    return `Error processing PDF: ${error.message}`;
  }
}

// Web crawling function
async function crawlUrl(url, depth = 1, maxDepth = 2, visited = new Set()) {
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
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    // Remove script and style elements
    $('script, style, nav, footer, header').remove();
    
    let text = $('body').text();
    
    // Clean up text
    text = text.replace(/\s+/g, ' ').trim();
    
    // If following links and not at max depth
    if (depth < maxDepth) {
      const links = $('a[href]').map((i, el) => $(el).attr('href')).get();
      const baseUrl = new URL(url);
      
      for (const link of links.slice(0, 5)) { // Limit to 5 links
        try {
          const absoluteUrl = new URL(link, baseUrl).href;
          if (absoluteUrl.startsWith('http') && !visited.has(absoluteUrl)) {
            const linkText = await crawlUrl(absoluteUrl, depth + 1, maxDepth, visited);
            text += '\n\n' + linkText;
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
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }

    const body = JSON.parse(event.body);
    const { urls, custom_prompt, region, follow_links = false, max_depth = 1 } = body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'URLs array is required' }),
      };
    }

    if (!process.env.OPENAI_API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'OpenAI API key not configured' }),
      };
    }

    // Crawl all URLs
    const crawlPromises = urls.map(url => 
      crawlUrl(url, 1, follow_links ? max_depth : 1, new Set())
    );
    
    const crawledTexts = await Promise.all(crawlPromises);
    const combinedText = crawledTexts.join('\n\n---\n\n');

    // Check if any PDFs were processed
    const hasPDFs = urls.some(url => url.toLowerCase().endsWith('.pdf'));

    // Generate AI analysis
    const systemPrompt = `You are an expert analyst specializing in drought conditions, food security, and agricultural monitoring. Analyze the provided content and create a comprehensive AI drought analysis report.

${custom_prompt || 'Create a comprehensive drought analysis covering current conditions, food security, water resources, and food prices.'}

IMPORTANT: Structure your response with these EXACT section headers:
- Current Drought Conditions
- Food Security and Production
- Water Resources
- Food Prices

Each section should be detailed and based on the provided content. If information is not available for a section, indicate this clearly.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Please analyze the following content and provide a structured drought analysis:\n\n${combinedText}` }
      ],
      max_tokens: 2000,
      temperature: 0.3,
    });

    const summary = completion.choices[0].message.content;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        summary,
        pdf_support: hasPDFs,
        urls_processed: urls.length,
        total_characters: combinedText.length,
      }),
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
    };
  }
};
