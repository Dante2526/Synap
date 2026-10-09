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
        if (baseBranch === 'main') {
          const { data: refMaster } = await octokit.rest.git.getRef({
            owner,
            repo,
            ref: 'heads/master',
          });
          baseSha = refMaster.object.sha;
        } else {
          throw new Error(`Branch base '${baseBranch}' não encontrada no repositório.`);
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
