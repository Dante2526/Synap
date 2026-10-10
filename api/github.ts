import { Octokit } from '@octokit/rest';

export const config = {
  runtime: 'nodejs',
  maxDuration: 60,
};

function getEffectiveToken(req: Request): string | null {
  // 1. Prioridade 1: Variáveis de ambiente no servidor (Vercel ou .env.local)
  const serverToken = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT;
  if (serverToken && serverToken.trim() && serverToken !== 'ghp_your_github_token_here') {
    return serverToken.trim();
  }

  // 2. Prioridade 2: Token enviado pelo cliente via Authorization: Bearer <token>
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (bearer) return bearer;
  }

  return null;
}

import { checkAuthAndRateLimit } from '../lib/server/_security';

export default async function handler(req: Request): Promise<Response> {
  const securityResponse = checkAuthAndRateLimit(req);
  if (securityResponse) return securityResponse;

  const token = getEffectiveToken(req);

  if (!token) {
    return new Response(
      JSON.stringify({
        error:
          'Token do GitHub não configurado. Adicione GITHUB_TOKEN nas variáveis de ambiente da Vercel ou configure um token no Synap.',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const octokit = new Octokit({ auth: token });
  const url = new URL(req.url);
  const action = url.searchParams.get('action') || '';

  try {
    // 1. Obter usuário autenticado
    if (action === 'user' || action === 'verify') {
      const { data } = await octokit.rest.users.getAuthenticated();
      return new Response(
        JSON.stringify({
          login: data.login,
          avatar_url: data.avatar_url,
          name: data.name ?? null,
          html_url: data.html_url,
          source: Boolean(process.env.GITHUB_TOKEN || process.env.GITHUB_PAT) ? 'env' : 'client',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 2. Listar repositórios do usuário
    if (action === 'repos') {
      const data = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
        sort: 'updated',
        direction: 'desc',
      });

      const repos = data.map((r) => ({
        id: r.id,
        name: r.name,
        full_name: r.full_name,
        owner: {
          login: r.owner.login,
          avatar_url: r.owner.avatar_url,
        },
        description: r.description,
        default_branch: r.default_branch,
        language: r.language,
        stargazers_count: r.stargazers_count,
        updated_at: r.updated_at,
        private: r.private,
      }));

      return new Response(JSON.stringify(repos), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Listar branches de um repositório
    if (action === 'branches') {
      const owner = url.searchParams.get('owner') || '';
      const repo = url.searchParams.get('repo') || '';

      if (!owner || !repo) {
        return new Response(JSON.stringify({ error: 'Parâmetros owner e repo são obrigatórios.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const data = await octokit.paginate(octokit.rest.repos.listBranches, {
        owner,
        repo,
      });

      return new Response(JSON.stringify(data.map((b) => b.name)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 4. Listar conteúdo de diretório
    if (action === 'contents') {
      const owner = url.searchParams.get('owner') || '';
      const repo = url.searchParams.get('repo') || '';
      const path = url.searchParams.get('path') || '';
      const branch = url.searchParams.get('branch') || undefined;

      if (!owner || !repo) {
        return new Response(JSON.stringify({ error: 'Parâmetros owner e repo são obrigatórios.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref: branch,
      });

      if (Array.isArray(data)) {
        const items = data.map((item) => ({
          name: item.name,
          path: item.path,
          sha: item.sha,
          size: item.size,
          type: item.type === 'dir' ? 'dir' : 'file',
        }));
        return new Response(JSON.stringify(items), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 5. Ler conteúdo de um arquivo específico
    if (action === 'file') {
      const owner = url.searchParams.get('owner') || '';
      const repo = url.searchParams.get('repo') || '';
      const path = url.searchParams.get('path') || '';
      const branch = url.searchParams.get('branch') || undefined;

      if (!owner || !repo || !path) {
        return new Response(JSON.stringify({ error: 'Parâmetros owner, repo e path são obrigatórios.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref: branch,
      });

      if (!Array.isArray(data) && 'type' in data && data.type === 'file') {
        let base64Content = data.content || '';

        // Se o arquivo for maior que ~1MB, o GitHub retorna content vazio. Buscamos pelo Blob.
        if (data.size > 1000000 || !base64Content) {
          try {
            const blob = await octokit.rest.git.getBlob({
              owner,
              repo,
              file_sha: data.sha,
            });
            base64Content = blob.data.content;
          } catch (blobErr: any) {
            return new Response(
              JSON.stringify({ error: `Falha ao ler arquivo grande (>1MB): ${blobErr.message}` }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
          }
        }

        const buf = Buffer.from(base64Content, 'base64');

        // Checar se o conteúdo é um binário diretamente no buffer (antes de tentar decodificar utf-8)
        if (buf.includes(0)) {
          return new Response(
            JSON.stringify({ error: 'Arquivo binário. Não pode ser exibido ou editado como texto.' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const decoded = buf.toString('utf-8');

        return new Response(JSON.stringify({ content: decoded, sha: data.sha }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'Caminho não é um arquivo suportado.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 6. Buscar código no repositório ativo (comportamento idêntico ao VS Code)
    if (action === 'search') {
      const q = url.searchParams.get('q') || '';
      const owner = url.searchParams.get('owner') || '';
      const repo = url.searchParams.get('repo') || '';
      const pathFilter = url.searchParams.get('path') || '';
      const extFilter = url.searchParams.get('extension') || '';

      if (!q.trim()) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Restringir a busca exclusivamente ao repositório ativo (repo:owner/repo)
      const targetRepo = owner && repo ? (repo.includes('/') ? repo : `${owner}/${repo}`) : repo;
      if (!targetRepo) {
        return new Response(
          JSON.stringify({ error: 'Nenhum repositório ativo configurado para busca de código.' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Limpa qualquer qualificador repo manual para garantir escopo estrito no repositório ativo
      const cleanTerm = q.replace(/repo:[^\s]+/gi, '').trim();
      let searchQuery = cleanTerm ? `${cleanTerm} repo:${targetRepo}` : `repo:${targetRepo}`;

      if (pathFilter && !searchQuery.includes('path:')) {
        searchQuery = `${searchQuery} path:${pathFilter}`;
      }
      if (extFilter && !searchQuery.includes('extension:')) {
        searchQuery = `${searchQuery} extension:${extFilter}`;
      }

      try {
        const { data } = await octokit.rest.search.code({
          q: searchQuery,
          per_page: 20,
          headers: {
            accept: 'application/vnd.github.text-match+json',
          },
        });

        const items = (data.items || []).map((i: any) => ({
          name: i.name,
          path: i.path,
          html_url: i.html_url,
          snippets: (i.text_matches || []).map((tm: any) => tm.fragment).filter(Boolean).slice(0, 3),
        }));

        return new Response(JSON.stringify(items), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (searchErr: any) {
        return new Response(
          JSON.stringify({ error: searchErr?.message || 'Falha ao buscar código no GitHub.' }),
          {
            status: searchErr?.status || 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // 7. Criar commit atômico com múltiplos arquivos (Trees API)
    if (action === 'commit' && req.method.toUpperCase() === 'POST') {
      const body = await req.json();
      const { owner, repo, branch, message, changes } = body;

      if (!owner || !repo || !branch || !message || !Array.isArray(changes)) {
        return new Response(
          JSON.stringify({ error: 'Dados insuficientes para realizar o commit.' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // SHA do último commit da branch
      const { data: ref } = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${branch}`,
      });

      // Árvore do commit base com recursão para pegar SHA original e manter mode (+x)
      const { data: lastCommit } = await octokit.rest.git.getCommit({
        owner,
        repo,
        commit_sha: ref.object.sha,
      });

      const { data: treeData } = await octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: lastCommit.tree.sha,
        recursive: 'true',
      });
      const currentItems = treeData.tree;

      try {
        const treeItems = await Promise.all(
          changes.map(async (change) => {
            const existingItem = currentItems.find((i) => i.path === change.path);

            // Proteção contra Lost Update
            if (change.type !== 'added' && change.baseSha && existingItem) {
              if (existingItem.sha !== change.baseSha) {
                throw {
                  status: 409,
                  message: `Conflito de edição: O arquivo ${change.path} foi modificado no GitHub depois que você abriu. Recarregue o arquivo.`,
                };
              }
            }

            const mode = (existingItem?.mode || '100644') as any;

            if (change.type === 'deleted') {
              return { path: change.path, mode: '100644' as any, type: 'blob' as const, sha: null };
            } else {
              const { data: blob } = await octokit.rest.git.createBlob({
                owner,
                repo,
                content: change.newContent || '',
                encoding: 'utf-8',
              });
              return { path: change.path, mode, type: 'blob' as const, sha: blob.sha };
            }
          })
        );

        // Nova árvore
        const { data: newTree } = await octokit.rest.git.createTree({
          owner,
          repo,
          base_tree: lastCommit.tree.sha,
          tree: treeItems,
        });

        // Novo commit
        const { data: newCommit } = await octokit.rest.git.createCommit({
          owner,
          repo,
          message,
          tree: newTree.sha,
          parents: [ref.object.sha],
        });

        // Atualizar branch ref
        await octokit.rest.git.updateRef({
          owner,
          repo,
          ref: `heads/${branch}`,
          sha: newCommit.sha,
        });

        return new Response(
          JSON.stringify({
            sha: newCommit.sha,
            html_url: `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      } catch (err: any) {
        if (err.status === 409) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        throw err;
      }
    }

    // 8. Criar nova branch direto pela UI (a partir de uma branch existente)
    if (action === 'create_branch' && req.method.toUpperCase() === 'POST') {
      const body = await req.json();
      const { owner, repo, branch, fromBranch } = body;

      if (!owner || !repo || !branch) {
        return new Response(
          JSON.stringify({ error: 'Parâmetros owner, repo e branch são obrigatórios.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const cleanBranch = branch.trim().replace(/^refs\/heads\//, '').replace(/\s+/g, '-');
      const baseBranch = fromBranch || 'main';
      let baseSha = '';

      try {
        const { data: ref } = await octokit.rest.git.getRef({
          owner,
          repo,
          ref: `heads/${baseBranch}`,
        });
        baseSha = ref.object.sha;
      } catch (refErr: any) {
        if (baseBranch === 'main' && refErr.status === 404) {
          const { data: refMaster } = await octokit.rest.git.getRef({
            owner,
            repo,
            ref: 'heads/master',
          });
          baseSha = refMaster.object.sha;
        } else if (refErr.status === 404) {
          throw new Error(`Branch base '${baseBranch}' não encontrada no repositório.`);
        } else {
          throw refErr; // Repassa erros reais de autenticação ou rate limit
        }
      }

      const { data: newRef } = await octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${cleanBranch}`,
        sha: baseSha,
      });

      return new Response(
        JSON.stringify({
          branch: cleanBranch,
          ref: newRef.ref,
          sha: newRef.object.sha,
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 9. Listar histórico de commits recentes do repositório
    if (action === 'commits') {
      const owner = url.searchParams.get('owner') || '';
      const repo = url.searchParams.get('repo') || '';
      const branch = url.searchParams.get('branch') || undefined;
      const perPage = Math.min(parseInt(url.searchParams.get('per_page') || '25', 10), 50);

      if (!owner || !repo) {
        return new Response(
          JSON.stringify({ error: 'Parâmetros owner e repo são obrigatórios.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const { data } = await octokit.rest.repos.listCommits({
        owner,
        repo,
        sha: branch,
        per_page: perPage,
      });

      const commits = data.map((c) => ({
        sha: c.sha,
        short_sha: c.sha.substring(0, 7),
        message: c.commit.message,
        author: {
          name: c.commit.author?.name || c.author?.login || 'Autor desconhecido',
          login: c.author?.login,
          avatar_url: c.author?.avatar_url,
          date: c.commit.author?.date || null,
        },
        html_url: c.html_url,
      }));

      return new Response(JSON.stringify(commits), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: `Ação '${action}' desconhecida.` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('GitHub API Proxy error:', err);
    return new Response(
      JSON.stringify({
        error: err?.message || 'Erro ao comunicar com a API do GitHub.',
      }),
      {
        status: err?.status || 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
