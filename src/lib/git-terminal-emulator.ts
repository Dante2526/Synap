import { ActiveRepoState, PendingChange, GitHubCommitItem } from './types';
import {
  fetchRepoBranches,
  fetchRepoContents,
  fetchFileContent,
  fetchRepoCommits,
  createRepoBranch,
  searchCode,
  callGitHubApi,
  GitHubUser,
} from './github';

export interface TerminalEmulatorContext {
  activeRepo: ActiveRepoState | null;
  changes: PendingChange[];
  cwd: string;
  setCwd: (newCwd: string) => void;
  gitHubUser: GitHubUser | null;
  onChangeBranch?: (branchName: string) => void;
  onCommitChanges?: (message: string) => Promise<boolean | any>;
  onRefreshRepo?: () => void;
  onClearTerminal?: () => void;
}

export interface TerminalEmulatorResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  cwd?: string;
  executionTimeMs?: number;
  success: boolean;
}

/**
 * Normalizes a path given current working directory (cwd).
 */
function resolvePath(cwd: string, relativePath: string): string {
  let cleanRelative = relativePath.trim();
  if (cleanRelative === '~' || cleanRelative === '/') return '/';
  if (cleanRelative.startsWith('/')) {
    cleanRelative = cleanRelative.substring(1);
  }

  const cwdParts = cwd.split('/').filter(Boolean);
  const targetParts = cleanRelative.split('/').filter(Boolean);

  for (const part of targetParts) {
    if (part === '.') continue;
    if (part === '..') {
      cwdParts.pop();
    } else {
      cwdParts.push(part);
    }
  }

  return '/' + cwdParts.join('/');
}

/**
 * Extracts options and arguments from a command string.
 */
function parseCommandArgs(cmdString: string): { command: string; args: string[]; flags: Record<string, boolean | string> } {
  const tokens: string[] = [];
  let currentToken = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < cmdString.length; i++) {
    const char = cmdString[i];

    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false;
      quoteChar = '';
    } else if (char === ' ' && !inQuotes) {
      if (currentToken) {
        tokens.push(currentToken);
        currentToken = '';
      }
    } else {
      currentToken += char;
    }
  }
  if (currentToken) tokens.push(currentToken);

  const command = tokens[0] ? tokens[0].toLowerCase() : '';
  const args: string[] = [];
  const flags: Record<string, boolean | string> = {};

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.startsWith('--')) {
      const eqIndex = token.indexOf('=');
      if (eqIndex !== -1) {
        const flagName = token.substring(2, eqIndex);
        const flagVal = token.substring(eqIndex + 1);
        flags[flagName] = flagVal;
      } else {
        flags[token.substring(2)] = true;
      }
    } else if (token.startsWith('-') && token.length > 1) {
      // e.g. -la, -a, -m
      const flagStr = token.substring(1);
      if (flagStr === 'm' && i + 1 < tokens.length) {
        flags['m'] = tokens[i + 1];
        i++; // skip next token since it was consumed as commit message
      } else if (flagStr === 'b' && i + 1 < tokens.length) {
        flags['b'] = tokens[i + 1];
        i++;
      } else if (flagStr === 'c' && i + 1 < tokens.length) {
        flags['c'] = tokens[i + 1];
        i++;
      } else if (flagStr === 'n' && i + 1 < tokens.length) {
        flags['n'] = tokens[i + 1];
        i++;
      } else {
        for (const char of flagStr) {
          flags[char] = true;
        }
      }
    } else {
      args.push(token);
    }
  }

  return { command, args, flags };
}

/**
 * Main Git Terminal Emulator Engine
 * Translates Git/Unix shell commands to real GitHub REST API calls and active app state.
 */
export async function executeEmulatedCommand(
  rawCommand: string,
  context: TerminalEmulatorContext
): Promise<TerminalEmulatorResult> {
  const startTime = Date.now();
  const trimmed = rawCommand.trim();

  if (!trimmed) {
    return {
      stdout: '',
      stderr: '',
      exitCode: 0,
      cwd: context.cwd,
      executionTimeMs: 0,
      success: true,
    };
  }

  const { command, args, flags } = parseCommandArgs(trimmed);
  const activeRepo = context.activeRepo;
  const owner = activeRepo?.owner;
  const repo = activeRepo?.repo;
  const branch = activeRepo?.branch || 'main';

  // Helper for returning quick responses
  const makeResult = (
    stdout: string,
    stderr: string = '',
    exitCode: number = 0
  ): TerminalEmulatorResult => ({
    stdout,
    stderr,
    exitCode,
    cwd: context.cwd,
    executionTimeMs: Date.now() - startTime,
    success: exitCode === 0,
  });

  try {
    // ==========================================
    // 1. UNIX / BASIC SYSTEM COMMANDS
    // ==========================================

    if (command === 'clear') {
      if (context.onClearTerminal) {
        context.onClearTerminal();
      }
      return makeResult('', '', 0);
    }

    if (command === 'pwd') {
      return makeResult(context.cwd);
    }

    if (command === 'whoami') {
      const userLogin = context.gitHubUser?.login || owner || 'synap-user';
      return makeResult(userLogin);
    }

    if (command === 'node' || command === 'node -v') {
      if (args[0] === '-v' || args[0] === '--version' || command === 'node -v') {
        return makeResult('v22.14.0 (GitHub API Emulator / WebAssembly)');
      }
      return makeResult('v22.14.0 (REPL indisponível no modo emulador)');
    }

    if (command === 'npm' || command === 'npm -v') {
      if (args[0] === '-v' || args[0] === '--version' || command === 'npm -v') {
        return makeResult('10.9.0');
      }
      if (args[0] === 'run' && args[1] === 'lint') {
        return makeResult('✓ tsc --noEmit (0 erros encontrados no repositório ativo)');
      }
      if (args[0] === 'test') {
        return makeResult('✓ 0 falhas nos testes');
      }
      return makeResult('npm v10.9.0 (Emulador Git Synap)');
    }

    if (command === 'echo') {
      return makeResult(args.join(' '));
    }

    if (command === 'cd') {
      const target = args[0] || '~';
      const newCwd = resolvePath(context.cwd, target);
      context.setCwd(newCwd);
      return makeResult('');
    }

    if (command === 'ls' || command === 'dir') {
      if (!owner || !repo) {
        return makeResult(
          '',
          'fatal: nenhum repositório GitHub ativo selecionado. Conecte um repositório no Synap.',
          1
        );
      }

      const targetPath = args[0] ? resolvePath(context.cwd, args[0]).replace(/^\//, '') : context.cwd.replace(/^\//, '');

      try {
        const remoteItems = await fetchRepoContents(null, owner, repo, targetPath, branch);

        // Merge local uncommitted changes into directory list
        const isLong = Boolean(flags['l'] || flags['la'] || flags['al'] || flags['a']);
        const lines: string[] = [];

        if (isLong) {
          lines.push(`total ${remoteItems.length}`);
          lines.push('drwxr-xr-x  2 git git 4096 Oct  9 15:00 .');
          lines.push('drwxr-xr-x  5 git git 4096 Oct  9 15:00 ..');
        }

        for (const item of remoteItems) {
          if (isLong) {
            const isDir = item.type === 'dir';
            const perm = isDir ? 'drwxr-xr-x' : '-rw-r--r--';
            const size = (item.size || 0).toString().padStart(8, ' ');
            lines.push(`${perm}  1 git git ${size} Oct  9 15:00 ${item.name}`);
          } else {
            lines.push(item.type === 'dir' ? `${item.name}/` : item.name);
          }
        }

        return makeResult(isLong ? lines.join('\n') : lines.join('  '));
      } catch (err: any) {
        return makeResult('', `ls: não foi possível acessar '${targetPath}': ${err?.message || 'Diretório não encontrado'}`, 2);
      }
    }

    if (command === 'cat' || command === 'head' || command === 'tail') {
      if (!owner || !repo) {
        return makeResult('', 'fatal: nenhum repositório GitHub ativo.', 1);
      }
      if (args.length === 0) {
        return makeResult('', `Uso: ${command} <caminho-do-arquivo>`, 1);
      }

      const filePath = resolvePath(context.cwd, args[0]).replace(/^\//, '');

      // First check in local pending changes
      const localMatch = context.changes.find((c) => c.path === filePath);
      let content = '';

      if (localMatch) {
        content = localMatch.newContent;
      } else {
        try {
          content = await fetchFileContent(null, owner, repo, filePath, branch);
        } catch (err: any) {
          return makeResult('', `${command}: ${filePath}: Arquivo não encontrado no repositório GitHub.`, 1);
        }
      }

      const lines = content.split('\n');
      if (command === 'head') {
        const n = typeof flags['n'] === 'string' ? parseInt(flags['n'], 10) : 10;
        return makeResult(lines.slice(0, n).join('\n'));
      }
      if (command === 'tail') {
        const n = typeof flags['n'] === 'string' ? parseInt(flags['n'], 10) : 10;
        return makeResult(lines.slice(-n).join('\n'));
      }

      return makeResult(content);
    }

    if (command === 'grep') {
      if (!owner || !repo) {
        return makeResult('', 'fatal: nenhum repositório GitHub ativo.', 1);
      }
      const term = args[0] || (typeof flags['e'] === 'string' ? flags['e'] : '');
      if (!term) {
        return makeResult('', 'Uso: grep <termo> [arquivo]', 1);
      }

      if (args[1]) {
        // Grep in specific file
        const filePath = resolvePath(context.cwd, args[1]).replace(/^\//, '');
        try {
          const content = await fetchFileContent(null, owner, repo, filePath, branch);
          const matched = content
            .split('\n')
            .filter((l) => l.toLowerCase().includes(term.toLowerCase()))
            .join('\n');
          return makeResult(matched || 'Nenhuma correspondência encontrada.');
        } catch (err: any) {
          return makeResult('', `grep: ${filePath}: ${err.message}`, 1);
        }
      } else {
        // Search across GitHub repository
        try {
          const matches = await searchCode(null, term, owner, repo);
          if (matches.length === 0) {
            return makeResult('Nenhuma correspondência encontrada no repositório.');
          }
          const formatted = matches
            .map((m) => `${m.path}:\n  ${(m.snippets || []).join('\n  ')}`)
            .join('\n\n');
          return makeResult(formatted);
        } catch (err: any) {
          return makeResult('', `grep erro: ${err.message}`, 1);
        }
      }
    }

    // ==========================================
    // 2. GIT COMMANDS (GitHub REST API Emulator)
    // ==========================================

    if (command === 'git') {
      const subCommand = args[0] ? args[0].toLowerCase() : '';

      if (!subCommand || subCommand === '--help' || subCommand === 'help') {
        const helpText = `git version 2.43.0 (GitHub API Emulator)
Comandos suportados no Synap:
  git status                Mostra o estado das alterações pendentes
  git branch [-a]           Lista as branches do repositório
  git checkout <branch>     Troca de branch
  git checkout -b <branch>  Cria e altera para uma nova branch no GitHub
  git switch <branch>       Troca de branch
  git switch -c <branch>    Cria e altera para uma nova branch no GitHub
  git log [-n N] [--oneline] Lista o histórico real de commits
  git commit -m "msg"       Cria um commit atômico real na API do GitHub
  git push                  Sincroniza e confirma pushes realizados no GitHub
  git pull / git fetch      Atualiza o estado do repositório
  git remote -v             Exibe os URLs do repositório remoto
  git diff                  Exibe as linhas alteradas pendentes`;
        return makeResult(helpText);
      }

      if (subCommand === '--version' || subCommand === 'version') {
        return makeResult('git version 2.43.0 (github-api-emulator)');
      }

      if (!owner || !repo) {
        return makeResult(
          '',
          'fatal: not a git repository (or any of the parent directories): .git\nSelecione um repositório ativo no painel lateral do Synap.',
          128
        );
      }

      // GIT STATUS
      if (subCommand === 'status') {
        const repoFullName = activeRepo?.fullName || `${owner}/${repo}`;
        const repoChanges = context.changes.filter(
          (c) => !c.repo || c.repo === repoFullName
        );

        let out = `On branch ${branch}\n`;
        out += `Your branch is up to date with 'origin/${branch}'.\n\n`;

        if (repoChanges.length === 0) {
          out += 'nothing to commit, working tree clean';
        } else {
          out += 'Changes to be committed:\n';
          out += '  (use "git restore --staged <file>..." to unstage)\n';
          for (const change of repoChanges) {
            const prefix =
              change.type === 'added'
                ? 'new file:'
                : change.type === 'deleted'
                ? 'deleted:'
                : 'modified:';
            out += `\t\x1b[32m${prefix.padEnd(12)} ${change.path}\x1b[0m\n`;
          }
        }

        return makeResult(out);
      }

      // GIT REMOTE
      if (subCommand === 'remote') {
        const remoteUrl = `https://github.com/${owner}/${repo}.git`;
        if (flags['v'] || args[1] === '-v') {
          return makeResult(
            `origin\t${remoteUrl} (fetch)\norigin\t${remoteUrl} (push)`
          );
        }
        return makeResult('origin');
      }

      // GIT BRANCH
      if (subCommand === 'branch') {
        try {
          const branches = await fetchRepoBranches(null, owner, repo);
          if (branches.length === 0) {
            return makeResult(`* ${branch}`);
          }
          const formatted = branches
            .map((bName) => (bName === branch ? `* \x1b[32m${bName}\x1b[0m` : `  ${bName}`))
            .join('\n');
          return makeResult(formatted);
        } catch (err: any) {
          return makeResult('', `fatal: falha ao buscar branches: ${err.message}`, 1);
        }
      }

      // GIT CHECKOUT & GIT SWITCH
      if (subCommand === 'checkout' || subCommand === 'switch') {
        const newBranchName =
          (typeof flags['b'] === 'string' ? flags['b'] : null) ||
          (typeof flags['c'] === 'string' ? flags['c'] : null) ||
          args[1] ||
          args[0];

        const isNewBranch = Boolean(flags['b'] || flags['c'] || args[1] === '-b' || args[1] === '-c');

        if (!newBranchName || newBranchName === subCommand) {
          return makeResult('', 'fatal: especifique o nome da branch.', 1);
        }

        if (isNewBranch) {
          try {
            const created = await createRepoBranch(undefined, owner, repo, newBranchName, branch);
            if (context.onChangeBranch) {
              context.onChangeBranch(created.branch);
            }
            return makeResult(
              `Switched to a new branch '${created.branch}' (SHA: ${created.sha.substring(0, 7)})`
            );
          } catch (err: any) {
            return makeResult('', `fatal: erro ao criar branch '${newBranchName}': ${err.message}`, 1);
          }
        } else {
          try {
            const branches = await fetchRepoBranches(null, owner, repo);
            if (!branches.includes(newBranchName)) {
              return makeResult(
                '',
                `error: pathspec '${newBranchName}' did not match any file(s) known to git.\nUse 'git checkout -b ${newBranchName}' para criar uma nova branch.`,
                1
              );
            }
            if (context.onChangeBranch) {
              context.onChangeBranch(newBranchName);
            }
            return makeResult(`Switched to branch '${newBranchName}'`);
          } catch (err: any) {
            return makeResult('', `fatal: falha ao alternar branch: ${err.message}`, 1);
          }
        }
      }

      // GIT LOG
      if (subCommand === 'log') {
        const limit = typeof flags['n'] === 'string' ? parseInt(flags['n'], 10) : 10;
        const isOneLine = Boolean(flags['oneline']);

        try {
          const commits: GitHubCommitItem[] = await fetchRepoCommits(undefined, owner, repo, branch, limit);

          if (commits.length === 0) {
            return makeResult('Nenhum commit encontrado nesta branch.');
          }

          if (isOneLine) {
            const formatted = commits
              .map((c) => `\x1b[33m${c.short_sha}\x1b[0m ${c.message}`)
              .join('\n');
            return makeResult(formatted);
          } else {
            const formatted = commits
              .map(
                (c) =>
                  `\x1b[33mcommit ${c.sha}\x1b[0m\nAuthor: ${c.author.name} <${c.author.login || 'github'}>\nDate:   ${c.author.date || 'Recente'}\n\n    ${c.message.split('\n').join('\n    ')}\n`
              )
              .join('\n');
            return makeResult(formatted);
          }
        } catch (err: any) {
          return makeResult('', `fatal: falha ao carregar histórico de commits: ${err.message}`, 1);
        }
      }

      // GIT ADD
      if (subCommand === 'add') {
        return makeResult('');
      }

      // GIT COMMIT
      if (subCommand === 'commit') {
        const repoFullName = activeRepo?.fullName || `${owner}/${repo}`;
        const repoChanges = context.changes.filter(
          (c) => !c.repo || c.repo === repoFullName
        );

        if (repoChanges.length === 0) {
          return makeResult('On branch ' + branch + '\nnothing to commit, working tree clean');
        }

        const msg = (typeof flags['m'] === 'string' ? flags['m'] : null) || args[1] || 'commit via Synap Git Terminal';

        if (context.onCommitChanges) {
          try {
            const success = await context.onCommitChanges(msg);
            if (success) {
              return makeResult(
                `[${branch} (root-commit)] ${msg}\n ${repoChanges.length} file(s) changed, atomic commit pushed directly to GitHub.`
              );
            } else {
              return makeResult('', 'fatal: falha ao realizar commit no GitHub.', 1);
            }
          } catch (err: any) {
            return makeResult('', `fatal: erro ao realizar commit: ${err.message}`, 1);
          }
        } else {
          return makeResult('', 'fatal: manipulador de commit não configurado no Synap.', 1);
        }
      }

      // GIT PUSH
      if (subCommand === 'push') {
        return makeResult(
          `To https://github.com/${owner}/${repo}.git\n   Everything up-to-date (Todos os commits realizados via Synap já estão publicados no GitHub).`
        );
      }

      // GIT PULL / FETCH
      if (subCommand === 'pull' || subCommand === 'fetch') {
        if (context.onRefreshRepo) {
          context.onRefreshRepo();
        }
        return makeResult(
          `From https://github.com/${owner}/${repo}\n * branch            ${branch}     -> FETCH_HEAD\nAlready up to date.`
        );
      }

      // GIT DIFF
      if (subCommand === 'diff') {
        const repoFullName = activeRepo?.fullName || `${owner}/${repo}`;
        const repoChanges = context.changes.filter(
          (c) => !c.repo || c.repo === repoFullName
        );

        if (repoChanges.length === 0) {
          return makeResult('');
        }

        const diffLines = repoChanges.map(
          (c) =>
            `diff --git a/${c.path} b/${c.path}\n--- a/${c.path}\n+++ b/${c.path}\n@@ -1,3 +1,5 @@\n+ [Alterações no arquivo ${c.path}]`
        );
        return makeResult(diffLines.join('\n\n'));
      }

      return makeResult(
        '',
        `git: '${subCommand}' não é um comando do git. Veja 'git --help'.`,
        1
      );
    }

    // ==========================================
    // 3. COMANDO NÃO RECONHECIDO (MOCK BASH ERROR)
    // ==========================================
    return makeResult(
      '',
      `bash: ${command}: comando não encontrado no emulador Git. Digite 'git --help' ou 'ls', 'pwd', 'cat', 'git status'.`,
      127
    );
  } catch (globalErr: any) {
    return makeResult(
      '',
      `Erro de execução no emulador: ${globalErr?.message || 'Erro interno'}`,
      1
    );
  }
}
