// Simple in-memory storage (will reset on function cold start)
let storedData = {
  urls: [],
  custom_prompt: '',
  region: 'Global Overview'
};

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
    console.log('GET request - returning stored data:', storedData);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(storedData),
    };
  }

  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body);
      console.log('POST request - storing data:', body);
      
      // Update stored data
      if (body.urls) storedData.urls = body.urls;
      if (body.custom_prompt !== undefined) storedData.custom_prompt = body.custom_prompt;
      if (body.region) storedData.region = body.region;
      
      console.log('Updated stored data:', storedData);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          stored: storedData 
        }),
      };
    } catch (error) {
      console.error('Error storing data:', error);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Invalid JSON data',
          details: error.message 
        }),
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
};
