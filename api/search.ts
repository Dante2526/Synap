export const config = {
  runtime: 'nodejs',
};

interface SearchResult {
  title: string;
  snippet: string;
  link: string;
}

const PUBLIC_SEARXNG_INSTANCES = [
  'https://searx.be',
  'https://search.ononoki.org',
  'https://searx.tiekoetter.com',
];

export default async function handler(req: Request): Promise<Response> {
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
    // 1. Tentar DuckDuckGo Instant Answer API (rápido para definições e tópicos diretos)
    try {
      const ddgRes = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
        {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Synap/1.0' },
          signal: AbortSignal.timeout(3500),
        }
      );

      if (ddgRes.ok) {
        const data = await ddgRes.json();
        if (data.AbstractText) {
          results.push({
            title: data.Heading || query,
            snippet: data.AbstractText,
            link: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
          });
        }

        if (Array.isArray(data.RelatedTopics)) {
          for (const topic of data.RelatedTopics.slice(0, 4)) {
            if (topic.Text && topic.FirstURL) {
              results.push({
                title: topic.Text.split(' - ')[0] || query,
                snippet: topic.Text,
                link: topic.FirstURL,
              });
            }
          }
        }
      }
    } catch {}

    // 2. Tentar Wikipedia OpenSearch API para fontes enciclopédicas e definições
    try {
      const wikiRes = await fetch(
        `https://pt.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(
          query
        )}&limit=3&namespace=0&format=json`,
        {
          headers: { 'User-Agent': 'SynapApp/1.0' },
          signal: AbortSignal.timeout(3000),
        }
      );
      if (wikiRes.ok) {
        const wikiData = await wikiRes.json();
        const titles: string[] = wikiData[1] || [];
        const snippets: string[] = wikiData[2] || [];
        const links: string[] = wikiData[3] || [];
        for (let i = 0; i < titles.length; i++) {
          if (titles[i] && snippets[i] && !results.some((r) => r.link === links[i])) {
            results.push({
              title: titles[i],
              snippet: snippets[i],
              link: links[i],
            });
          }
        }
      }
    } catch {}

    // 3. SearXNG Público como terceira fonte para resultados gerais da web (Google/Bing/DuckDuckGo agregados)
    if (results.length < 5) {
      for (const instance of PUBLIC_SEARXNG_INSTANCES) {
        try {
          const searxUrl = `${instance}/search?q=${encodeURIComponent(query)}&format=json&language=auto`;
          const searxRes = await fetch(searxUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              Accept: 'application/json',
            },
            signal: AbortSignal.timeout(4500),
          });

          if (searxRes.ok) {
            const searxData = await searxRes.json();
            const items = searxData.results || [];
            for (const item of items) {
              if (item.title && item.url && !results.some((r) => r.link === item.url)) {
                results.push({
                  title: item.title,
                  snippet: item.content || item.title,
                  link: item.url,
                });
              }
              if (results.length >= 7) break;
            }
          }
          if (results.length >= 4) break;
        } catch {
          // Tenta próxima instância se a atual falhar/estiver indisponível
          continue;
        }
      }
    }

    // Fallback se absolutamente nenhuma fonte retornou links
    if (results.length === 0) {
      results.push({
        title: `Pesquisa por: ${query}`,
        snippet: `Fontes consultadas na web para o termo "${query}".`,
        link: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
      });
    }

    return new Response(JSON.stringify(results.slice(0, 7)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Search error:', err);
    return new Response(
      JSON.stringify([
        {
          title: `Resultados para ${query}`,
          snippet: `Consulta web executada para "${query}".`,
          link: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        },
      ]),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
