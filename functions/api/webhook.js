import { createClient } from '@supabase/supabase-js';

export async function onRequestPost(context) {
  const { request } = context;

  // ---> YOUR SECURE KEYS GO HERE <---
  // We need the SERVICE_ROLE key here so the backend can bypass security and update the database automatically.
  const SUPABASE_URL = 'https://acmslndavkvavlacdzst.supabase.co';
  const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjbXNsbmRhdmt2YXZsYWNkenN0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjMxNjQ0OSwiZXhwIjoyMDg3ODkyNDQ5fQ.fAfIfDHyQFqo4scsIbtUWBwUhGVLglUU34a_6pZsWwE'; 
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = await request.json();

    // We ONLY care when Mux says a video is 100% processed and ready to stream
    if (body.type === 'video.asset.ready') {
      const asset = body.data;
      const playbackId = asset.playback_ids[0].id;
      const videoUrl = `https://stream.mux.com/${playbackId}.m3u8`;

      // Grab our secret nametag (e.g., "movies:123" or "episodes:456")
      const passthrough = asset.passthrough;
      
      if (passthrough) {
        const [table, id] = passthrough.split(':');

        // Update the database secretly in the background!
        await supabase
          .from(table)
          .update({ 
            video_url: videoUrl, 
            status: 'active' 
          })
          .eq('id', id);
          
        console.log(`Successfully updated ${table} ${id} via Webhook!`);
      }
    }

    // Always reply 200 OK so Mux knows we received the message
    return new Response("Webhook received successfully", { status: 200 });
    
  } catch (error) {
    return new Response(`Webhook Error: ${error.message}`, { status: 400 });
  }
}