export async function onRequest(context) {
  const { request } = context;

  // 1. CORS HANDSHAKE
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        // We removed the x-admin-secret and now only allow the standard Authorization header
        "Access-Control-Allow-Headers": "Content-Type, Authorization", 
      },
    });
  }

  // ---> YOUR MUX KEYS <---
  const MUX_TOKEN_ID = 'e9e97029-07a5-48c3-8afc-20b3b07ca94a'; 
  const MUX_TOKEN_SECRET = 'fBcT0uzhTYHJZBHwtOJW0l6NJ3Jc1YL6x6rfTy1+cJG/7D+vZlj9duYR2Y2lEoCBMY6EIGTxH8F';
  const credentials = btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`);

  // ---> YOUR SUPABASE KEYS <---
  // Grab these exact strings from your lib/supabase.ts file
  const SUPABASE_URL = 'https://acmslndavkavlacdzst.supabase.co'; // Your project URL
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjbXNsbmRhdmt2YXZsYWNkenN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMTY0NDksImV4cCI6MjA4Nzg5MjQ0OX0.v4jIVZZZ4Ampufl75GeUVcfg-oxyoPvDE66u6RVy6VQ';

  if (request.method === 'POST') {
    // 2. THE NEW BOUNCER: Extract the secure JWT token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: "Missing or invalid Authorization header." }), { 
        status: 401, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
      });
    }
    
    const token = authHeader.split(' ')[1];

    // 3. VERIFY TOKEN: Ask Supabase if this user is legit
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_ANON_KEY }
    });

    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: "Invalid or expired session token." }), { 
        status: 401, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
      });
    }
    const userData = await userRes.json();
    const userId = userData.id;

    // 4. ROLE CHECK: Ask the database if this user is a Manager or Super Admin
    const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=role`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_ANON_KEY }
    });

    if (!profileRes.ok) {
       return new Response(JSON.stringify({ error: "Failed to verify user role." }), { 
         status: 403, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
       });
    }
    
    const profileData = await profileRes.json();
    const role = profileData[0]?.role;

    if (role !== 'super_admin' && role !== 'manager') {
       return new Response(JSON.stringify({ error: "Unauthorized: Only Admins and Managers can upload videos." }), { 
         status: 403, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
       });
    }

    // 5. PROCESS THE SECURE MUX UPLOAD
    const body = await request.json().catch(() => ({}));
    
    const payload = { 
      new_asset_settings: { 
        playback_policies: ['public'],
        video_quality: 'basic', 
        passthrough: body.passthrough || 'unknown',
        static_renditions: [{ resolution: 'highest' }]
      }, 
      cors_origin: '*' 
    };
    
    if (body.subtitleUrl) {
       payload.new_asset_settings.text_tracks = [
         { url: body.subtitleUrl, type: 'subtitles', language_code: 'en', name: 'English', closed_captions: true }
       ];
    }

    const response = await fetch('https://api.mux.com/video/v1/uploads', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/json' },
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