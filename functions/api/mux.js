export async function onRequest(context) {
  const { request, env } = context;

  // 1. CORS HANDSHAKE
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization", 
      },
    });
  }

  // ---> GRAB KEYS FROM CLOUDFLARE ENVIRNOMENT <---
  const BUNNY_LIBRARY_ID = env.BUNNY_LIBRARY_ID;
  const BUNNY_API_KEY = env.BUNNY_API_KEY;
  const SUPABASE_URL = env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;

  if (request.method === 'POST') {
    // 2. Extract Token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: "Missing Authorization header entirely." }), { status: 401, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }
    const token = authHeader.split(' ')[1];

    // 3. Ask Supabase if token is legit
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 
        'Authorization': `Bearer ${token}`, 
        'apikey': SUPABASE_ANON_KEY 
      }
    });

    if (!userRes.ok) {
      const textError = await userRes.text();
      return new Response(JSON.stringify({ error: `Supabase Auth Rejected: Status ${userRes.status}. Details: ${textError}` }), { 
        status: 401, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
      });
    }
    
    const userData = await userRes.json();
    const userId = userData.id;

    // 4. Check Database Role
    const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=role`, {
      headers: { 
        'Authorization': `Bearer ${token}`, 
        'apikey': SUPABASE_ANON_KEY 
      }
    });

    if (!profileRes.ok) {
       const profError = await profileRes.text();
       return new Response(JSON.stringify({ error: `Supabase DB Rejected: Status ${profileRes.status}. Details: ${profError}` }), { 
         status: 403, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
       });
    }
    
    const profileData = await profileRes.json();
    const role = profileData[0]?.role;

    if (role !== 'super_admin' && role !== 'manager') {
       return new Response(JSON.stringify({ error: `Unauthorized: User is ${role || 'null'}. Need manager/admin.` }), { 
         status: 403, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
       });
    }

    // 5. Initialize Bunny Video Container
    try {
      const body = await request.json().catch(() => ({}));

      if (!BUNNY_LIBRARY_ID || !BUNNY_API_KEY) {
        throw new Error("Bunny API keys are missing in Cloudflare Environment Variables.");
      }

      // Tell Bunny to create a new blank video container
      const createRes = await fetch(`https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos`, {
        method: 'POST',
        headers: {
          'AccessKey': BUNNY_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ title: body.title || 'New App Upload' })
      });

      if (!createRes.ok) {
          const errTxt = await createRes.text();
          throw new Error(`Failed to create video in Bunny: ${errTxt}`);
      }
      
      const videoData = await createRes.json();
      const videoId = videoData.guid;

      // 6. Generate SHA256 Signature for secure frontend upload
      const expirationTime = Math.floor(Date.now() / 1000) + (60 * 60 * 24); // 24 hours
      const signatureString = `${BUNNY_LIBRARY_ID}${BUNNY_API_KEY}${expirationTime}${videoId}`;

      const encoder = new TextEncoder();
      const data = encoder.encode(signatureString);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // 7. Send the secure credentials back to the Admin Panel
      return new Response(
        JSON.stringify({
          data: {
            videoId,
            libraryId: BUNNY_LIBRARY_ID,
            signature,
            expirationTime
          }
        }),
        { headers: { "Access-Control-Allow-Origin": "*", 'Content-Type': 'application/json' } }
      );
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Access-Control-Allow-Origin": "*", 'Content-Type': 'application/json' } });
    }
  }

  return new Response("Method Not Allowed", { status: 405 });
}