# Sessão 05 — testes ponta a ponta com Playwright

**Data:** 01/09 · **Agente:** Claude Code (Opus 5)

---

## Prompt 17

```
agora vamos instalar o mcp do playwright e criar os testes end to end e documentar os resultados e auto se corrija nos eventuais erros encontrados e documente o prompt e nao esqueca de ir dando commit e push
```

**Contexto, escrito depois.** O agente apontou uma coisa antes de executar: este
é um projeto de Trilha A, sem interface, então a parte de automação de navegador
do Playwright não tem alvo. O que aproveita aqui é o executor de testes de API
do Playwright, que faz chamadas HTTP de verdade contra o ambiente subido no
Docker, e não contra a aplicação em processo como o Supertest.

Isso é diferente e vale: o Supertest sobe o Nest dentro do Jest e nunca prova
que o container sobe, que o worker separado consome, nem que a rede entre eles
funciona. O Playwright bate na porta 3000 do compose e espera o worker de
verdade processar.

O servidor MCP ficou configurado e versionado em `.mcp.json`, porque o enunciado
pede os servidores MCP configurados dentro do repositório. Isso mudou o que o
`docs/uso-de-ia.md` dizia sobre eu não ter configurado nenhum, e o documento foi
corrigido.
