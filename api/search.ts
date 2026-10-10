export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
};

interface SearchResult {
  title: string;
  snippet: string;
  link: string;
}

import { checkAuthAndRateLimit } from './_security';

export default async function handler(req: Request): Promise<Response> {
  const securityResponse = checkAuthAndRateLimit(req);
  if (securityResponse) return securityResponse;

  const url = new URL(req.url);
  const q = url.searchParams.get('q') || '';

  if (!q.trim()) {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const query = q.trim();
  const results: SearchResult[] = [];

  try {
    const promises = [
      // 1. DuckDuckGo Instant Answer API (rápido para definições e tópicos diretos)
      fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Synap/1.0' },
        signal: AbortSignal.timeout(3500),
      })
        .then((res) => {
          if (!res.ok) throw new Error('DDG failed');
          return res.json();
        })
        .then((data) => {
          const localResults: SearchResult[] = [];
          if (data.AbstractText) {
            localResults.push({
              title: data.Heading || query,
              snippet: data.AbstractText,
              link: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
            });
          }
          if (Array.isArray(data.RelatedTopics)) {
            for (const topic of data.RelatedTopics.slice(0, 4)) {
              if (topic.Text && topic.FirstURL) {
                localResults.push({
                  title: topic.Text.split(' - ')[0] || query,
                  snippet: topic.Text,
                  link: topic.FirstURL,
                });
              }
            }
          }
          return localResults;
        }),

      // 2. Wikipedia Query Search API (substitui o OpenSearch que retorna descrições vazias)
      fetch(
        `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
          query
        )}&utf8=&format=json&srlimit=4`,
        {
          headers: { 'User-Agent': 'SynapApp/1.0' },
          signal: AbortSignal.timeout(3500),
        }
      )
        .then((res) => {
          if (!res.ok) throw new Error('Wiki failed');
          return res.json();
        })
        .then((data) => {
          const localResults: SearchResult[] = [];
          const searchItems = data?.query?.search || [];
          for (const item of searchItems) {
            if (item.title && item.snippet) {
              localResults.push({
                title: item.title,
                snippet: item.snippet.replace(/<[^>]*>?/gm, ''), // Remove tags HTML como <span class="searchmatch">
                link: `https://pt.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
              });
            }
          }
          return localResults;
        }),
    ];

    const settled = await Promise.allSettled(promises);

    for (const outcome of settled) {
      if (outcome.status === 'fulfilled' && outcome.value) {
        for (const item of outcome.value) {
          if (!results.some((r) => r.link === item.link)) {
            results.push(item);
          }
        }
      }
    }

    return new Response(JSON.stringify(results.slice(0, 7)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Search error:', err);
    return new Response(
      JSON.stringify({ error: `Falha na busca web: ${err.message}` }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
