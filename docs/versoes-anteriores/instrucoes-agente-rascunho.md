# Instruções do agente

Este arquivo é a instrução permanente para qualquer agente de IA que trabalhe neste repositório. Ele é versionado de propósito, porque faz parte da entrega do desafio.

## O que é este projeto

DOC Intelligence, um serviço de inteligência documental que recebe imagens e PDFs enviados pelo atendimento de um escritório, descobre o tipo do documento, extrai os campos que interessam àquele tipo e propõe um nome padronizado.

O enunciado completo está em `desafio/desafio.md`. A leitura dele está em `docs/01-analise-do-problema.md`. A especificação está em `docs/02-especificacao.md`. As decisões estão em `docs/adr/`.

Antes de propor qualquer coisa, leia a análise e a especificação. Elas foram escritas antes do código e valem mais do que a sua intuição sobre o que o projeto deveria fazer.

## Regra de ouro

Nunca invente um fato sobre o ambiente. Os sete fatos que governam este projeto estão listados no enunciado e analisados em `docs/01-analise-do-problema.md`. Se uma decisão precisar de um fato que não está lá, pergunte em vez de assumir.

## Arquitetura

Arquitetura hexagonal, também chamada de portas e adaptadores. A regra de dependência é uma só e não tem exceção.

O domínio, em `src/dominio`, não importa nada de framework. Nem Nest, nem TypeORM, nem BullMQ, nem nada que venha de `node_modules` além de tipos da própria linguagem. Se você precisar importar algo lá dentro, a modelagem está errada.

A aplicação, em `src/aplicacao`, importa o domínio e define as portas. Portas são interfaces. Casos de uso dependem de portas, nunca de implementações concretas.

A aplicação também é livre de framework, e isso é decisão consciente. Os casos de uso são classes comuns, sem decorator, que recebem tudo pelo construtor. Quem faz a ligação entre porta e adaptador são os módulos do Nest na infraestrutura, usando fábrica. O custo é escrever a fábrica à mão, e o ganho é que um caso de uso pode ser instanciado num teste com um `new`, sem subir contexto de teste nenhum.

A infraestrutura, em `src/infraestrutura`, importa a aplicação e implementa as portas. É o único lugar onde Nest, TypeORM, BullMQ, sistema de arquivos e cliente HTTP têm permissão para existir.

Existe um teste automatizado que varre `src/dominio` e `src/aplicacao` procurando importação de framework. Se você quebrar a fronteira, ele falha.

## Convenções de nomenclatura

### Banco de dados

Tabelas e colunas em português. Toda coluna carrega o prefixo formado pelas iniciais do nome da tabela. A tabela `documento` tem `doc_id`, `doc_nome_original`, `doc_criado_em`. A tabela `campo_extraido` tem `cae_id`, `cae_nome`, `cae_valor`.

Chave primária sempre auto incremento. Toda relação sai como chave estrangeira declarada no banco, porque integridade é responsabilidade do banco e não da aplicação.

O mapa completo de prefixos está em `docs/02-especificacao.md`. Ao criar uma tabela nova, registre o prefixo lá.

### Código

Português é o padrão para domínio, casos de uso, portas e nomes de arquivo. O inglês entra onde o vocabulário arquitetural ou o contrato exposto pedem, como em `ConfidencePolicy`, `REVIEW_REQUIRED`, `Port` e `Adapter`.

Sufixos de arquivo do Nest ficam na convenção do framework, como `.controller.ts` e `.module.ts`. O domínio e a aplicação usam sufixos em português, como `.entidade.ts`, `.porta.ts`, `.caso-de-uso.ts` e `.vo.ts`.

Nomes de arquivo em kebab-case.

### Comentários

Toda classe recebe um comentário acima dela, escrito em linguagem humana, dizendo por que ela existe e qual decisão ela carrega. Não é para descrever o que a assinatura já diz. É para explicar a intenção, principalmente quando ela vem de um dos fatos do ambiente.

Um comentário bom se parece com isto:

```ts
/**
 * Guarda o hash do conteúdo do arquivo, e não do nome nem do caminho.
 * O fato (c) do enunciado diz que o mesmo documento chega mais de uma vez,
 * com nome diferente a cada reenvio. Só o conteúdo permanece igual, então
 * é ele que define identidade aqui.
 */
```

Um comentário ruim se parece com isto:

```ts
/** Classe que representa o hash. */
```

## Como escrever texto neste repositório

Escreva em prosa natural, como uma pessoa explicando para outra. Não use travessão nem hífen como pontuação no meio da frase. Use vírgula, ponto, dois pontos ou reescreva a frase.

Isso vale para documentação, comentários, mensagens de commit e mensagens de erro. Nomes de arquivo continuam em kebab-case, porque ali o hífen é separador de código e não pontuação de texto.

Evite listas com marcadores quando um parágrafo resolve. Listas são para enumerações de verdade, como códigos de erro ou passos de execução.

## Commits

Um commit por etapa, na ordem em que o trabalho aconteceu de verdade. O histórico precisa provar que a especificação veio antes do código, porque isso é critério de avaliação.

Formato: `tipo: descricao em minusculas e sem acento`, usando `docs`, `feat`, `chore`, `test`, `fix` ou `refactor`. A descrição diz o que mudou e por quê, em português, sem hífen como pontuação.

Não faça commit de várias etapas juntas. Não amende commit já feito para ficar bonito.

## Registro de prompts

Cada prompt do desenvolvedor vira um arquivo numerado em `prompts/`, com o texto exatamente como foi escrito. Erro de digitação fica. Frase truncada fica. Nada é reescrito depois para parecer mais sofisticado, porque o enunciado pede os prompts na íntegra e em ordem.

Quando o agente errar, o erro vai para `docs/04-onde-o-agente-errou.md` no momento em que acontece, e não reconstruído de memória no fim.

## Antes de dizer que algo está pronto

Rode o lint e os testes. Se não rodou, não está pronto e você não deve afirmar que está.

Se um teste falhar, mostre a saída. Se uma etapa foi pulada, diga qual e por quê. Relatar sucesso sem ter verificado é o pior erro possível neste repositório, porque contamina todas as decisões seguintes.

## O que não fazer

Não amplie o escopo. A fatia vertical implementada é receber, processar, gravar e consultar. Conferência humana, adaptador real de fornecedor, object storage, autenticação real, cifragem em repouso e webhook estão fora, por decisão registrada em `docs/03-escopo-nao-implementado.md`. Se parecer que algo disso deveria entrar, escreva a justificativa e pergunte, não implemente.

Não instale dependência nova sem justificar em ADR o que ela resolve e o que foi descartado no lugar dela.

Não coloque dado pessoal real em lugar nenhum. Os arquivos usados em teste são fictícios e gerados pelo próprio projeto.

Não escreva valor de campo extraído em log, em mensagem de erro ou em resposta de listagem. Isso vem do fato (d) e é a regra de segurança mais fácil de quebrar por descuido.
