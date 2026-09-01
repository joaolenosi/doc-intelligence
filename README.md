# DOC Intelligence

Serviço interno que recebe um documento (imagem ou PDF), descobre que tipo ele
é, extrai os campos que interessam àquele tipo e propõe um nome padronizado.
Quando o modelo não tem confiança no que produziu, o documento não entra como
pronto: ele para para conferência humana.

Resposta ao desafio de seleção em [`docs/desafio.md`](docs/desafio.md).
**Trilha A**, back-end. Não há front-end neste repositório.

O modelo multimodal é um **dublê determinístico** nesta entrega, atrás de uma
porta. Trocar por um fornecedor real é escrever outro adaptador.

## Subir o projeto

Precisa de Docker. Nada além disso.

```bash
docker compose up -d --build
```

Sobe quatro serviços: Postgres, Redis, a API e o worker. As migrations rodam
sozinhas na subida da API. Quando a API ficar saudável, o log diz para onde ir:

```json
{"evento":"api_no_ar","porta":3000,"filaAdaptador":"bullmq",
 "modoDoDuble":"SUCESSO","documentacao":"http://localhost:3000/v1/docs"}
```

| Onde | O quê |
|---|---|
| <http://localhost:3000/v1/docs> | contrato navegável, com os campos já preenchidos |
| <http://localhost:3000/healthz> | verifica se o serviço está de pé e enxerga o banco |
| <http://localhost:3000/> | **404 de propósito.** Não existe rota nem redirecionamento na raiz |

A chave de API padrão é `chave-de-desenvolvimento`, e ela já vem preenchida na
documentação para funcionar sem configuração. É valor de desenvolvimento, não
credencial: fora da máquina local, troque `API_KEY`.

Para derrubar tudo, inclusive os volumes: `docker compose down -v`.

## Testar em um minuto

Há arquivos fictícios prontos em [`fixtures/`](fixtures/README.md). Nenhum deles
contém dado real, e há teste que verifica isso.

```bash
# 1. Primeiro envio. Responde 201 na hora, sem esperar o modelo.
curl -i -X POST http://localhost:3000/v1/documentos \
  -H "X-API-Key: chave-de-desenvolvimento" \
  -H "X-Sistema-Origem: crm-atendimento" \
  -F "arquivo=@fixtures/rg-frente.jpeg"
```

Guarde o `id` da resposta. Ele também vem no header `Location`.

```bash
# 2. Consulte até o estado sair de RECEIVED ou PROCESSING.
curl -s http://localhost:3000/v1/documentos/1 \
  -H "X-API-Key: chave-de-desenvolvimento" | python3 -m json.tool
```

A resposta traz o tipo classificado, os campos com a confiança de cada um, o
nome padronizado proposto, e qual modelo e versão de prompt produziram aquilo.

```bash
# 3. Reenvio do mesmo conteúdo, com outro nome e por outro canal.
#    Responde 200, com jaExistia true. O documento não é reprocessado.
curl -i -X POST http://localhost:3000/v1/documentos \
  -H "X-API-Key: chave-de-desenvolvimento" \
  -H "X-Sistema-Origem: portal-balcao" \
  -F "arquivo=@fixtures/rg-reenvio.jpeg"

# 4. Consulte de novo: submissoes.total agora é 2, com dois canais,
#    e processamento.tentativas continua 1. Uma chamada só, dois envios.

# 5. Arquivo com bytes de Word e nome de imagem. Responde 415,
#    porque o tipo sai do conteúdo e nunca do nome.
curl -i -X POST http://localhost:3000/v1/documentos \
  -H "X-API-Key: chave-de-desenvolvimento" \
  -H "X-Sistema-Origem: crm-atendimento" \
  -F "arquivo=@fixtures/rg-que-e-word.jpeg"
```

### Ver os outros caminhos

O dublê tem modos, controlados por `DUBLE_MODO`. Recrie a API e o worker para
trocar:

```bash
# Um campo obrigatório abaixo do limiar: o documento para em REVIEW_REQUIRED
DUBLE_MODO=BAIXA_CONFIANCA docker compose up -d --no-deps api worker

# O fornecedor falha duas vezes e acerta na terceira: exercita a retentativa
DUBLE_MODO=FALHA_TRANSITORIA docker compose up -d --no-deps api worker

# O fornecedor não responde: exercita o timeout de 60s
DUBLE_MODO=TIMEOUT docker compose up -d --no-deps api worker
```

### Trocar o mecanismo de fila, com o Redis fora do ar

A fila está atrás de uma porta e existem **dois adaptadores reais**. Este é o
jeito mais direto de conferir isso:

```bash
FILA_ADAPTADOR=postgres docker compose up -d --no-deps api worker
docker compose stop redis

# O fluxo inteiro continua funcionando. Repita os passos 1 e 2 acima.
docker compose start redis
```

## Rodar os testes

Três suítes, separadas por quanto exigem do ambiente.

```bash
npm install

# 1. Unidade. Não exige nada: nem banco, nem Redis, nem Docker.
npm test

# 2. Integração. Exige só o Postgres.
docker compose up -d postgres
npm run test:integracao

# 3. Ponta a ponta. Exige o ambiente inteiro de pé.
docker compose up -d --build
npm run test:e2e
```

O banco de testes (`doc_intelligence_teste`) é **criado automaticamente** e é
separado do banco da aplicação. A separação não é preciosismo: com o ambiente de
pé, o worker do compose consome a mesma tabela de fila e rouba as linhas que o
teste acabou de inserir. Isso aconteceu aqui, e o sintoma era um teste que
parecia instável.

## O que eu escolhi testar, e por quê

Testei o que custa dinheiro, o que vaza dado pessoal e o que quebra em silêncio.
Não busquei cobertura: cobertura mede quanto código foi executado, e o que me
interessa é se as decisões que eu registrei continuam valendo.

**O que custa dinheiro.** Cada chamada ao modelo é cobrada, então "quantas vezes
o extrator foi chamado" é asserção de negócio e não detalhe de implementação. O
mesmo conteúdo enviado três vezes por canais diferentes cria um documento, um
arquivo e um trabalho, e registra três submissões. Falha transitória gasta
exatamente três chamadas antes de parar em `FAILED`; falha permanente gasta uma.
Documento já terminado, reentregue pela fila, gasta zero.

**O que vaza dado pessoal.** O teste que eu mais gosto pega um erro de banco
carregando `MARIA DA SILVA SOUZA` no `detail` e afirma que nada disso chega ao
log. Existe o mesmo para o nome sugerido, que parece identificador técnico e
carrega nome de pessoa e número de documento. As fixtures são varridas
procurando qualquer número que passe em validação de dígito de CPF.

**O que quebra em silêncio.** Um teste varre o domínio e a aplicação procurando
importação de framework e falha apontando arquivo e linha: regra de arquitetura
sem teste que a defenda dura até o primeiro dia apertado. Outro afirma que só
`/healthz` fica fora da autenticação, porque exceção é barata de acrescentar e
cara de perceber. Outro regera o contrato e compara com o arquivo versionado.

**O caso que sustenta uma decisão inteira.** Um RG com três campos a 0,97 e o
número a 0,40 tem média acima do limiar. O teste afirma que a média passa, e
afirma que mesmo assim o documento para para conferência. É o ADR-007 em oito
linhas: se a confiança fosse agregada, esse documento entraria como pronto com o
número quase certamente errado.

**O que eu não testei.** Carga, e a qualidade da extração sobre foto de verdade.
Os dois estão declarados em [`docs/escopo-nao-implementado.md`](docs/escopo-nao-implementado.md)
com o motivo.

## Por onde ler o repositório

A ordem em que o trabalho aconteceu, que é também a ordem que faz sentido ler:

| Documento | O quê |
|---|---|
| [`docs/analise-requisitos.md`](docs/analise-requisitos.md) | a leitura do problema, escrita antes de qualquer código |
| [`docs/especificacao.md`](docs/especificacao.md) | contrato, estados, modelo de dados, políticas |
| [`docs/arquitetura.md`](docs/arquitetura.md) | módulos, portas, e onde cada fato do ambiente foi tratado |
| [`docs/adr/`](docs/adr/README.md) | as treze decisões, com o que foi descartado e por quê |
| [`docs/escopo-nao-implementado.md`](docs/escopo-nao-implementado.md) | **o que não foi feito**, e como entraria |
| [`docs/uso-de-ia.md`](docs/uso-de-ia.md) | como conduzi o agente, e onde ele errou |
| [`docs/testes-e2e.md`](docs/testes-e2e.md) | o que os testes ponta a ponta provam |
| [`docs/contrato-openapi.json`](docs/contrato-openapi.json) | o contrato, gerado da aplicação, legível sem subir nada |
| [`prompts/`](prompts/README.md) | os prompts, na íntegra e em ordem |
| [`docs/versoes-anteriores/`](docs/versoes-anteriores/README.md) | o estado anterior dos documentos que foram reescritos |

O código segue a mesma divisão do [ADR-002](docs/adr/002-hexagonal-com-aplicacao-livre-de-framework.md):
`src/dominio` não importa framework nenhum, `src/aplicacao` define as portas e
os casos de uso, e `src/infraestrutura` é o único lugar onde Nest, TypeORM,
BullMQ e disco existem.

## Comandos

| Comando | O quê |
|---|---|
| `npm test` | testes de unidade, sem nenhuma infraestrutura |
| `npm run test:integracao` | contra Postgres de verdade |
| `npm run test:e2e` | contra o ambiente do compose, pela rede |
| `npm run contrato:gerar` | regera `docs/contrato-openapi.json` a partir da aplicação |
| `npm run fixtures:gerar` | regera os arquivos de `fixtures/` |
| `npm run migration:run` | aplica as migrations |
| `npm run build` | compila para `dist/` |

## Configuração

Todas as variáveis estão em [`.env.example`](.env.example), com o motivo de cada
número no comentário. As que mais mudam o comportamento:

| Variável | Padrão | O quê |
|---|---|---|
| `FILA_ADAPTADOR` | `bullmq` | `bullmq` ou `postgres`. Os dois são reais |
| `FILA_CONCORRENCIA` | `5` | 800 documentos em 2h, a 40s de pior caso, exigem 4,4 simultâneos |
| `DUBLE_MODO` | `SUCESSO` | `BAIXA_CONFIANCA`, `FALHA_TRANSITORIA`, `TIMEOUT`, `LENTO` |
| `EXTRATOR_TIMEOUT_MS` | `60000` | acima dos 40s de pior caso: timeout curto paga a chamada e joga fora |
| `EXTRATOR_MAX_TENTATIVAS` | `3` | finito porque cada tentativa é cobrada |
| `DOCS_HABILITADO` | `false` | o compose liga. Padrão desligado para não ficar aberto por descuido |

## O que não está implementado

Está tudo em [`docs/escopo-nao-implementado.md`](docs/escopo-nao-implementado.md),
com o que quebra e como entraria. Os principais: a listagem de documentos, a
fila de conferência humana, autenticação real, cifragem em repouso e política de
retenção, conversão de HEIC, e a rotina que reconcilia documentos parados
quando a fila é o BullMQ.
