export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  try {
    const body = await request.json();
    const { videoId, subtitleUrl } = body;

    if (!videoId || !subtitleUrl) {
      throw new Error("Missing videoId or subtitleUrl");
    }

    // 1. Fetch the raw .vtt file from your Supabase storage
    const subResponse = await fetch(subtitleUrl);
    if (!subResponse.ok) throw new Error("Failed to fetch subtitle file from Supabase storage.");
    
    // Grab it as raw text instead of a binary buffer to preserve special characters
    const textContent = await subResponse.text();

    // 2. Safely encode UTF-8 text to Base64 (Prevents corrupted .vtt files!)
    const base64Captions = btoa(unescape(encodeURIComponent(textContent)));

    // 3. Push to Bunny Stream Captions API
    const bunnyRes = await fetch(`https://video.bunnycdn.com/library/${env.BUNNY_LIBRARY_ID}/videos/${videoId}/captions/en`, {
      method: 'POST',
      headers: {
        'AccessKey': env.BUNNY_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        captionsFile: base64Captions,
        srclang: "en",
        label: "English"
      })
    });

    if (!bunnyRes.ok) {
       const errText = await bunnyRes.text();
       throw new Error(`Bunny API Error: ${errText}`);
    }

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
}

// Handle CORS Preflight Requests
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    }
  });
}