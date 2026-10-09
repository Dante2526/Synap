import { Octokit } from 'octokit';

export const config = {
  runtime: 'nodejs',
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

export default async function handler(req: Request): Promise<Response> {
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
      const { data } = await octokit.rest.repos.listForAuthenticatedUser({
        sort: 'updated',
        per_page: 100,
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

      const { data } = await octokit.rest.repos.listBranches({
        owner,
        repo,
        per_page: 50,
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

      if (!Array.isArray(data) && 'content' in data && data.content) {
        const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
        return new Response(JSON.stringify({ content: decoded }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ content: '' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 6. Buscar código no repositório
    if (action === 'search') {
      const q = url.searchParams.get('q') || '';
      if (!q) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const { data } = await octokit.rest.search.code({
        q,
        per_page: 15,
      });

      const items = data.items.map((i) => ({
        name: i.name,
        path: i.path,
        html_url: i.html_url,
      }));

      return new Response(JSON.stringify(items), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
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

      // Árvore do commit base
      const { data: lastCommit } = await octokit.rest.git.getCommit({
        owner,
        repo,
        commit_sha: ref.object.sha,
      });

      const treeItems: any[] = [];
      for (const change of changes) {
        if (change.type === 'deleted') {
          treeItems.push({
            path: change.path,
            mode: '100644',
            type: 'blob',
            sha: null,
          });
        } else {
          const { data: blob } = await octokit.rest.git.createBlob({
            owner,
            repo,
            content: change.newContent || '',
            encoding: 'utf-8',
          });
          treeItems.push({
            path: change.path,
            mode: '100644',
            type: 'blob',
            sha: blob.sha,
          });
        }
      }

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
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
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
