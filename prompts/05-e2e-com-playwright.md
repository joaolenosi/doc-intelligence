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

## Prompt 18

```
Percebi que o contrato não está exposto. Quero o Swagger publicado num caminho fixo, não na raiz, e o caminho impresso no log de subida e escrito no README, porque hoje quem sobe o projeto abre localhost:3000 e recebe 404 sem saber para onde ir. A raiz pode continuar em 404 mesmo, não quero rota nem redirecionamento ali.

Junto com isso, quero o arquivo do contrato gerado a partir da própria aplicação por um script, com comando no package.json, e versionado no repositório. São dois motivos: quem for avaliar consegue ler o contrato sem subir nada, e qualquer mudança acidental na forma da resposta aparece como diferença no controle de versão em vez de passar despercebida. Gerado e não escrito à mão, porque contrato escrito à mão diverge do código na terceira alteração.

Tem uma decisão junto que eu prefiro tomar explicitamente. Como o Swagger é montado no nível da aplicação, ele não passa pelo guard global, então a documentação fica aberta por consequência e não por escolha. Me diz se faz sentido deixar assim, considerando que o serviço é interno, e registra a decisão de qualquer forma. O que eu não quero é isso ficar aberto porque ninguém olhou.

Os exemplos da documentação também precisam ser fictícios, pelo mesmo motivo dos arquivos de teste, e o exemplo de nome sugerido entra nessa regra porque ele é montado a partir dos campos extraídos.
```

**Contexto, escrito depois.** O teste `testes/arquitetura/fronteira-de-autenticacao.spec.ts`,
escrito na etapa anterior, afirma que não existe OpenAPI exposta. Ele quebrou
com esta mudança, que é exatamente para o que ele foi escrito: obrigar a decisão
a passar por alguém. A resposta à pergunta virou o ADR-013, e o teste foi
reescrito para verificar a nova regra em vez de ser apagado.
