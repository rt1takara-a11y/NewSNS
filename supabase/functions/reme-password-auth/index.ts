import { createHandler } from './handler.ts';

// These credentials are provided by the Supabase Edge runtime, never by the browser.
Deno.serve(createHandler({
  url: Deno.env.get('SUPABASE_URL') ?? '',
  serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  publicKey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  allowedOrigins: (Deno.env.get('REME_AUTH_ORIGINS') ??
    'https://newsns-ui-ryusei.rt1-takara.chatgpt.site').split(',').map(s => s.trim()),
}));
