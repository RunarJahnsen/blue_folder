import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SongMeta {
  title: string | null;
  artist: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url, song_id } = await req.json();
    console.log('Received:', { url, song_id });

    if (!url) {
      return new Response(JSON.stringify({ content: null, title: null, artist: null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Metadata-only mode — no song_id, no DB write
    if (!song_id) {
      const meta = await fetchMeta(url);
      console.log('Meta result:', meta);
      return new Response(JSON.stringify(meta), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Content mode — existing behaviour
    const content = await fetchContent(url);
    console.log('Content result:', content ? 'found' : 'null');

    if (content) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      await supabase.from('songs').update({ content }).eq('id', song_id);
    }

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ content: null, title: null, artist: null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ─── Metadata extraction ────────────────────────────────────────────────────

async function fetchMeta(url: string): Promise<SongMeta> {
  if (url.includes('nortabs.net') || url.includes('nortabs.no')) return await fetchNortabsMeta(url);
  return { title: null, artist: null };
}

async function fetchNortabsMeta(url: string): Promise<SongMeta> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) return { title: null, artist: null };
    const html = await res.text();

    const rawTitle = (() => {
      const ogMatch = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)
        ?? html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i);
      if (ogMatch) return decodeHtmlEntities(ogMatch[1]);
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) return decodeHtmlEntities(titleMatch[1]);
      return null;
    })();

    if (!rawTitle) return { title: null, artist: null };

    // Format: "Artist - Sangtittel - Nortabs" or "Sangtittel - Nortabs"
    const parts = rawTitle.split(' - ').map((p) => p.trim()).filter(Boolean);
    const cleaned = parts.filter((p) => !/^nortabs/i.test(p));
    return {
      artist: cleaned.length > 1 ? cleaned[0] : null,
      title: cleaned.length > 1 ? cleaned[1] : (cleaned[0] ?? null),
    };
  } catch {
    return { title: null, artist: null };
  }
}

// ─── Content extraction (existing) ──────────────────────────────────────────

async function fetchContent(url: string): Promise<string | null> {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    if (hostname === 'nortabs.net' || hostname === 'nortabs.no') return await fetchNortabs(url);
    if (hostname === 'ultimate-guitar.com' || hostname.endsWith('.ultimate-guitar.com')) {
      return await fetchUltimateGuitar(url);
    }
    if (hostname === 'genius.com') return await fetchGenius(url);
    return null;
  } catch {
    return null;
  }
}

async function fetchNortabs(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    console.log('Nortabs status:', res.status);
    if (!res.ok) return null;
    const html = await res.text();
    console.log('Nortabs HTML snippet:', html.substring(0, 500));

    const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
    if (preMatch) return decodeHtmlEntities(preMatch[1].trim());

    const divMatch = html.match(/<div[^>]*class="[^"]*(?:tab|chord|lyrics|content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (divMatch) return stripHtml(divMatch[1]).trim() || null;

    return null;
  } catch {
    return null;
  }
}

async function fetchUltimateGuitar(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
    console.log('UG status:', res.status);
    if (!res.ok) return null;
    const html = await res.text();

    const storeMatch = html.match(/class="js-store"[^>]*data-content="([^"]+)"/);
    if (storeMatch) {
      try {
        const decoded = storeMatch[1]
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&#039;/g, "'");
        const data = JSON.parse(decoded);
        const content = data?.store?.page?.data?.tab_view?.wiki_tab?.content;
        if (content) return cleanUgContent(content);
      } catch {
        // fall through to next strategy
      }
    }

    const ugappMatch = html.match(/window\.UGAPP\.store\.page\s*=\s*(\{[\s\S]*?\});\s*\n/);
    if (ugappMatch) {
      try {
        const data = JSON.parse(ugappMatch[1]);
        const content = data?.data?.tab_view?.wiki_tab?.content;
        if (content) return cleanUgContent(content);
      } catch {
        // fall through
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function fetchGenius(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    console.log('Genius status:', res.status);
    if (!res.ok) return null;
    const html = await res.text();
    console.log('Genius HTML snippet:', html.substring(0, 1000));

    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      try {
        const data = JSON.parse(nextDataMatch[1]);
        const children = data?.props?.pageProps?.songPage?.lyricsData?.body?.children;
        if (children) {
          return extractGeniusChildren(children);
        }
      } catch {
        // fall through
      }
    }

    const lyricsMatches = [...html.matchAll(/data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/g)];
    if (lyricsMatches.length > 0) {
      const combined = lyricsMatches.map((m) => stripHtml(m[1])).join('\n\n');
      if (combined.trim()) return combined.trim();
    }

    return null;
  } catch {
    return null;
  }
}

function extractGeniusChildren(children: unknown[]): string {
  return children
    .map((child) => {
      if (typeof child === 'string') return child;
      if (typeof child === 'object' && child !== null) {
        const c = child as { children?: unknown[]; tag?: string };
        if (c.tag === 'br') return '\n';
        if (c.children) return extractGeniusChildren(c.children);
      }
      return '';
    })
    .join('');
}

function cleanUgContent(content: string): string {
  return content
    .replace(/\[ch\](.*?)\[\/ch\]/g, '$1')
    .replace(/\[tab\]([\s\S]*?)\[\/tab\]/g, '$1')
    .replace(/\[verse.*?\]/g, '')
    .replace(/\[chorus.*?\]/g, '')
    .replace(/\[bridge.*?\]/g, '')
    .replace(/\[outro.*?\]/g, '')
    .replace(/\[intro.*?\]/g, '')
    .trim();
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n');
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ');
}
