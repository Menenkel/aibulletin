const axios = require('axios');
const OpenAI = require('openai');
const puppeteer = require('puppeteer');
const pdf = require('pdf-parse');
const cheerio = require('cheerio');

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
    
    // Extract text from PDF using pdf-parse
    const pdfData = await pdf(response.data);
    return pdfData.text || 'No text content could be extracted from the PDF.';
    
  } catch (error) {
    console.error(`Error processing PDF ${url}:`, error.message);
    return `Error processing PDF ${url}: ${error.message}`;
  }
}

async function crawlUrl(url, browser, depth = 1, maxDepth = 2, visitedUrls = new Set(), startTime = null, maxElapsedMs = 8000) {
  if (!startTime) startTime = Date.now();
  if (visitedUrls.has(url) || depth > maxDepth) {
    return "";
  }
  if (Date.now() - startTime > maxElapsedMs) {
    return "[Crawl stopped early due to Netlify timeout limit. Partial results only.]";
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
    
    // Extract main text
    const mainText = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script, style, nav, header, footer, .ad, .advertisement');
      scripts.forEach(el => el.remove());
      const main = document.querySelector('main, article, .content, .post, .entry');
      if (main) {
        return main.innerText;
      }
      return document.body.innerText;
    });
    
    // Find sublinks
    const sublinks = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      return anchors.map(a => a.href).filter(href => href.startsWith('http'));
    });
    
    // Limit to 2 sublinks
    sublinks = sublinks.slice(0, 2);
    const sublinkContents = await Promise.all(
      sublinks.map(href => crawlUrl(href, browser, depth + 1, maxDepth, visitedUrls, startTime, maxElapsedMs))
    );
    const sublinkText = sublinkContents.filter(content => content).join('\n\n');
    return mainText + (sublinkText ? `\n\nAdditional content from linked pages:\n${sublinkText}` : '');
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

    // Extract API key
    const body = JSON.parse(event.body);
    const api_key = body.api_key || process.env.OPENAI_API_KEY;

    // Development mode: mock analysis if 'story' is used as API key
    if (api_key === 'story') {
      await new Promise(r => setTimeout(r, 3000)); // Simulate processing
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          analysis: "This is a mock analysis for development purposes because the 'story' API key was used. This mode allows testing the application flow without making real calls to the OpenAI API.\n\n1. Current Drought Conditions: Mock assessment of severe drought.\n2. Water Resources: Mock status of low water levels.\n3. Impact on Agriculture: Mock effects on crops.\n4. Economic Impact: Mock summary of economic consequences.",
          urls_analyzed: body.urls ? body.urls.length : 0,
          followed_links: body.follow_links,
          pdf_support: true,
          region: body.region || 'Global Overview',
          timestamp: new Date().toISOString()
        })
      };
    }

    // Validate API key
    if (!api_key) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'API key not set' })
      };
    };

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
                // Use cheerio for better text extraction
                const $ = cheerio.load(pageContent);
                $('script, style, nav, header, footer, aside, .ad, .advertisement, .sidebar').remove();
                const textContent = $.text().replace(/\s+/g, ' ').trim();
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

    let crawlWarning = '';
    if (combinedContent.includes('[Crawl stopped early due to Netlify timeout limit.')) {
      crawlWarning = 'WARNING: Crawl was incomplete due to Netlify function timeout. Only partial content was analyzed.';
    }

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

    let analysis = completion.choices[0].message.content;
    if (crawlWarning) {
      analysis = crawlWarning + '\n\n' + analysis;
    }

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
        timestamp: new Date().toISOString(),
        crawl_warning: crawlWarning || undefined
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
