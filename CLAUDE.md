# CLAUDE.md

Instrução permanente para qualquer agente de IA que trabalhe neste
repositório. É versionado de propósito, porque faz parte da entrega e porque a
banca vai ler daqui com que grau de controle eu conduzo o agente. Se uma regra
deixar de valer, altere a regra, não a contorne.

## O que é este projeto

DOC Intelligence, um serviço de inteligência documental que recebe imagens e
PDFs enviados pelo atendimento de um escritório, descobre o tipo do documento,
extrai os campos que interessam àquele tipo e propõe um nome padronizado.
Documentos em que o modelo não confia param para conferência humana.

É a resposta a um desafio de seleção. O enunciado está em `docs/desafio.md`, e
a distribuição da nota está lá: 30% arquitetura e modularidade, 20%
rastreabilidade das decisões, 20% uso de IA como ferramenta de engenharia, 15%
especificação e método, 15% atenção aos fatos do ambiente. Escrever bem vale
mais do que implementar mais, e isso não é figura de linguagem.

**Escolhi a Trilha A, back-end.** Não existe front-end neste repositório.

Antes de propor qualquer coisa, leia `docs/analise-requisitos.md` e, quando
existir, `docs/especificacao.md`. Elas foram escritas antes do código e valem
mais do que a sua intuição sobre o que o projeto deveria fazer.

## Regra de ouro

Nunca invente um fato sobre o ambiente. Os sete fatos que governam este
projeto estão no enunciado e analisados em `docs/analise-requisitos.md`. Se
uma decisão precisar de um fato que não está lá, pergunte em vez de assumir.

Vale o mesmo para API, biblioteca e comportamento de framework. Se não tiver
certeza, verifique ou diga que não sabe.

## Arquitetura

Arquitetura hexagonal, também chamada de portas e adaptadores. A regra de
dependência é uma só e não tem exceção.

O domínio, em `src/dominio`, não importa nada de framework. Nem Nest, nem
TypeORM, nem BullMQ, nem nada que venha de `node_modules` além de tipos da
própria linguagem. Se você precisar importar algo lá dentro, a modelagem está
errada.

A aplicação, em `src/aplicacao`, importa o domínio e define as portas. Portas
são interfaces. Casos de uso dependem de portas, nunca de implementações
concretas.

A aplicação também é livre de framework, e isso é decisão consciente. Os casos
de uso são classes comuns, sem decorator, que recebem tudo pelo construtor.
Quem liga porta a adaptador são os módulos do Nest na infraestrutura, usando
fábrica. O custo é escrever a fábrica à mão. O ganho é que um caso de uso pode
ser instanciado num teste com um `new`, sem subir contexto de teste nenhum.

A infraestrutura, em `src/infraestrutura`, importa a aplicação e implementa as
portas. É o único lugar onde Nest, TypeORM, BullMQ, sistema de arquivos e
cliente HTTP têm permissão para existir.

Existe um teste automatizado que varre `src/dominio` e `src/aplicacao`
procurando importação de framework. Se você quebrar a fronteira, ele falha.
Esse teste é a prova executável do critério de 30% da nota, então ele não pode
ser afrouxado para fazer outro teste passar.

## O que já está decidido

Não reabra sem eu pedir.

1. Node com TypeScript e NestJS.
2. O processamento não acontece dentro do request de upload. O upload responde
   rápido com um id e um estado, e o modelo roda fora do ciclo da requisição.
3. O núcleo não conhece o fornecedor de IA, fala com uma porta. O dublê da
   fatia vertical é um adaptador como qualquer outro, nunca um `if` de
   ambiente dentro do caso de uso.
4. Todo resultado carrega qual modelo e qual versão de prompt o produziu.
5. Deduplicação pelo hash do conteúdo do arquivo, antes de chamar o modelo.
   Idempotência de requisição é outro problema e tem outro mecanismo.
6. Tipo do arquivo vem da inspeção do conteúdo. Nome, extensão e content-type
   informados pelo cliente são metadado, nunca entrada de decisão.

O que ainda está em aberto está no fim de `docs/analise-requisitos.md`. Se
você precisar de uma dessas decisões para seguir, pare e me pergunte. Não
escolha por mim e não crie um default silencioso.

## Convenções de banco de dados

Tabelas e colunas em português. Toda coluna carrega o prefixo formado pelas
iniciais do nome da tabela. A tabela `documento` tem `doc_id`,
`doc_hash_conteudo`, `doc_criado_em`. A tabela `campo_extraido` tem `cae_id`,
`cae_nome`, `cae_valor`.

Chave primária sempre auto incremento. Toda relação sai como chave estrangeira
declarada no banco, porque integridade é responsabilidade do banco e não da
aplicação.

O mapa completo de prefixos vive em `docs/especificacao.md`. Ao criar uma
tabela nova, registre o prefixo lá antes de criar a migration.

## Convenções de código

Português é o padrão para domínio, casos de uso, portas e nomes de arquivo. O
inglês entra onde o vocabulário arquitetural ou o contrato exposto pedem,
como em `ConfidencePolicy`, `REVIEW_REQUIRED`, `Port` e `Adapter`.

Sufixos de arquivo do Nest seguem a convenção do framework, como
`.controller.ts` e `.module.ts`. Domínio e aplicação usam sufixos em
português, como `.entidade.ts`, `.porta.ts`, `.caso-de-uso.ts` e `.vo.ts`.
Nomes de arquivo em kebab-case.

## Comentários

Toda classe recebe um comentário acima dela, em linguagem humana, dizendo por
que ela existe e qual decisão ela carrega. Não é para descrever o que a
assinatura já diz. É para explicar a intenção, principalmente quando ela vem
de um dos fatos do ambiente. Esses comentários são metade da rastreabilidade
que a banca vai procurar dentro do código.

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

Os documentos daqui são lidos por humanos que estão avaliando como eu penso.
Precisam soar como eu, não como um gerador de texto.

Escreva em prosa natural, como uma pessoa explicando para outra, em português
do Brasil e em primeira pessoa do singular. Não use travessão nem hífen como
pontuação no meio da frase. Use vírgula, ponto, dois pontos ou reescreva a
frase. Isso vale para documentação, comentários, mensagem de commit e mensagem
de erro. Nome de arquivo continua em kebab-case, porque ali o hífen é
separador de código e não pontuação de texto.

Evite lista com marcadores quando um parágrafo resolve. Lista é para
enumeração de verdade, como código de erro, passo de execução ou item de
escopo.

Registre incerteza. Quando uma decisão tiver um lado fraco, escreva o lado
fraco. O enunciado diz com todas as letras que quer ler sobretudo o que eu não
fiz e por quê. Toda decisão relevante vem com a alternativa descartada e o
motivo, porque decisão sem alternativa descartada é preferência.

Fuja do padrão de seção uniforme. Vários blocos com a mesma forma, uma
afirmação curta seguida de "por isso considero importante", é a assinatura
mais óbvia de texto gerado e contamina a leitura do documento inteiro. Cada
assunto recebe o espaço que merece, e assuntos diferentes têm formatos
diferentes.

Nada de superlativo vazio como robusto, escalável ou de ponta. Prefira o
número. Oitocentos documentos em duas horas, a quarenta segundos por chamada
em série, são mais de oito horas de processamento, e essa frase diz mais do
que qualquer adjetivo.

Nunca reescreva um documento antigo para ele parecer que já sabia o que só
ficou claro depois. Divergência entre o que planejei e o que fiz é conteúdo da
entrega, não erro a esconder.

## Commits

Um commit por etapa, na ordem em que o trabalho aconteceu de verdade. O
histórico precisa provar que a especificação veio antes do código, porque isso
é critério de avaliação e porque o enunciado diz explicitamente que não quer
um único commit chamado "initial".

Formato `tipo: descricao em minusculas`, usando `docs`, `feat`, `chore`,
`test`, `fix` ou `refactor`. O corpo explica por que, não o que o diff já
mostra.

Não junte várias etapas num commit só. Não faça amend em commit já feito para
deixar a história bonita. Commits que usaram o agente carregam o trailer
`Co-Authored-By`, e isso é intencional, porque o uso de IA aqui é declarado e
não escondido.

## Registro de prompts

Cada prompt meu vira registro em `prompts/`, numerado em ordem cronológica,
com o texto exatamente como foi escrito. Erro de digitação fica. Frase
truncada fica. Nada é reescrito depois para parecer mais sofisticado, porque o
enunciado pede os prompts na íntegra e em ordem.

Se eu esquecer de registrar um prompt, me lembre antes de seguir para a
próxima tarefa.

Quando você errar e eu te corrigir, o erro vai para `docs/uso-de-ia.md` no
momento em que acontece, e não reconstruído de memória no fim. Esse parágrafo
é item obrigatório da entrega.

## Regras que não se quebram

1. Nenhum dado pessoal real, em lugar nenhum. Nem em fixture, nem em teste,
   nem em exemplo de README, nem em comentário. Todo documento de teste é
   fictício e gerado pelo próprio projeto. Se precisar de um CPF ou RG de
   exemplo, invente um inválido de propósito.
2. Nunca escreva valor de campo extraído em log, em mensagem de erro ou em
   resposta de listagem. Nem o arquivo, nem a resposta crua do modelo. Log
   carrega id, estado, duração e erro. Isso vem do fato (d) e é a regra de
   segurança mais fácil de quebrar por descuido. Se você achar que precisa
   logar conteúdo para depurar, me avise em vez de fazer.
3. Não amplie o escopo. A fatia implementada é receber, validar, persistir,
   enfileirar, processar com o dublê, gravar o resultado e consultar por id.
   Conferência humana, listagem, adaptador real de fornecedor, object storage,
   autenticação real, cifragem em repouso e webhook estão fora por decisão
   registrada. Se parecer que algo disso deveria entrar, escreva a
   justificativa e pergunte, não implemente.
4. Não escreva código antes de a especificação existir. A ordem do trabalho é
   decidir, registrar a decisão, especificar e então implementar.
5. Não instale dependência nova sem justificar em ADR o que ela resolve e o
   que foi descartado no lugar dela.

## Antes de dizer que algo está pronto

Rode o lint e os testes. Se não rodou, não está pronto e você não deve afirmar
que está.

Se um teste falhar, mostre a saída. Se uma etapa foi pulada, diga qual e por
quê. Relatar sucesso sem ter verificado é o pior erro possível neste
repositório, porque contamina todas as decisões seguintes e porque eu vou
assinar embaixo do que você disser.

## Sobre me responder

Se eu pedir algo que contraria uma regra deste arquivo, diga qual regra e
pergunte, em vez de obedecer calado ou recusar. Discorde quando tiver motivo,
porque este é um trabalho avaliado pelo raciocínio e concordância automática
não me ajuda.

## Estrutura do repositório

```
CLAUDE.md                     este arquivo
docs/desafio.md               enunciado recebido, versionado como veio
docs/analise-requisitos.md    leitura do problema, escrita antes do código
docs/especificacao.md         contrato, estados, modelo de dados, prefixos
docs/arquitetura.md           módulos, fronteiras, o que é trocável
docs/escopo-nao-implementado.md   o que ficou de fora e por quê
docs/adr/                     decisões que merecem registro individual
docs/uso-de-ia.md             como conduzi o agente e onde ele errou
prompts/                      prompts na íntegra, em ordem
src/dominio/                  regra de negócio, sem framework
src/aplicacao/                casos de uso e portas, sem framework
src/infraestrutura/           Nest, banco, fila, arquivos, adaptadores
```
