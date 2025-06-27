exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
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
    const regions = [
      "East Asia and Pacific",
      "Europe and Central Asia",
      "Latin America/Caribbean",
      "South Asia",
      "Sub-Saharan Africa"
    ];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(regions)
    };
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
}; 