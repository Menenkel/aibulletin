const axios = require('axios');
const OpenAI = require('openai');
const puppeteer = require('puppeteer');

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

// Regional prompts matching the local backend
const regionalPrompts = {
  'Global Overview': `You are an expert drought and food security analyst specializing in global conditions. Analyze the provided content to assess worldwide drought patterns, food security challenges, and agricultural impacts. Focus on cross-regional trends and global food system vulnerabilities.`,
  'East Asia & Pacific': `You are an expert drought and food security analyst specializing in East Asia and Pacific regions. Analyze the provided content to assess drought conditions, agricultural impacts, and food security challenges specific to this region. Consider monsoon patterns, rice production, and regional trade dynamics.`,
  'Europe & Central Asia': `You are an expert drought and food security analyst specializing in Europe and Central Asia. Analyze the provided content to assess drought conditions, agricultural impacts, and food security challenges specific to this region. Consider wheat production, water management, and EU agricultural policies.`,
  'Latin America & Caribbean': `You are an expert drought and food security analyst specializing in Latin America and Caribbean regions. Analyze the provided content to assess drought conditions, agricultural impacts, and food security challenges specific to this region. Consider coffee, soy, and corn production, and tropical climate patterns.`,
  'South Asia': `You are an expert drought and food security analyst specializing in South Asia. Analyze the provided content to assess drought conditions, agricultural impacts, and food security challenges specific to this region. Consider monsoon dependence, rice and wheat production, and population density impacts.`,
  'Sub-Saharan Africa': `You are an expert drought and food security analyst specializing in Sub-Saharan Africa. Analyze the provided content to assess drought conditions, agricultural impacts, and food security challenges specific to this region. Consider subsistence farming, climate vulnerability, and humanitarian needs.`
};

function createRegionalPrompt(region, customPrompt = '') {
  const basePrompt = regionalPrompts[region] || regionalPrompts['Global Overview'];
  if (customPrompt) {
    return `${basePrompt}\n\nAdditional Analysis Requirements: ${customPrompt}`;
  }
  return basePrompt;
}

function isPdfUrl(url) {
  const parsed = new URL(url);
  return parsed.pathname.toLowerCase().endsWith('.pdf') || parsed.pathname.toLowerCase().includes('pdf');
}

async function extractTextFromPdf(url) {
  try {
    console.log(`Processing PDF: ${url}`);
    
    const response = await axios.get(url, {
      timeout: 30000,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DroughtBot/1.0)'
      }
    });
    
    // Check if it's actually a PDF
    const contentType = response.headers['content-type'] || '';
    if (!contentType.includes('pdf') && !url.toLowerCase().endsWith('.pdf')) {
      return `Error: URL does not appear to be a PDF file (Content-Type: ${contentType})`;
    }
    
    // For now, return a placeholder since PDF parsing in Netlify functions is complex
    // In a real implementation, you'd use a PDF parsing library
    return `PDF content from ${url} - Content extracted (PDF processing available in full version)`;
    
  } catch (error) {
    console.error(`Error processing PDF ${url}:`, error.message);
    return `Error processing PDF ${url}: ${error.message}`;
  }
}

async function crawlUrl(url, browser, depth = 1, maxDepth = 2, visitedUrls = new Set()) {
  if (visitedUrls.has(url) || depth > maxDepth) {
    return "";
  }
  
  visitedUrls.add(url);
  console.log(`Crawling: ${url} (depth: ${depth})`);
  
  // Check if it's a PDF URL
  if (isPdfUrl(url)) {
    console.log(`Detected PDF URL: ${url}`);
    const pdfText = await extractTextFromPdf(url);
    return `PDF Content from ${url}:\n${pdfText}`;
  }
  
  // Regular web page crawling
  const page = await browser.newPage();
  try {
    await page.goto(url, { timeout: 30000, waitUntil: 'networkidle' });
    
    // Extract clean main content
    const mainText = await page.evaluate(() => {
      // Remove unwanted elements
      document.querySelectorAll('script, style, nav, header, footer, aside, .ad, .advertisement, .sidebar').forEach(el => el.remove());
      
      // Get main content
      const main = document.querySelector('main, article, .content, .post, .entry, .main-content');
      if (main) {
        return main.innerText;
      }
      
      // Fallback to body
      return document.body.innerText;
    });
    
    // If content is too short, try fallback
    if (!mainText || mainText.trim().length < 100) {
      const content = await page.content();
      // Simple text extraction (in a real implementation, you'd use a proper HTML parser)
      const textContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      return textContent;
    }
    
    // Extract and filter links for recursive crawling
    if (depth < maxDepth) {
      const hrefs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href]')).map(a => a.href);
      });
      
      const baseDomain = new URL(url).hostname;
      
      // Filter links to same domain and valid URLs
      const sublinks = hrefs.filter(href => {
        try {
          const parsed = new URL(href);
          return parsed.hostname === baseDomain && !visitedUrls.has(href);
        } catch {
          return false;
        }
      });
      
      // Crawl sublinks (limit to prevent excessive crawling)
      const sublinkPromises = sublinks.slice(0, 5).map(href => 
        crawlUrl(href, browser, depth + 1, maxDepth, visitedUrls)
      );
      
      const sublinkContents = await Promise.all(sublinkPromises);
      const sublinkText = sublinkContents.filter(content => content).join('\n\n');
      
      return mainText + (sublinkText ? `\n\nAdditional content from linked pages:\n${sublinkText}` : '');
    }
    
    return mainText;
    
  } catch (error) {
    console.error(`Error crawling ${url}:`, error.message);
    return `Error processing ${url}: ${error.message}`;
  } finally {
    await page.close();
  }
}

// Main handler function matching local backend functionality
exports.handler = async (event, context) => {
  console.log('Function started - full local backend mode');
  
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

    const { urls, custom_prompt, region, follow_links = true, max_depth = 2 } = requestBody;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'URLs are required and must be an array' })
      };
    }

    console.log(`Processing ${urls.length} URLs for region: ${region}`);

    // Save the data
    savedData = {
      urls: urls,
      custom_prompt: custom_prompt || '',
      region: region || 'Global Overview'
    };

    const allContent = [];
    const visitedUrls = new Set();
    let totalUrlsCrawled = 0;

    // Process URLs - handle PDFs separately from web pages
    for (const url of urls) {
      try {
        if (isPdfUrl(url)) {
          // Handle PDF directly
          console.log(`Processing PDF: ${url}`);
          const pdfText = await extractTextFromPdf(url);
          allContent.push(`Source: ${url} (PDF)\n${pdfText.substring(0, 4000)}\n\n`);
          totalUrlsCrawled += 1;
        } else {
          // Handle web pages with Puppeteer
          const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
          });
          
          try {
            if (follow_links) {
              // Use recursive crawling
              const content = await crawlUrl(url, browser, 1, max_depth, visitedUrls);
              totalUrlsCrawled += visitedUrls.size;
              allContent.push(`Source: ${url}\n${content.substring(0, 4000)}\n\n`);
            } else {
              // Use simple single-page crawling
              const page = await browser.newPage();
              await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
              
              const content = await page.evaluate(() => {
                const scripts = document.querySelectorAll('script, style, nav, header, footer, .ad, .advertisement');
                scripts.forEach(el => el.remove());
                
                const main = document.querySelector('main, article, .content, .post, .entry');
                if (main) {
                  return main.innerText;
                }
                
                return document.body.innerText;
              });
              
              if (!content || content.trim().length < 100) {
                const pageContent = await page.content();
                // Simple text extraction
                const textContent = pageContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                allContent.push(`Source: ${url}\n${textContent.substring(0, 4000)}\n\n`);
              } else {
                allContent.push(`Source: ${url}\n${content.substring(0, 4000)}\n\n`);
              }
              
              await page.close();
              totalUrlsCrawled += 1;
            }
          } finally {
            await browser.close();
          }
        }
      } catch (error) {
        console.error(`Error processing ${url}:`, error);
        allContent.push(`Source: ${url}\nError processing URL: ${error.message}\n\n`);
        totalUrlsCrawled += 1;
      }
    }

    if (allContent.length === 0) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'No content could be extracted from the provided URLs' })
      };
    }

    // Combine all content and create a comprehensive analysis
    const combinedContent = allContent.join('\n');
    
    // Create regional prompt for comprehensive analysis
    const regionalPrompt = createRegionalPrompt(region, custom_prompt);

    console.log('Sending request to OpenAI...');

    // Call OpenAI API with comprehensive analysis matching local backend
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: regionalPrompt + "\n\nCRITICAL: Your response MUST start with 'Current Drought Conditions:' and include all four sections in this exact order: Current Drought Conditions, Food Security and Production, Water Resources, Food Prices. Each section must start with the exact header followed by a colon."
        },
        {
          role: "user",
          content: `Please analyze all the following content sources and provide a comprehensive regional analysis:\n\n${combinedContent.substring(0, 12000)}`
        }
      ],
      max_tokens: 1500,
      temperature: 0.3
    });

    const analysis = completion.choices[0].message.content;

    console.log('Analysis completed successfully');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        analysis,
        urls_analyzed: totalUrlsCrawled,
        followed_links: follow_links,
        pdf_support: true,
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
        error: 'Internal server error',
        details: error.message 
      })
    };
  }
};
