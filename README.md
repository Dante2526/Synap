# Synap — AI Chat (NVIDIA NIM & GLM)

App web de chat com IA estilo ChatGPT, conectado à API da NVIDIA NIM (endpoint OpenAI-compatible), com suporte a modelos GLM-5.3 e GLM-5.3-Flash, controle completo de `reasoning_effort`, visão multimodal (imagens), voz nativa (STT e TTS) e histórico offline salvo no IndexedDB.

---

## 🚀 Como Rodar

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar variáveis de ambiente
Copie o modelo de ambiente:
```bash
cp .env.local.example .env.local
```
Edite `.env.local` e adicione a sua chave da NVIDIA NIM:
```env
NVIDIA_API_KEY=nvapi-sua-chave-aqui
```
*(Você pode obter uma chave gratuita com créditos em [https://build.nvidia.com](https://build.nvidia.com))*

### 3. Iniciar o servidor
```bash
npm run dev
```

### 4. Acessar no navegador
- **No PC**: [http://localhost:3000](http://localhost:3000)
- **No Celular (mesma Wi-Fi)**: `http://[IP-DO-SEU-PC]:3000`
- **No Celular (via Tailscale / qualquer lugar)**: `http://[IP-TAILSCALE-DO-PC]:3000`

---

## 🌐 Como Fazer Deploy na Vercel (Passo a Passo)

O projeto já está 100% pronto para a Vercel com Edge Functions para streaming SSE sem limite de tempo e sem buffer.

### Método 1: Pelo GitHub (Recomendado)
1. Crie um repositório no seu GitHub (pode ser privado ou público).
2. Suba o projeto para o GitHub:
   ```bash
   git init
   git add .
   git commit -m "feat: chat nvidia nim"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
   git push -u origin main
   ```
3. Acesse [vercel.com](https://vercel.com) e faça login com seu GitHub.
4. Clique em **"Add New..."** > **"Project"** e importe o repositório do chat.
5. Na tela de configuração antes de clicar em Deploy:
   - Expanda **"Environment Variables"**.
   - Nome: `NVIDIA_API_KEY`
   - Valor: sua chave da NVIDIA (`nvapi-...`).
6. Clique no botão **Deploy**.
7. Pronto! A Vercel vai gerar uma URL pública com HTTPS (ex: `https://meu-chat.vercel.app`) para você usar tanto no PC quanto no celular em qualquer lugar.

### Método 2: Pela CLI da Vercel
```bash
npm i -g vercel
vercel
```
Durante o processo, informe a variável `NVIDIA_API_KEY`.

---

## ⚡ Funcionalidades Principais

1. **Multi-conversa com Persistência Local**:
   - Sidebar com listagem de conversas, timestamps e títulos automáticos.
   - Renomeação e exclusão de conversas.
   - Salvo no IndexedDB via `idb-keyval` (continua salvo mesmo após fechar o navegador).
   - Exportação do histórico completo em JSON e opção de limpeza total com confirmação dupla.

2. **Conexão Segura com NVIDIA NIM**:
   - Proxy server-side em `/api/chat` via Express.
   - A `NVIDIA_API_KEY` **nunca** é exposta ao navegador do usuário.
   - Streaming Server-Sent Events (SSE) palavra por palavra.

3. **Controle de `reasoning_effort`**:
   - Seletor visível no topo (`low`, `high`, `max`).
   - Enviado no nível raiz da requisição para a NVIDIA (`payload.reasoning_effort`).
   - Persistido no `localStorage`.

4. **Modelos Suportados**:
   - `GLM-5.3 (Pensar)` (`z-ai/glm-5.3`): Modo texto focado em raciocínio analítico.
   - `GLM-5.3-Flash (Rápido + Visão)` (`z-ai/glm-5.3-flash`): Multimodal com suporte a upload de imagens.

5. **Visão Multimodal**:
   - Upload de imagens (PNG, JPG, WebP, GIF até 5MB).
   - Conversão para base64 no formato padrão OpenAI `image_url`.
   - Suporte a múltiplas imagens por mensagem.

6. **Voz Nativa (Web Speech API)**:
   - **Entrada (Speech-to-Text)**: Botão de microfone com reconhecimento em português (`pt-BR`).
   - **Saída (Text-to-Speech)**: Botão de alto-falante em cada mensagem do assistente para ouvir a resposta em voz alta.

7. **Renderização de Markdown & Código**:
   - Suporte completo a tabelas, listas, links e blocos de código com botão de cópia com feedback instantâneo.
   - Accordion de raciocínio (Thinking process) expansível.

8. **PWA (Progressive Web App)**:
   - `manifest.json` completo e service worker para cache do shell.
   - Instalável na tela de início de celulares Android e iOS.
