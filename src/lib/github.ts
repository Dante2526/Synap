import { Octokit } from 'octokit';
import { GitHubRepo, GitHubFileItem } from './types';

export const GITHUB_PAT_KEY = 'synap_github_pat';

export function getGitHubPat(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(GITHUB_PAT_KEY);
}

export function setGitHubPat(pat: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(GITHUB_PAT_KEY, pat.trim());
}

export function removeGitHubPat(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(GITHUB_PAT_KEY);
}

export function getOctokit(customPat?: string): Octokit | null {
  const token = customPat || getGitHubPat();
  if (!token) return null;
  return new Octokit({ auth: token });
}

export interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string | null;
  html_url: string;
  source?: 'env' | 'client';
}

export function getClientAuthHeaders(): Record<string, string> {
  const pat = getGitHubPat();
  if (pat) {
    return { Authorization: `Bearer ${pat}` };
  }
  return {};
}

export async function callGitHubApi<T>(
  action: string,
  params: Record<string, string> = {},
  method: 'GET' | 'POST' = 'GET',
  body?: any
): Promise<T> {
  const searchParams = new URLSearchParams({ action, ...params });
  const headers: Record<string, string> = {
    ...getClientAuthHeaders(),
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`/api/github?${searchParams.toString()}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Erro na API GitHub (${res.status})`);
  }
  return data as T;
}

export async function verifyGitHubPat(customPat?: string): Promise<GitHubUser> {
  if (customPat && customPat.trim()) {
    const octokit = new Octokit({ auth: customPat.trim() });
    const { data } = await octokit.rest.users.getAuthenticated();
    return {
      login: data.login,
      avatar_url: data.avatar_url,
      name: data.name ?? null,
      html_url: data.html_url,
      source: 'client',
    };
  }

  return callGitHubApi<GitHubUser>('user');
}

export async function fetchUserRepos(_octokit?: Octokit | null): Promise<GitHubRepo[]> {
  return callGitHubApi<GitHubRepo[]>('repos');
}

export async function fetchRepoBranches(
  _octokit?: Octokit | null,
  owner?: string,
  repo?: string
): Promise<string[]> {
  if (!owner || !repo) return [];
  return callGitHubApi<string[]>('branches', { owner, repo });
}

export async function fetchRepoContents(
  _octokit?: Octokit | null,
  owner?: string,
  repo?: string,
  path: string = '',
  branch?: string
): Promise<GitHubFileItem[]> {
  if (!owner || !repo) return [];
  const params: Record<string, string> = { owner, repo, path };
  if (branch) params.branch = branch;
  const items = await callGitHubApi<GitHubFileItem[]>('contents', params);
  return items.sort((a, b) => {
    if (a.type === 'dir' && b.type !== 'dir') return -1;
    if (a.type !== 'dir' && b.type === 'dir') return 1;
    return a.name.localeCompare(b.name);
  });
}

export async function fetchFileContent(
  _octokit?: Octokit | null,
  owner?: string,
  repo?: string,
  path?: string,
  branch?: string
): Promise<string> {
  if (!owner || !repo || !path) throw new Error('Parâmetros inválidos');
  const params: Record<string, string> = { owner, repo, path };
  if (branch) params.branch = branch;
  const res = await callGitHubApi<{ content: string }>('file', params);
  return res.content;
}

export async function searchCode(
  _octokit?: Octokit | null,
  query?: string
): Promise<Array<{ name: string; path: string; html_url: string }>> {
  if (!query) return [];
  return callGitHubApi<Array<{ name: string; path: string; html_url: string }>>('search', { q: query });
}
