exports.handler = async (event, context) => {
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

  if (event.httpMethod === 'GET') {
    // Check API key status
    const hasApiKey = !!process.env.OPENAI_API_KEY;
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ has_api_key: hasApiKey })
    };
  }

  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      const { api_key } = body;

      if (!api_key) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'API key is required' })
        };
      }

      // In Netlify Functions, we can't save to files, so we'll just validate the key
      const { OpenAI } = require('openai');
      const openai = new OpenAI({ apiKey: api_key });

      // Test the API key
      await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          message: 'API key validated successfully. Note: In Netlify deployment, set OPENAI_API_KEY environment variable for persistence.' 
        })
      };

    } catch (error) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Invalid API key: ${error.message}` })
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
}; 