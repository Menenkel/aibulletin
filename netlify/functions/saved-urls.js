exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod === 'GET') {
    // Return empty data for now - you can implement persistent storage later
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        urls: [],
        custom_prompt: '',
        region: 'Global Overview'
      }),
    };
  }

  if (event.httpMethod === 'POST') {
    // Save data - you can implement persistent storage later
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    };
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
};
