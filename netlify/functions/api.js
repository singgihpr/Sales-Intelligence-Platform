import { handler as coreHandler } from './lib/core.js';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

export const handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  const normalizedEvent = {
    method: event.httpMethod,
    query: event.queryStringParameters || {},
    headers: event.headers,
    body: event.body,
    isBase64Encoded: event.isBase64Encoded
  };

  const result = await coreHandler(normalizedEvent);

  return {
    ...result,
    headers: {
      ...(result.headers || {}),
      ...corsHeaders
    }
  };
};
