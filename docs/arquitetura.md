# Arquitetura

Complemento da `docs/especificacao.md`. A especificação diz o que o sistema faz.
Este documento diz como ele está montado, o que é trocável e a que custo. As
decisões com alternativa descartada de verdade estão em `docs/adr/`, e aqui eu
descrevo o resultado delas.

## A regra de dependência

Hexagonal, portas e adaptadores, com uma regra só: a dependência aponta sempre
para dentro.

`src/dominio` não importa nada além de tipos da própria linguagem. Nem Nest, nem
TypeORM, nem BullMQ, nem `node_modules`. É onde vivem o documento, a máquina de
estados, a política de confiança e a política de nomenclatura.

`src/aplicacao` importa o domínio e define as portas, que são interfaces. Os
casos de uso dependem de portas e nunca de implementação concreta.

`src/infraestrutura` importa a aplicação e implementa as portas. É o único lugar
onde Nest, TypeORM, BullMQ, disco e cliente HTTP existem.

A aplicação também fica livre de framework, e essa é a parte cara. Os casos de
uso são classes comuns, sem decorator, que recebem tudo pelo construtor, e quem
liga porta a adaptador são fábricas escritas à mão nos módulos do Nest. Aceitei o
custo porque um caso de uso que se instancia com `new` é testável sem subir
contexto de teste, e porque o fato (f) garante que a peça mais funda vai mudar.
O raciocínio completo, com a alternativa descartada, está no ADR-002.

Nada disso vale se ficar só escrito, então existe um teste que varre `dominio` e
`aplicacao` procurando importação de framework e falha se achar. Regra de
arquitetura sem teste que a defenda é comentário.

## Módulos

```
src/
  dominio/
    documento/        entidade, estados, tipos, campo, confiança, políticas
    submissao/        entidade
  aplicacao/
    portas/           as oito interfaces abaixo
    casos-de-uso/     receber, processar, consultar
  infraestrutura/
    http/             controller, DTO de entrada, guard, filtro de erro
    persistencia/     entidades de ORM, mapeadores, repositórios, migrations SQL
    fila/bullmq/      publicador e consumidor
    fila/postgres/    publicador e consumidor com SKIP LOCKED
    ia/duble/         extrator dublê
    ia/prompts/       prompts versionados em arquivo
    armazenamento/    disco
    inspecao/         magic bytes
    config/           configuração tipada, lida uma vez na subida
  main.ts             processo da API
  worker.ts           processo consumidor
```

API e worker são entrypoints separados sobre o mesmo código, os dois subindo no
`docker-compose`. Poderiam ser o mesmo processo, e em desenvolvimento local dá
para rodar assim, mas separá-los é a prova executável de que o processamento não
depende do ciclo da requisição. É uma afirmação que fica fácil de fazer e difícil
de verificar quando tudo roda junto.

## As portas

| Porta | O que abstrai | Adaptador na fatia |
|---|---|---|
| `RepositorioDeDocumento` | persistência do documento | TypeORM sobre Postgres |
| `RepositorioDeSubmissao` | persistência do envio | TypeORM sobre Postgres |
| `ArmazenamentoDeArquivo` | onde o binário mora | disco local |
| `InspetorDeArquivo` | tipo real pelo conteúdo | leitura de magic bytes |
| `CalculadoraDeHash` | identidade do conteúdo | sha-256 |
| `ExtratorDeDocumento` | o modelo multimodal | dublê determinístico |
| `PublicadorDeProcessamento` | enfileirar | BullMQ ou Postgres |
| `Relogio` | tempo | relógio do sistema |

`Relogio` é porta porque a política de nomenclatura usa data e a política de
retry usa tempo, e teste que depende do relógio real é teste que falha sozinho
de madrugada.

Enfileirar e consumir são coisas separadas de propósito. A porta que a aplicação
conhece só sabe publicar, porque a API só precisa publicar. O consumo é iniciativa
da infraestrutura: o worker pega o trabalho e chama o caso de uso. Se a porta
tivesse os dois lados, a aplicação passaria a conhecer o ciclo de vida do
consumidor, que é detalhe de quem entrega a mensagem.

## O fluxo

**Receber.** O controller valida a forma da requisição e entrega o conteúdo ao
caso de uso. Ele inspeciona os bytes, recusa o que não for aceito, calcula o
hash, procura documento com aquele hash e, se achar, registra apenas mais uma
submissão e devolve o documento existente com `200`. Se não achar, grava o
arquivo pelo hash, cria o documento em `RECEIVED`, cria a submissão, publica o
trabalho e devolve `201`. A resposta sai antes de qualquer chamada ao modelo.

**Processar.** O worker consome, move o documento para `PROCESSING`, chama o
extrator com timeout, recebe tipo, campos e confianças, aplica a política de
confiança para decidir entre `PROCESSED` e `REVIEW_REQUIRED`, monta o nome
padronizado, grava campos e resultado com o modelo e a versão de prompt, e
registra o evento de auditoria. Falha transitória incrementa tentativas e volta
para a fila com backoff. Tentativas esgotadas ou falha permanente terminam em
`FAILED`.

**Consultar.** Busca por id e monta a resposta. Campos só saem quando existe
resultado.

## O que é trocável, e o que custa trocar

O fornecedor de IA é a troca mais barata: escrever outro adaptador de
`ExtratorDeDocumento` e mudar a fábrica. O domínio não sabe que ele existe. O
fato (f) diz que o modelo vai trocar de versão, e por isso o resultado carrega
`doc_modelo` e `doc_versao_prompt`: sem eles, quando a extração piorar depois de
uma troca, ninguém consegue provar o que mudou. Os prompts são arquivos
versionados em `infraestrutura/ia/prompts`, com identificador e versão no nome,
para que mudar prompt seja commit e não configuração invisível.

O armazenamento é troca de um adaptador. Trocar disco por object storage muda
`ArmazenamentoDeArquivo` e nada mais, porque o caminho gravado no documento já é
opaco para o domínio.

O banco é a troca mais cara, e não adianta fingir o contrário. As migrations são
SQL e usam recurso de Postgres, então trocar de banco reescreve migrations e o
adaptador de fila que usa `SKIP LOCKED`. O que a arquitetura garante é que o
domínio e os casos de uso não mudam, e não que a mudança seja de graça.

A fila é a troca que eu resolvi demonstrar em vez de prometer, e por isso existem
dois adaptadores de verdade, escolhidos por variável de ambiente. Custa
manutenção dobrada nessa fronteira e eu aceitei o custo, porque a pergunta "o que
acontece quando uma peça precisa ser trocada" tem resposta melhor quando dá para
derrubar o Redis e ver o sistema continuar funcionando.

## A tensão que sobra na fronteira da fila

Vale escrever, porque é o ponto onde a abstração encosta no limite.

Retry, backoff e concorrência são conceitos do mecanismo de entrega, e não do
caso de uso. Deixei os três como configuração do adaptador. O caso de uso sabe
distinguir falha transitória de permanente e sabe que existe um teto de
tentativas, porque isso é regra de negócio ligada a custo, mas não sabe quanto
tempo esperar nem quantos trabalhos rodam em paralelo.

A consequência honesta é que os dois adaptadores não são intercambiáveis em
comportamento fino. O BullMQ conta tentativas do jeito dele e o adaptador de
Postgres conta no `prt_tentativas`. O que o sistema garante igual nos dois é o
teto e o estado final, e o que varia é a curva de espera. Preferi essa
imprecisão a vazar `attemptsMade` para dentro do caso de uso.

Existe também uma janela real no adaptador BullMQ: o estado do documento fica no
Postgres e o job fica no Redis, então uma queda entre gravar o documento e
publicar o trabalho deixa o documento parado em `RECEIVED` esperando um worker
que nunca vai pegá-lo. A rotina que varre `RECEIVED` antigo e republica não está
implementada, está desenhada em `docs/escopo-nao-implementado.md`. Com o
adaptador de Postgres a janela não existe, porque gravar o documento e criar o
trabalho cabem na mesma transação. É o trade-off principal entre os dois, e está
no ADR-004.

## Onde cada fato do ambiente mora

| Fato | Onde foi tratado |
|---|---|
| (a) modelo lento, caro e instável | processamento fora do request, timeout de 60s, teto de 3 tentativas, retry só em falha transitória |
| (b) arquivo não confiável | inspeção por magic bytes, limite de 25 MB, nome derivado do hash, HEIC aceito |
| (c) reenvio | hash com índice único, submissão separada do documento, reenvio devolve `200` |
| (d) dado pessoal sensível | campo extraído isolado em tabela própria, log sem conteúdo com teste, fixtures fictícios |
| (e) pico concentrado | fila absorve o pico, concorrência 5 calculada, upload responde sem esperar o modelo |
| (f) troca de modelo e prompt | porta do extrator, prompts versionados em arquivo, modelo e versão gravados no resultado |
| (g) dois conferentes | `doc_versao` para lock otimista, `SKIP LOCKED` já em uso no adaptador de fila |

Os fatos (b) quanto a HEIC, (d) quanto a cifragem e retenção, e (g) quanto à
fila de conferência estão tratados parcialmente, e a parte que ficou fora está
escrita como fora em `docs/escopo-nao-implementado.md`, com o desenho de como
entraria.
