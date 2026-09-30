# Laboratório OAuth no Cloudflare Pages

Aplicação estática em português com login Google e GitHub, construída para o laboratório da Avaliação 2. O site fica em `public/`; as Pages Functions ficam em `functions/`, na raiz. Não há dependências de Node.js, npm, Wrangler ou bibliotecas externas no projeto.

## O que está implementado

- `/oauth/login/google` e `/oauth/login/github`: iniciam Authorization Code + PKCE S256, com `state` e cookie temporário protegido.
- `/oauth/callback/google`: valida a assinatura RS256 e as claims `iss`, `aud`, `exp`, `iat` e `nonce` do ID token do Google.
- `/oauth/callback/github`: consulta `/user`, revoga a autorização da OAuth App e só então cria a sessão local.
- `/api/me`: retorna somente e-mail e nome de exibição da sessão ativa.
- `POST /oauth/logout`: confere a origem, remove a sessão do D1 e expira o cookie.
- `/api/health`: verificação simples da Function.

Transações e sessões guardam no D1 somente o resumo SHA-256 do cookie. Segredos, tokens e verificadores não são enviados ao navegador nem registrados pelo código. Tudo em `public/` é público, inclusive `public/entrega1/`; não coloque credenciais, cookies, códigos ou capturas com dados sensíveis nessa pasta.

## Configuração do Cloudflare Pages

Conecte este repositório ao Cloudflare Pages usando a branch `main` e configure:

| Campo | Valor |
| --- | --- |
| Framework preset | None |
| Build command | vazio |
| Build output directory | `public` |
| Root directory | vazio |

O Pages deve reconhecer `functions/` automaticamente. Após cada alteração das variáveis, segredos ou binding, faça uma nova implantação de produção. O deploy automático em novos commits de `main` só ocorre depois que a integração Git do Pages estiver conectada e ativa.

### Banco D1

Crie um D1 e vincule-o ao ambiente de produção com o nome exato `DB`. Execute no console D1:

```sql
CREATE TABLE oauth_transactions (
	id_hash TEXT PRIMARY KEY,
	provider TEXT NOT NULL CHECK (provider IN ('google', 'github')),
	state_hash TEXT NOT NULL,
	nonce TEXT,
	code_verifier TEXT NOT NULL,
	expires_at INTEGER NOT NULL
);
CREATE INDEX oauth_transactions_expiry ON oauth_transactions (expires_at);

CREATE TABLE sessions (
	id_hash TEXT PRIMARY KEY,
	issuer TEXT NOT NULL,
	subject TEXT NOT NULL,
	email TEXT,
	display_name TEXT,
	expires_at INTEGER NOT NULL,
	created_at INTEGER NOT NULL
);
CREATE INDEX sessions_expiry ON sessions (expires_at);
```

Confira a criação no console com:

```sql
SELECT name, type FROM sqlite_schema
WHERE name NOT LIKE 'sqlite_%'
ORDER BY type, name;
```

### Provedores e variáveis

Primeiro publique em produção e copie a URL atribuída pelo Cloudflare, sem barra no final. Use somente URLs `pages.dev` de produção, nunca URLs de preview.

- Google OAuth Web client: redirect URI `URL_BASE/oauth/callback/google`; escopos `openid email profile`.
- GitHub OAuth App: homepage `URL_BASE`; callback `URL_BASE/oauth/callback/github`; não solicite escopos adicionais.
- Variáveis de texto no Pages: `PUBLIC_BASE_URL`, `GOOGLE_CLIENT_ID`, `GITHUB_CLIENT_ID`.
- Segredos criptografados no Pages: `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_SECRET`.

Configure os valores somente em **Settings > Variables and Secrets** no Pages. Nunca os adicione a arquivos, issues, commits ou evidências. Depois, publique novamente. A URL de produção deve corresponder exatamente às URLs registradas nos provedores.

## Verificação

Depois da implantação e configuração, confira `/api/health`, os dois redirecionamentos de login, `/api/me`, logout e os casos de falha do enunciado. Não registre valores de `state`, cookies, códigos ou tokens. O fluxo real não pode ser concluído localmente sem o projeto Pages, o banco D1, as URLs de produção e os segredos cadastrados nos painéis.

## Evidências

O enunciado exige os arquivos em `public/entrega1/`. `02-google-retorno.txt` e `03-github-retorno.txt` são modelos pendentes; `07-testes-falha.md` e `08-aceitacao.md` aguardam execução e conferência. Ainda faltam os comprovantes reais `01-pages-configuracao.pdf`, `04-d1-esquema.txt`, `05-inicio-login-google.pdf` e `06-inicio-login-github.pdf`. Eles dependem da configuração e da execução no painel Cloudflare/provedores. Não crie capturas fictícias. Remova ou oculte qualquer segredo e valor transitório antes de entregar evidências.