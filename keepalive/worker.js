// Gymbanan keep-alive: haller Supabase-databasen vaken sa free-tier inte
// pausar den efter 7 dagars inaktivitet. Kor en latt las-forfragan via
// cron (se wrangler.toml). Anon-nyckeln ar den PUBLIKA nyckeln (samma som
// i appens klientkod) - byggd for att exponeras, skyddas av RLS.

const SUPABASE_URL = 'https://txwszpetcouyfoyhimmr.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4d3N6cGV0Y291eWZveWhpbW1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3ODY5OTcsImV4cCI6MjA5MDM2Mjk5N30.T9RrIgnXJUwkvWWtYqlKku2ulbU5PfyPu3TEm9xQbcM'

async function ping() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id&limit=1`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  })
  return res.ok
}

export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(ping()) },
  async fetch() {
    const ok = await ping()
    return new Response(
      ok ? 'Gymbanan keep-alive: databasen svarar OK' : 'Keep-alive: databasen svarade INTE',
      { status: ok ? 200 : 502 }
    )
  },
}
