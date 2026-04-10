import { createClient } from '@supabase/supabase-js';

export async function onRequestPost(context) {
  const { request } = context;

  // ---> YOUR SECURE KEYS GO HERE <---
  // We need the SERVICE_ROLE key here so the backend can bypass security and update the database automatically.
  const SUPABASE_URL = 'https://acmslndavkvavlacdzst.supabase.co';
  const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjbXNsbmRhdmt2YXZsYWNkenN0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjMxNjQ0OSwiZXhwIjoyMDg3ODkyNDQ5fQ.fAfIfDHyQFqo4scsIbtUWBwUhGVLglUU34a_6pZsWwE'; // PASTE YOUR FULL SERVICE KEY HERE
  
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