# Walkthrough: Revisão e Hardening (Arquitetura e Infraestrutura)

Durante esta sessão massiva de engenharia, efetuamos uma varredura completa na aplicação para elevar seu status de um protótipo local para uma aplicação *production-ready* na Vercel e outros orquestradores.

## 1. Infraestrutura e Vercel Edge
- **Problema:** A Vercel interpretava as rotas `/api/*.ts` como Node.js Serverless Functions tradicionais devido à falta de metadados robustos. Isso provocava erros 500 (`new URL(req.url)` falhava pois recebia um caminho relativo do Node) e estrangulava conexões longas (como SSE) com limites de tempo restritos (10s a 30s).
- **Solução:** Injetamos `"runtime": "edge"` nas configurações de rotas globais no arquivo `vercel.json`. Isso blinda a aplicação, obrigando a Vercel a usar os padrões nativos da Web (`req: Request`), erradicando os falsos 500s e liberando _streams_ virtualmente infinitas de respostas.

## 2. Bloqueios de Build e Server
- **Problema:** O pacote `tsx` estava apenas em `devDependencies`. Quando a plataforma (ex: Render/Docker) tentava compilar com `--omit=dev` para produção, a inicialização falhava por falta de dependências. Além disso, o Express subia sem `NODE_ENV=production`.
- **Solução:** O pacote `tsx` foi promovido às dependências principais. Implementamos o pacote multiplataforma `cross-env` e refatoramos o script de `start` para: `"start": "cross-env NODE_ENV=production tsx server.ts"`.

## 3. Cold Starts e Payload Bloating
- **Problema:** O framework Vercel Edge limitava _cold starts_ devido à presença do gigantesco pacote `octokit`.
- **Solução:** O pacote `octokit` completo foi desinstalado e trocado pelo enxuto `@octokit/rest`. Isso diminui radicalmente o peso do *bundle*, acelerando o *boot* das funções na Vercel.
- **Problema Secundário:** O corpo das requisições via POST esbarrava no limite de 4.5MB da Vercel para imagens.
- **Solução:** No lado do cliente (`src/lib/utils.ts`), implementamos uma barreira rígida que converte imagens para no máximo 1024px e derruba a qualidade recursivamente do B64 até que nenhuma imagem cruze a fronteira de ~600KB, permitindo que os usuários anexem múltiplas fotografias sem capotar as requisições.

## 4. API do GitHub à Prova de Falhas
- Implementamos paginação estrita (`octokit.paginate`) nas chamadas de `repos` e `branches`.
- Arquivos binários não são mais corrompidos: detectamos bytes nulos diretamente no Buffer em vez de stringificá-los preventivamente como UTF-8.
- Mitigamos o **Lost Update (Condição de Corrida)**: toda leitura do arquivo agora despacha um `baseSha`. Nas edições subsequentes, o commit levanta o último SHA no GitHub para validação. Se o cliente enviar algo defasado (`baseSha` diferente da branch oficial remota), a API aborta e dispara HTTP 409, protegendo edições colaborativas.
- Salvamos as propriedades vitais dos arquivos (`+x` executable bits) injetando o `mode` real lido recursivamente da árvore preexistente.

## 5. Caching do Service Worker
- O arquivo de cache agressivo (`sw.js`) agora porta cabeçalhos absolutos de `Cache-Control: no-cache` declarados em `vercel.json`, impossibilitando que os clientes da Vercel fiquem retidos em versões defasadas do front-end nas próximas atualizações.

## 6. Limpeza e Configurações Adicionais
- **Limpeza de Dependências:** As dependências ociosas (`@google/genai` e `vite-plugin-pwa`) foram removidas do repositório, e o arquivo `bun.lock` foi deletado para garantir que o projeto use apenas uma *lockfile* (neste caso, o `package-lock.json`).
- **Segurança e Limits na Vercel:** Adicionada diretiva `maxDuration: 60` em `vercel.json` para a rota `api/image.ts` não capotar com *timeouts* prematuros. Foram incluídos cabeçalhos de segurança vitais (`Content-Security-Policy` e `X-Content-Type-Options: nosniff`) em todas as rotas servidas pela plataforma.

## 7. Otimizações de Build e Lazy Loading (Vite)
- **cssFallbackPlugin:** O plugin foi completamente removido, permitindo que o Vite resolva o caminho real (`src/index.css`) sem interceptações indevidas, garantindo que o CSS final seja empacotado corretamente.
- **Melhoria no Chunking:** O bloco `manualChunks` para `vendor-markdown` foi expandido para agrupar todo o ecossistema (incluindo dependências subjacentes como `mdast-*`, `hast-*`, `remark-`, `vfile`, e `unist-*`), eliminando riscos de dependências circulares.
- **Lazy Loading Genuíno:** O pacote pesado `react-diff-viewer-continued` foi removido do `manualChunks` estático. Agora, ele é importado dinamicamente no momento exato em que a tela de Source Control é aberta via `React.lazy()` e `<Suspense>`, reduzindo significativamente o peso inicial do *bundle*.

**Status atual da Aplicação:** Estável, ultra perfomática em Edge, segurada contra manipulações externas indevidas, e sem gargalos conhecidos. O *Deploy* está verde.
