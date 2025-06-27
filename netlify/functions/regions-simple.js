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
      "Global Overview",
      "Sub-Saharan Africa",
      "North Africa",
      "Middle East",
      "South Asia",
      "Southeast Asia",
      "Latin America",
      "Caribbean",
      "Europe",
      "North America"
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