# Testes de falha

Preencha o resultado observado somente depois de executar cada teste na implantação de producao. Nao copie URLs transitórias, cookies, tokens ou códigos para este arquivo.

## Caso 1: retorno sem cookie temporário

- Preparação: iniciar o login e abrir a URL de autorização em uma janela sem o cookie temporário.
- Pedido enviado: concluir o login nessa janela e retornar ao callback.
- Resultado esperado: callback recusado; nenhuma sessão criada.
- Resultado observado: PENDENTE - nao executado.

## Caso 2: state alterado

- Preparação: iniciar outro login e alterar um caractere de `state` antes de autenticar.
- Pedido enviado: concluir o login com o `state` alterado.
- Resultado esperado: callback recusado antes da troca do código.
- Resultado observado: PENDENTE - nao executado.

## Caso 3: reutilização da transação

- Preparação: concluir um login válido.
- Pedido enviado: abrir novamente a URL de retorno usada no login.
- Resultado esperado: callback recusado porque a transação já foi removida.
- Resultado observado: PENDENTE - nao executado.

## Caso 4: sessão expirada

- Preparação: criar uma sessão de teste.
- Pedido enviado: no D1 de laboratório, executar `UPDATE sessions SET expires_at = 0;` e consultar `/api/me`.
- Resultado esperado: `/api/me` responde 401.
- Resultado observado: PENDENTE - nao executado.

## Caso 5: origem inválida na saída

- Preparação: manter uma sessão válida na URL_BASE.
- Pedido enviado: enviar `POST /oauth/logout` com `Origin` diferente de URL_BASE.
- Resultado esperado: operação recusada e sessão original continua válida.
- Resultado observado: PENDENTE - nao executado.

## Caso 6: reutilização do cookie revogado

- Preparação: em sessão exclusiva de laboratório, guardar temporariamente o cookie de sessão fora das evidências.
- Pedido enviado: fazer logout e tentar usar novamente o cookie revogado.
- Resultado esperado: `/api/me` responde 401; apagar imediatamente a cópia do cookie.
- Resultado observado: PENDENTE - nao executado.