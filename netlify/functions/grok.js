// netlify/functions/grok.js
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (err) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid JSON' })
    };
  }

  const { prompt } = body;

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'API key not configured on server' })
    };
  }

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'grok-beta',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `AI API error: ${errText}` })
      };
    }

    const data = await response.json();
    return {
      statusCode: 200,
      body: JSON.stringify({ reply: data.choices[0].message.content })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server error', details: err.message })
    };
  }
};