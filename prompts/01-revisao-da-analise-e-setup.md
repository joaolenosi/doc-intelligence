# Sessão 01 — revisão da análise de requisitos e setup do repositório

**Data:** 31/08 · **Agente:** Claude Code (Opus 5)
**Resultado:** reescrita de `docs/analise-requisitos.md`, commit inicial,
`CLAUDE.md` e este diretório de prompts.

---

## Prompt 1

```
eu vou fazer esse desafio de uma selecao de entrevist e to comencaod a montar a estretegia. '/Users/joaoleno/Projetos/NEST JS/doc-intelligence/doc-intelligence/docs/desafio.md' entao leia esse arquivo: '/Users/joaoleno/Projetos/NEST JS/doc-intelligence/doc-intelligence/docs/analise-requisitos.md' e vamos corrigir ele deixando ele como se fosse escrito por humano e me diga se dessa forma que eu to fazendo é uma boa estrategia ou nao, de acordo com o desafio.
```

**Contexto, escrito depois.** "Como se fosse escrito por humano" aqui não é
pedido de disfarce, é rejeição de entrega. A versão que a sessão 00 tinha
produzido cobria os sete fatos do ambiente, mas escrevia todos eles na mesma
forma, uma afirmação curta seguida de "por isso considero importante", e
terminava com doze decisões em aberto e nenhuma pergunta. Aquilo não era o meu
raciocínio, era o formato médio de um texto gerado. Mandei reescrever com as
minhas decisões, as minhas contas e as minhas dúvidas. O antes está em
`docs/versoes-anteriores/analise-requisitos-v1.md` e o depois é o arquivo
atual.

## Prompt 2

```
vamos primeiro da commit inicial em portugues, depois vamos criar o claude.md e prompt inicial
```

## Prompt 3

```
'/Users/joaoleno/Projetos/NEST JS/doc-intelligence/doc-intelligence/CLAUDE2.MD' PEGUE OUTRAS ESPECIFICACOES DAQUI CMO TABELA E OUTRAS COISS IMPORTANTES E ADICIONE NO LAUDE
```

**Contexto, escrito depois.** O `CLAUDE2.MD` não era coisa do agente. Era o
rascunho de instruções que eu tinha trazido da sessão 00, com as decisões de
arquitetura hexagonal, padrões de projeto e nomenclatura de banco que eu já
tinha fechado por conta própria. O `CLAUDE.md` que o agente havia escrito no
prompt 2 saiu sem nada disso, porque nesse momento eu ainda não tinha passado
essas instruções. Este prompt é a fusão das duas coisas. O rascunho está em
`docs/versoes-anteriores/instrucoes-agente-rascunho.md`, e o que eu recusei
dele está anotado lá.

## Prompt 4

```
ele veio de uma analise que tinha feito previamente, com minhas ideias de arquitetura, padroes de projeto e nomeclatura de banco, mas como voce escreveu e eu ainda noa havia dito as instrucoes, precisamos refatorar.
```

## Prompt 5

Entrado em modo de planejamento, com `/plan`.

```
Precisamos desenvolver o projeto DOC Intelligence para o desafio descrito em docs/desafio.md.

Escolhi a Trilha A, então vamos desenvolver exclusivamente o backend.

Quero utilizar Node.js com TypeScript e NestJS. Antes de começar a implementar qualquer coisa, quero fazer primeiro o planejamento completo do projeto.

Eu já fiz uma leitura inicial do problema e registrei o que identifiquei em docs/analise-requisitos.md. Leia esse arquivo e também leia o enunciado completo em docs/desafio.md.

Alguns pontos que já percebi:

- o serviço precisa receber imagens e PDFs;
- o processamento será feito por um modelo multimodal externo;
- esse processamento pode levar de 5 a 40 segundos, então acredito que não deve ficar preso à requisição HTTP;
- o fornecedor pode falhar ou não responder;
- cada chamada possui custo;
- o mesmo documento pode chegar mais de uma vez;
- os arquivos enviados não são confiáveis;
- estamos lidando com dados pessoais e dados pessoais sensíveis;
- existe um pico de volume concentrado em algumas horas;
- o modelo e os prompts serão alterados no futuro;
- resultados com baixa confiança precisam ficar em um estado que permita conferência humana posteriormente.

Para a implementação quero manter uma fatia vertical pequena, conforme o próprio desafio sugere:

receber o documento → processar → persistir → consultar o resultado.

A conferência humana deve ser considerada no projeto e na arquitetura, mas não quero implementá-la inicialmente.

Quero que você analise com calma o enunciado e a minha análise inicial e faça o seguinte:

1. Identifique requisitos explícitos que eu possa ter deixado passar.
2. Identifique consequências técnicas dos fatos apresentados no enunciado.
3. Separe claramente requisito, risco, suposição e decisão arquitetural.
4. Aponte qualquer interpretação minha que esteja incorreta ou que não seja sustentada pelo enunciado.
5. Identifique riscos que precisam ser tratados agora e riscos que podem apenas ser documentados para uma itivo da fatia vertical.
7. Identifique as principais decisões arquiteturais que precisamos tomar antes de programar.
8. Para decisões que tenham alternativas relevantes, apresente as opções, vantagens, desvantagens e trade-offs antes de escolher.
9. Pense especialmente em processamento assíncrono, persistência, armazenamento de arquivos, deduplicação, retries, timeout, versionamento do modelo/prompt, estados do documento, segurança e testes.
10. Avalie se a arquitetura permite trocar peças como fornecedor de IA, mecanismo de fila e armazenamento sem alterar as regras centrais da aplicação.

Não quero que você implemente código ainda.

Também não quero adicionar funcionalidades apenas porque seriam interessantes. O desafio deixa claro que uma fatia estreita e bem construída é preferível a várias funcionalidades incompletas.

Se você encontrar decisões importantes que dependam de escolha minha, pare e me faça as perguntas necessárias, preferencialmente apresentando alternativas e explicando as consequências de cada opção.

Nosso objetivo nesta etapa é terminar com um planejamento que depois possa dar origem a:

- docs/especificacao.md
- docs/arquitetura.md
- ADRs para as decisões que realmente justificarem um registro separado
- definição dos testes da fatia vertical

Somente depois de eu revisar e aprovar o planejamento vamos começar a implementação.
```

**Contexto, escrito depois.** O prompt está literal, com o salto do item 5 para o
item 7 e o trecho truncado "para uma itivo da fatia vertical", que era onde eu
estava escrevendo sobre o objetivo da fatia. Não corrigi porque o enunciado pede
os prompts como foram escritos.

O agente respondeu com quatro perguntas de escolha, sobre fila, escopo da fatia,
como o cliente descobre que o processamento terminou, e banco. Minhas respostas
estão registradas no prompt 6 e viraram os ADRs 004, 007, 008 e 009. Nas
respostas eu ampliei o que ele tinha proposto em dois pontos: pedi dois
adaptadores de fila reais em vez de um, e pedi campo extraído em tabela própria
com confiança individual em vez do JSONB que ele sugeria.

## Prompt 6

Respostas às quatro perguntas do agente, ainda em modo de planejamento.

```
BullMQ com Redis. Não é o volume que me convence, porque 150 documentos por dia é pouco. É o pico entre 9h e 11h junto com um fornecedor que leva até 40 segundos e falha de vez em quando. Retentativa com espera crescente e teto de tentativas é o tipo de código que parece pronto no dia em que eu escrevo e só mostra o defeito no dia do pico.

A conta da concorrência: 800 documentos em duas horas dá 0,11 por segundo, vezes 40 segundos de pior caso dá 4,4. Arredondei para cinco e deixei configurável, porque o número real depende do limite de chamadas do fornecedor, que eu não conheço.

A fila fica atrás de uma porta, com o enfileiramento separado do consumo, porque a API só precisa enfileirar e o worker só precisa consumir. Vou escrever dois adaptadores de verdade, um com BullMQ e outro com a tabela do Postgres e SKIP LOCKED, escolhidos por variável de ambiente. Custa manutenção dobrada nessa fronteira e eu aceito o custo, porque adaptador que ninguém implementou é promessa e não demonstração.

Com o BullMQ ligado existe uma janela que prefiro deixar escrita. O estado do documento fica no Postgres e o job fica no Redis, então se o processo cair entre gravar e enfileirar o documento fica parado esperando um worker que nunca vai pegá-lo. A rotina que varre e reenfileira isso não entra nesta fatia, fica na lista do que não implementei com o desenho de como entraria. Com o adaptador Postgres a janela fecha, porque gravar o documento e criar o trabalho cabem na mesma transação
```

```
Fatia atual + nome padronizado
```

```
Polling. O upload responde na hora com o identificador e a situação, 201 no primeiro envio e 200 quando o mesmo conteúdo já existe, e o cliente consulta GET /documentos/{id} até a situação sair de RECEIVED ou PROCESSING. Webhook fica registrado como evolução natural, com o custo real anotado: cadastro de destino, reentrega, assinatura do payload e a garantia de não vazar valor de campo extraído no corpo por causa do fato (d).
```

```
Postgres com TypeORM. Para os campos extraídos, prefiro uma tabela própria, com uma linha por campo e a confiança individual de cada valor, em vez de concentrar tudo em JSONB. Assim, a regra de confiança consegue avaliar cada campo separadamente, evitando que uma média alta esconda um campo importante com baixa confiança.O JSONB fica reservado para informações de auditoria, onde o formato pode variar mais. Para evitar processamento duplicado, o hash do conteúdo do arquivo terá índice único, porque o mesmo documento chega mais de uma vez com nome diferente a cada reenvio e só o conteúdo permanece igual. O reenvio não é tratado como erro, apenas devolve o registro que já existe.O TypeORM fica restrito à infraestrutura. A entidade usada pelo ORM será separada da entidade de domínio, com mapeamento explícito entre elas. O `synchronize` permanece desabilitado e a evolução do banco será controlada por migrations escritas em SQL, inclusive para preservar o padrão de prefixos das colunas exigido pelo projeto.
```
