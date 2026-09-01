# Decisões de arquitetura

Um arquivo por decisão. Só entra aqui o que tem alternativa descartada de
verdade, porque decisão sem alternativa descartada é preferência, e preferência
mora na `docs/arquitetura.md`.

Cada registro diz o que eu decidi, o que eu considerei, por que descartei e o
que a escolha custa. A seção de consequências existe para carregar as ruins
também: um ADR que só lista vantagem não está registrando uma decisão, está
fazendo propaganda dela.

| ADR | Assunto |
|---|---|
| [001](001-trilha-a-e-stack.md) | Trilha A, Node com TypeScript e NestJS |
| [002](002-hexagonal-com-aplicacao-livre-de-framework.md) | Hexagonal com a aplicação livre de framework |
| [003](003-processamento-fora-do-request.md) | Processamento fora do ciclo da requisição |
| [004](004-fila-com-dois-adaptadores.md) | Fila atrás de porta, com dois adaptadores reais |
| [005](005-timeout-e-teto-de-tentativas.md) | Timeout acima do pior caso e teto finito de tentativas |
| [006](006-identidade-pelo-hash-e-submissao-separada.md) | Identidade pelo hash do conteúdo, submissão separada |
| [007](007-campo-extraido-em-tabela-propria.md) | Campo extraído em tabela própria, não em JSONB |
| [008](008-polling-em-vez-de-webhook.md) | Polling em vez de webhook |
| [009](009-migrations-em-sql.md) | Migrations em SQL, `synchronize` desabilitado |
| [010](010-catalogo-de-tipos-em-tabela.md) | Catálogo de tipos de documento em tabela |
| [011](011-processamento-por-tentativa.md) | Uma linha por tentativa, não um contador |
| [012](012-nome-sugerido-e-dado-pessoal.md) | O nome sugerido é dado pessoal |
| [013](013-contrato-exposto-e-versionado.md) | Contrato publicado em rota fixa e versionado |
