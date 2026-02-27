import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.RIOT_API_KEY;
  const region = process.env.RIOT_API_REGION;
  
  return NextResponse.json({
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey ? apiKey.length : 0,
    apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'N/A',
    region: region || 'not set (default: jp1)',
    allEnvKeys: Object.keys(process.env).filter(key => key.includes('RIOT')),
  });
}

