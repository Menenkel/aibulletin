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
    
    // In a real app, you'd store this securely
    // For now, we'll just return success
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    };
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
