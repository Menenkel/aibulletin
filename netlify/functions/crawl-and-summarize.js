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
    
    // Download PDF content with full timeout
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000, // Full timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    // For Netlify Functions, we'll extract text from PDF using a simple approach
    // In a real implementation, you'd use a PDF parsing library
    const pdfContent = `PDF content from ${url} - This is a placeholder for actual PDF text extraction.`;
    
    return {
      url: url,
      content: pdfContent,
      type: 'pdf'
    };
  } catch (error) {
    console.error(`Error processing PDF ${url}:`, error.message);
    return {
      url: url,
      content: `Error processing PDF: ${error.message}`,
      type: 'pdf_error'
    };
  }
}

// Web crawling function
async function crawlWebsite(url, maxDepth = 2, followLinks = true) {
  const visited = new Set();
  const results = [];
  
  async function crawlPage(currentUrl, depth = 0) {
    if (depth > maxDepth || visited.has(currentUrl)) return;
    visited.add(currentUrl);
    
    try {
      console.log(`Crawling: ${currentUrl} (depth: ${depth})`);
      
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      await page.setDefaultNavigationTimeout(30000);
      
      await page.goto(currentUrl, { waitUntil: 'networkidle' });
      
      // Extract text content
      const content = await page.evaluate(() => {
        return document.body.innerText || document.body.textContent || '';
      });
      
      // Extract links if following links
      let links = [];
      if (followLinks && depth < maxDepth) {
        links = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('a[href]'))
            .map(a => a.href)
            .filter(href => href.startsWith('http') && !href.includes('#'))
            .slice(0, 10); // Limit to 10 links per page
        });
      }
      
      await browser.close();
      
      results.push({
        url: currentUrl,
        content: content.substring(0, 10000), // Limit content size
        type: 'webpage'
      });
      
      // Recursively crawl links
      if (followLinks && depth < maxDepth) {
        for (const link of links.slice(0, 5)) { // Limit to 5 links
          if (!visited.has(link)) {
            await crawlPage(link, depth + 1);
          }
        }
      }
      
    } catch (error) {
      console.error(`Error crawling ${currentUrl}:`, error.message);
      results.push({
        url: currentUrl,
        content: `Error crawling: ${error.message}`,
        type: 'error'
      });
    }
  }
  
  await crawlPage(url);
  return results;
}

// Main handler function
exports.handler = async (event, context) => {
  console.log('Function started');
  
  try {
    // Set CORS headers
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

    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    console.log('Processing POST request');
    
    // Parse request body
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

    const { urls, region, custom_prompt, follow_links = true, max_depth = 2 } = requestBody;
    
    console.log('Request parameters:', { urls, region, custom_prompt, follow_links, max_depth });

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'URLs array is required and cannot be empty' })
      };
    }

    if (!process.env.OPENAI_API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'OpenAI API key not configured' })
      };
    }

    console.log('Starting content collection');
    
    // Collect content from all URLs
    const allContent = [];
    
    for (const url of urls) {
      try {
        if (url.toLowerCase().endsWith('.pdf')) {
          const pdfResult = await processPDF(url);
          allContent.push(pdfResult);
        } else {
          const webResults = await crawlWebsite(url, max_depth, follow_links);
          allContent.push(...webResults);
        }
      } catch (error) {
        console.error(`Error processing URL ${url}:`, error);
        allContent.push({
          url: url,
          content: `Error processing: ${error.message}`,
          type: 'error'
        });
      }
    }

    console.log(`Collected content from ${allContent.length} sources`);

    // Combine all content
    const combinedContent = allContent
      .map(item => `Source: ${item.url}\nContent: ${item.content}\n---\n`)
      .join('\n');

    console.log('Generating AI analysis');
    
    // Generate analysis using OpenAI
    const prompt = custom_prompt || `Analyze the following content about drought and food security in the ${region} region. Provide a comprehensive summary including:
1. Key drought conditions and impacts
2. Food security concerns
3. Affected areas and populations
4. Recommendations for monitoring and response
5. Recent developments and trends

Format the response as a structured drought bulletin.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert analyst specializing in drought monitoring and food security assessment. Provide clear, structured analysis based on the provided content."
        },
        {
          role: "user",
          content: `${prompt}\n\nContent to analyze:\n${combinedContent.substring(0, 32000)}` // Limit content size
        }
      ],
      max_tokens: 2000,
      temperature: 0.3
    });

    const analysis = completion.choices[0].message.content;

    console.log('Analysis completed successfully');

    // Save data
    savedData = {
      urls: urls,
      custom_prompt: custom_prompt || '',
      region: region || 'Global Overview'
    };

    const result = {
      summary: analysis,
      sources: allContent.map(item => ({
        url: item.url,
        type: item.type,
        content_length: item.content.length
      })),
      metadata: {
        region: region,
        urls_processed: urls.length,
        content_sources: allContent.length,
        timestamp: new Date().toISOString()
      }
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      })
    };
  }
};
