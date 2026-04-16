import { createClient } from '@supabase/supabase-js';

export async function onRequestPost(context) {
  // Extract both the request and the secure environment variables from Cloudflare's context
  const { request, env } = context;

  // The URL is public, so it is safe to hardcode. 
  const SUPABASE_URL = 'https://acmslndavkvavlacdzst.supabase.co';
  
  // ---> THE SECURE FIX <---
  // The service key is now pulled securely from Cloudflare's hidden vault!
  const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY;
  
  // Failsafe: Prevent the client from crashing if the key is missing in Cloudflare settings
  if (!SUPABASE_SERVICE_KEY) {
    console.error("Missing SUPABASE_SERVICE_KEY in Cloudflare Environment Variables");
    return new Response("Server configuration error", { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = await request.json();

    // Bunny Stream Webhook: Status 3 means "Finished Encoding"
    if (body.Status === 3 && body.VideoGuid) {
      const videoId = body.VideoGuid;

      // Because the admin panel already saved the URL (e.g., https://vz-...net/{videoId}/playlist.m3u8)
      // we just search the database for the row containing this specific Video ID!

      // 1. Check Movies Table First
      const { data: movie, error: mErr } = await supabase
        .from('movies')
        .select('id')
        .like('video_url', `%${videoId}%`)
        .maybeSingle();

      if (movie) {
        await supabase
          .from('movies')
          .update({ status: 'active' })
          .eq('id', movie.id);
          
        console.log(`Successfully activated Movie ${movie.id} via Webhook!`);
        return new Response("Webhook processed (Movie activated)", { status: 200 });
      }

      // 2. Check Episodes Table if not found in Movies
      const { data: episode, error: eErr } = await supabase
        .from('episodes')
        .select('id')
        .like('video_url', `%${videoId}%`)
        .maybeSingle();

      if (episode) {
        await supabase
          .from('episodes')
          .update({ status: 'active' })
          .eq('id', episode.id);
          
        console.log(`Successfully activated Episode ${episode.id} via Webhook!`);
        return new Response("Webhook processed (Episode activated)", { status: 200 });
      }
    }

    // Always reply 200 OK so Bunny knows we received the message
    return new Response("Webhook received successfully (No action required)", { status: 200 });
    
  } catch (error) {
    return new Response(`Webhook Error: ${error.message}`, { status: 400 });
  }
}