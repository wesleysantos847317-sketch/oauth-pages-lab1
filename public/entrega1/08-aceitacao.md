# Critérios de aceitação

Marque e assine somente depois de verificar cada item na implantação de produção. Nenhum item está confirmado pelo repositório local.

- [ ] O site é servido pelo endereço `pages.dev` atribuído à equipe.
- [ ] Os arquivos estáticos e as Functions compartilham a mesma origem.
- [ ] O projeto foi publicado por integração com GitHub.
- [ ] A equipe não instalou nem executou Node.js, npm, npx ou Wrangler para este laboratório.
- [ ] Cada provedor usa uma URL de retorno própria e exata.
- [ ] Os pedidos de autorização usam código e PKCE S256.
- [ ] A Function apresenta o Client Secret correto somente na troca de tokens.
- [ ] O retorno recusa uma transação ausente, expirada, alterada ou reutilizada.
- [ ] O ID token do Google só produz uma sessão depois da validação criptográfica e semântica.
- [ ] O access token do GitHub é usado somente para consultar `/user` e a autorização é revogada antes da criação da sessão.
- [ ] O cookie de sessão é opaco, Secure, HttpOnly, SameSite=Strict e não possui Domain.
- [ ] O D1 guarda o resumo do cookie, não seu valor bruto.
- [ ] `/api/me` devolve somente o perfil necessário.
- [ ] O logout confere Origin, remove a sessão e expira o cookie.
- [ ] Um cookie revogado não restaura a sessão.
- [ ] Tokens e segredos não aparecem no HTML, nas URLs salvas, no armazenamento Web ou nos registros.
- [ ] A dupla consegue explicar por que os arquivos estáticos permanecem públicos.
- [ ] As sessões administrativas foram encerradas no computador compartilhado.

Integrantes: ____________________________________

Data: ____ / ____ / ______