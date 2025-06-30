const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const DEFAULT_PROMPT = `You're a drought analyst. Analyze the provided URLs and create a comprehensive drought-focused summary for the selected region. Generate the headlines before summarizing the content. Include up to two paragraphs for the following topics and headlines, prioritizing information covering april to June 2025:\n\n1. Current Drought Conditions: Assess the severity and extent of drought in the region\n2. Water Resources: Status of surface water, groundwater, and reservoir levels\n3. Impact on food security and Agriculture: Effects on crops and livestock\n4. Food prices and economic impact\n\nStrictly use all headlines based on these four categories and separate the sections with breaks. \nEnsure that the text describes current conditions without phrases such as "the report highlights". Simply summarize conditions from the URLs or PDFs provided. Use no external information.`;

// In-memory storage for custom prompt
let customPrompt = null;

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ system_prompt: customPrompt || DEFAULT_PROMPT })
    };
  }

  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body);
      customPrompt = body.system_prompt || DEFAULT_PROMPT;
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'success', system_prompt: customPrompt })
      };
    } catch (e) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ status: 'error', message: 'Invalid request body' })
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
};
