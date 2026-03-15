export async function onRequest(context) {
  const { request } = context;
  
  // ---> YOUR SECURE KEYS GO HERE <---
  // Because this file runs on Cloudflare's backend servers, hackers can NEVER see these keys.
  const MUX_TOKEN_ID = 'e9e97029-07a5-48c3-8afc-20b3b07ca94a';
  const MUX_TOKEN_SECRET = 'fBcT0uzhTYHJZBHwtOJW0l6NJ3Jc1YL6x6rfTy1+cJG/7D+vZlj9duYR2Y2lEoCBMY6EIGTxH8F';
  
  const credentials = btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`);

  // IF THE WEBSITE IS ASKING TO START AN UPLOAD:
  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    
    // THE FIX: Changed mp4_support to 'standard'
    const payload = { 
      new_asset_settings: { playback_policy: ['public'], video_quality: 'basic', mp4_support: 'standard' }, 
      cors_origin: '*' 
    };
    
    if (body.subtitleUrl) {
       payload.new_asset_settings.text_tracks = [{ url: body.subtitleUrl, type: 'subtitles', language_code: 'en', name: 'English', closed_captions: true }];
    }

    const response = await fetch('https://api.mux.com/video/v1/uploads', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
  }

  // IF THE WEBSITE IS CHECKING IF THE VIDEO IS FINISHED PROCESSING:
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const uploadId = url.searchParams.get('uploadId');

    const checkRes = await fetch(`https://api.mux.com/video/v1/uploads/${uploadId}`, {
      headers: { 'Authorization': `Basic ${credentials}` }
    });
    const checkData = await checkRes.json();

    let playbackId = null;
    if (checkData.data?.asset_id) {
       const assetRes = await fetch(`https://api.mux.com/video/v1/assets/${checkData.data.asset_id}`, {
         headers: { 'Authorization': `Basic ${credentials}` }
       });
       const assetData = await assetRes.json();
       if (assetData.data?.playback_ids?.length > 0) {
         playbackId = assetData.data.playback_ids[0].id;
       }
    }

    return new Response(JSON.stringify({ playbackId }), { headers: { 'Content-Type': 'application/json' } });
  }

  return new Response("Method Not Allowed", { status: 405 });
}