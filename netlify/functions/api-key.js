exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod === 'POST') {
    const body = JSON.parse(event.body);
    const { api_key } = body;
    
    // Special handling for 'story' dev API key
    if (api_key === 'story') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'success', message: 'API key set successfully (development mode)' })
      };
    }

    // Validate real OpenAI API key
    const { OpenAI } = require('openai');
    try {
      const client = new OpenAI({ apiKey: api_key });
      // Make a test call
      await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5
      });
      // Optionally, you can persist the key in a secure store or env
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'success', message: 'API key set successfully' })
      };
    } catch (e) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ status: 'error', message: 'Invalid API key: ' + e.message })
      };
    }
  }

  if (event.httpMethod === 'GET') {
    // Check if API key is configured
    const hasApiKey = !!process.env.OPENAI_API_KEY;
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ has_api_key: hasApiKey }),
    };
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
};
