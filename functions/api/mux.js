export async function onRequest(context) {
  const { request } = context;

  // 1. CORS HANDSHAKE
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-admin-secret",
      },
    });
  }

  // ---> YOUR SECURE KEYS <---
  const MUX_TOKEN_ID = 'e9e97029-07a5-48c3-8afc-20b3b07ca94a';
  const MUX_TOKEN_SECRET = 'fBcT0uzhTYHJZBHwtOJW0l6NJ3Jc1YL6x6rfTy1+cJG/7D+vZlj9duYR2Y2lEoCBMY6EIGTxH8F';
  
  // This is your new VIP Passcode!
  const APP_SECRET_PASSCODE = 'v1-super-admin-2026'; 

  const credentials = btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`);

  if (request.method === 'POST') {
    // 2. THE BOUNCER: Check for the VIP Passcode
    const clientPasscode = request.headers.get("x-admin-secret");
    
    if (clientPasscode !== APP_SECRET_PASSCODE) {
      return new Response(JSON.stringify({ 
        error: { message: `Unauthorized: Bot attack blocked.` } 
      }), { 
        status: 403, 
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
      });
    }

    // 3. If passcode matches, process the upload INSTANTLY
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