// A simple in-memory cache to track IP addresses (Reset every time the worker sleeps)
const rateLimitMap = new Map();

export async function onRequest(context) {
  const { request } = context;
  const clientIP = request.headers.get("CF-Connecting-IP") || "anonymous";

  // 1. RATE LIMIT CHECK
  const now = Date.now();
  const lastRequestTime = rateLimitMap.get(clientIP) || 0;
  const COOLDOWN_MS = 60000; // 1 minute cooldown between uploads

  if (now - lastRequestTime < COOLDOWN_MS) {
    const waitSeconds = Math.ceil((COOLDOWN_MS - (now - lastRequestTime)) / 1000);
    return new Response(JSON.stringify({ 
      error: { message: `Spam Protection: Please wait ${waitSeconds}s before another upload.` } 
    }), { 
      status: 429, 
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
    });
  }

  // 2. CORS HANDSHAKE
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  // ---> YOUR SECURE KEYS <---
  const MUX_TOKEN_ID = 'e9e97029-07a5-48c3-8afc-20b3b07ca94a';
  const MUX_TOKEN_SECRET = 'fBcT0uzhTYHJZBHwtOJW0l6NJ3Jc1YL6x6rfTy1+cJG/7D+vZlj9duYR2Y2lEoCBMY6EIGTxH8F';
  
  const credentials = btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`);

  if (request.method === 'POST') {
    // Record this request time to block the next one for 60s
    rateLimitMap.set(clientIP, now);

    const body = await request.json().catch(() => ({}));
    
    const payload = { 
      new_asset_settings: { 
        playback_policy: ['public'], 
        video_quality: 'basic', 
        passthrough: body.passthrough || 'unknown'
      }, 
      cors_origin: '*' 
    };
    
    if (body.subtitleUrl) {
       payload.new_asset_settings.text_tracks = [{ url: body.subtitleUrl, type: 'subtitles', language_code: 'en', name: 'English', closed_captions: true }];
    }

    const response = await fetch('https://api.mux.com/video/v1/uploads', {
      method: 'POST',
      headers: { 
        'Authorization': `Basic ${credentials}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    return new Response(JSON.stringify(data), { 
        status: response.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
    });
  }

  return new Response("Method Not Allowed", { status: 405 });
}