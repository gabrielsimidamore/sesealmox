# Buscador de Estoque (sesealmox)

App de busca inteligente de itens do almoxarifado, com foto.
React + Vite + TypeScript + Supabase.

## Rodar local
```bash
npm install
npm run dev
```
O `.env` já vem com a URL e a chave publishable do Supabase.

## Subir no GitHub
```bash
git init
git add .
git commit -m "sistema buscador de estoque"
git branch -M main
git remote add origin https://github.com/gabrielsimidamore/sesealmox.git
git push -u origin main
```
Quando pedir senha no push, use um **token novo** (Personal Access Token com permissão *Contents: Read and write*).

## Deploy na Vercel
1. Importe o repo `sesealmox` na Vercel.
2. Framework: **Vite** (detecta sozinho). Build: `npm run build` · Output: `dist`
3. Em **Settings → Environment Variables**, adicione:
   - `VITE_SUPABASE_URL` = https://eljqanjjznlpcuwjxtsf.supabase.co
   - `VITE_SUPABASE_KEY` = (a chave publishable `sb_publishable_...`)
4. Deploy.

## Criar o primeiro usuário (login)
No Supabase → **Authentication → Users → Add user** (email + senha).
Esse será o login que a equipe usa pra entrar no app.

## Estrutura
- `src/components/Busca.tsx` — tela de busca (chama `buscar_itens`)
- `src/components/ItemDetalhe.tsx` — detalhe do item + foto ampliável
- `src/components/Admin.tsx` — cadastro de itens (câmera/upload) e locações
- `src/lib/supabase.ts` — conexão com o Supabase

Banco já criado no projeto Supabase `estoquealmox`: tabelas `itens` e `locacoes`,
função de busca `buscar_itens`, bucket `fotos`.
