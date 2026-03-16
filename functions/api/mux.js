export async function onRequest(context) {
  const { request } = context;

  // 1. SECURITY HANDSHAKE (CORS) - Tells browsers this connection is safe
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  // ---> YOUR SECURE KEYS GO HERE <---
  // Do not leave any spaces inside the quotes!
  const MUX_TOKEN_ID = 'e9e97029-07a5-48c3-8afc-20b3b07ca94a';
  const MUX_TOKEN_SECRET = 'fBcT0uzhTYHJZBHwtOJW0l6NJ3Jc1YL6x6rfTy1+cJG/7D+vZlj9duYR2Y2lEoCBMY6EIGTxH8F';
  
  const credentials = btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`);

  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    
    const payload = { 
      new_asset_settings: { 
        playback_policy: ['public'], 
        video_quality: 'basic', 
        // Note: mp4_support was deleted here to fix the deprecation error!
        passthrough: body.passthrough || 'unknown'
      }, 
      cors_origin: '*' 
    };
    
    if (body.subtitleUrl) {
       payload.new_asset_settings.text_tracks = [{ url: body.subtitleUrl, type: 'subtitles', language_code: 'en', name: 'English', closed_captions: true }];
    }

    // 2. ASK MUX FOR THE UPLOAD URL
    const response = await fetch('https://api.mux.com/video/v1/uploads', {
      method: 'POST',
      headers: { 
        'Authorization': `Basic ${credentials}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    // 3. SEND THE URL (OR EXACT ERROR) BACK TO YOUR APP
    return new Response(JSON.stringify(data), { 
        status: response.status,
        headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        } 
    });
  }

  return new Response("Method Not Allowed", { status: 405 });
}