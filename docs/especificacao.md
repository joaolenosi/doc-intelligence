# Especificação

Escrita antes do código. Se a implementação divergir daqui, a divergência é
registrada em `docs/divergencias.md` e este arquivo não é reescrito para
esconder que divergiu.

Vale para a fatia vertical implementada: receber, validar, persistir,
enfileirar, processar com o dublê, gravar o resultado com o nome padronizado
proposto e consultar por identificador. O que ficou fora está em
`docs/escopo-nao-implementado.md`, com o desenho de como entraria.

## Vocabulário

**Documento** é um conteúdo, identificado pelo hash do que foi enviado. Dois
envios do mesmo arquivo são o mesmo documento.

**Submissão** é um envio. O mesmo documento pode ter várias submissões, cada uma
com o nome que a pessoa deu ao arquivo, de onde veio e quando chegou. Essa
separação existe por causa do fato (c): o cliente reenvia por insegurança e o
atendimento reenvia por precaução, e eu quero registrar que chegou três vezes
sem ter pago três vezes.

**Campo extraído** é um par de nome e valor que o modelo tirou do documento,
sempre com a confiança daquele valor específico.

**Extrator** é a fronteira com o modelo multimodal. Na fatia é um dublê.

## Contrato HTTP

Prefixo `/v1`. O versionamento está no caminho desde o primeiro dia porque o
fato (f) diz que o modelo e os prompts vão mudar, e mudança de modelo pode
mudar a forma do resultado.

Todas as rotas exigem o header `X-API-Key`. Não é segurança de verdade, é a
fronteira de autenticação existindo no lugar certo. O comportamento 5 do
produto diz que o serviço é consumido por sistemas internos e não por navegador
anônimo, e uma API sem nenhuma fronteira seria um desenho que assume o
contrário.

### `POST /v1/documentos`

Recebe um documento. `multipart/form-data`, campo `arquivo`.

| Header | Obrigatório | Para quê |
|---|---|---|
| `X-API-Key` | sim | fronteira de autenticação |
| `Idempotency-Key` | não | mesma requisição repetida por timeout de rede não cria duas submissões |
| `X-Origem` | não | qual sistema interno enviou, para rastreio |

Responde `201` no primeiro envio de um conteúdo e `200` quando aquele hash já
existe, devolvendo nos dois casos o mesmo formato. O reenvio não é erro, é o
comportamento esperado do fato (c), então devolver `409` seria mentir sobre o
que aconteceu.

```json
{
  "id": 42,
  "estado": "RECEIVED",
  "hashConteudo": "9f86d081...",
  "tipoMidia": "image/jpeg",
  "tamanhoBytes": 2481003,
  "criadoEm": "2026-08-31T12:04:11.221Z",
  "submissaoId": 87
}
```

Erros:

| Código | Quando |
|---|---|
| `400` | campo `arquivo` ausente ou corpo malformado |
| `401` | `X-API-Key` ausente ou inválida |
| `413` | arquivo acima de 25 MB |
| `415` | conteúdo não é um dos tipos aceitos, decidido por inspeção e não pelo que o cliente informou |
| `500` | falha interna, sem detalhe no corpo |

O limite de 25 MB vem do fato (b): quem envia manda a foto original da câmera, e
foto de celular atual fica entre 3 e 12 MB, com scans de PDF chegando mais alto.
25 MB acomoda o caso real com folga e ainda recusa upload absurdo antes de gastar
disco.

### `GET /v1/documentos/{id}`

```json
{
  "id": 42,
  "estado": "PROCESSED",
  "tipoDocumento": "RG",
  "confiancaTipo": 0.94,
  "nomePadronizado": "RG_MARIA_DA_SILVA_123456789_2026-08-31.jpg",
  "campos": [
    { "nome": "nome", "valor": "MARIA DA SILVA", "confianca": 0.96, "origem": "MODELO" }
  ],
  "modelo": "duble-deterministico-1",
  "versaoPrompt": "extracao-rg.v1",
  "tentativas": 1,
  "erro": null,
  "criadoEm": "2026-08-31T12:04:11.221Z",
  "processadoEm": "2026-08-31T12:04:29.884Z"
}
```

`campos` só aparece preenchido quando o estado é `PROCESSED` ou
`REVIEW_REQUIRED`. Em `RECEIVED`, `PROCESSING`, `FAILED` e `REJECTED` ele vem
vazio, porque não existe resultado. `404` quando o id não existe.

`modelo` e `versaoPrompt` estão na resposta de propósito, e não só no banco. O
fato (f) diz que o modelo vai trocar de versão e os prompts vão mudar mais de
uma vez no primeiro ano. Quando o resultado piorar depois de uma troca, quem
consome precisa conseguir apontar o que mudou sem depender de acesso ao banco.

### `GET /healthz`

Responde `200` com o estado da conexão com o banco. Existe para o README ter
como dizer "subiu".

## Estados

Os valores são contrato exposto, por isso ficam em inglês, conforme o
`CLAUDE.md`.

| Estado | Significado |
|---|---|
| `RECEIVED` | recebido e persistido, aguardando processamento |
| `PROCESSING` | worker pegou o trabalho |
| `PROCESSED` | extração concluída e acima dos limiares |
| `REVIEW_REQUIRED` | extração concluída, mas abaixo de algum limiar |
| `FAILED` | tentativas esgotadas ou falha permanente do extrator |
| `REJECTED` | reprovado na validação, nenhuma chamada foi paga |

Transições válidas, e só estas:

| De | Para | Quando |
|---|---|---|
| `RECEIVED` | `REJECTED` | validação falhou |
| `RECEIVED` | `PROCESSING` | worker iniciou |
| `PROCESSING` | `PROCESSED` | resultado acima dos limiares |
| `PROCESSING` | `REVIEW_REQUIRED` | resultado abaixo de algum limiar |
| `PROCESSING` | `PROCESSING` | falha transitória, contador de tentativas sobe |
| `PROCESSING` | `FAILED` | tentativas esgotadas, ou falha permanente |

`REVIEW_REQUIRED` é o estado que atende o comportamento 4 do produto: quando a
máquina não tem confiança, o documento não entra como pronto. Ele é terminal
nesta fatia e deixa de ser quando a conferência humana existir, com `IN_REVIEW`
entrando entre ele e `PROCESSED`. Deixo o estado no contrato desde agora para
que quem consome já saiba que "processado" e "pronto" não são a mesma coisa.

A máquina de transições vive no domínio e recusa qualquer par que não esteja na
tabela acima. Estado inválido não é conserto de bug depois, é erro na hora.

## Política de confiança

O extrator devolve uma confiança para o tipo do documento e uma confiança para
cada campo. A política decide o estado final.

O documento vai para `REVIEW_REQUIRED` quando a confiança do tipo for menor que
`0,80`, ou quando qualquer campo obrigatório daquele tipo tiver confiança menor
que `0,85`, ou quando um campo obrigatório não vier. Caso contrário vai para
`PROCESSED`.

Os dois números são chute. Não tenho dado real para calibrá-los, e escrever isso
aqui é mais útil do que fingir que vieram de algum lugar. Eles são configuração,
não constante no código, e a política é objeto de domínio isolado justamente
para o limiar mudar sem encostar no caso de uso.

A regra é por campo, e não pela média, porque média esconde. Um RG com nome,
filiação e data de nascimento a `0,97` e o número do documento a `0,40` tem média
alta e é exatamente o caso que precisa de olho humano. É por isso que o campo
extraído mora numa tabela própria com a confiança individual, e não num JSONB
único.

## Tipos de documento e campos obrigatórios

Lista fechada nesta fatia. Tipo que o extrator devolver fora dela é tratado como
`DESCONHECIDO` e o documento vai para `REVIEW_REQUIRED`, porque tipo que o
sistema não conhece é precisamente o caso em que ele não deveria decidir
sozinho.

| Tipo | Campos obrigatórios |
|---|---|
| `RG` | `nome`, `filiacao`, `dataNascimento`, `numero`, `orgaoEmissor` |
| `CPF` | `nome`, `numero` |
| `COMPROVANTE_RESIDENCIA` | `titular`, `endereco`, `dataReferencia` |
| `CONTRACHEQUE` | `nome`, `competencia`, `valorLiquido` |
| `DESCONHECIDO` | nenhum |

Os campos do `RG` são os que o próprio enunciado cita. Os outros três tipos
saem dos exemplos do cenário. Se existe uma lista fechada de tipos que
interessam ao escritório, ela substitui esta, e essa é uma das perguntas que
mandei por e-mail.

## Nome padronizado

Formato `{TIPO}_{TITULAR}_{IDENTIFICADOR}_{AAAA-MM-DD}.{extensao}`, por exemplo
`RG_MARIA_DA_SILVA_123456789_2026-08-31.jpg`.

O titular vira ASCII maiúsculo sem acento, com `_` no lugar de espaço e corte em
40 caracteres. Segmento cujo campo não veio é omitido inteiro, sem deixar
separador solto, e o resultado continua válido em qualquer sistema de arquivos.
A data é a de referência do documento quando o tipo tem uma, e a de
processamento quando não tem. A extensão vem do tipo de mídia detectado, nunca
da que o cliente mandou.

O nome nunca deriva do nome enviado. O fato (b) diz que o arquivo chega como
"WhatsApp Image 2026-08-11 at 09.12.33.jpeg", e usar isso como base seria
propagar o problema que o serviço existe para resolver. Também é o que impede
path traversal por nome de arquivo.

É uma proposta, e só. O serviço devolve `nomePadronizado` no resultado e não
renomeia nada: no disco o arquivo continua guardado pelo hash. Quem decide
adotar o nome é o sistema que consome, e num documento que ainda vai passar por
conferência humana o nome pode mudar depois da correção.

## Modelo de dados

Tabela e coluna em português. Toda coluna leva o prefixo formado pelas iniciais
do nome da tabela. Chave primária auto incremento, relação sempre com chave
estrangeira declarada no banco. `synchronize` desabilitado, evolução por
migration escrita em SQL.

Mapa de prefixos:

| Tabela | Prefixo |
|---|---|
| `documento` | `doc` |
| `submissao` | `sub` |
| `campo_extraido` | `cae` |
| `processamento_trabalho` | `prt` |
| `evento_auditoria` | `eva` |

### `documento`

| Coluna | Tipo | Observação |
|---|---|---|
| `doc_id` | `BIGSERIAL` | PK |
| `doc_hash_conteudo` | `VARCHAR(64)` | sha-256 em hex, `UNIQUE`, é a identidade |
| `doc_tamanho_bytes` | `BIGINT` | |
| `doc_tipo_midia` | `VARCHAR(100)` | detectado por inspeção, nunca o informado |
| `doc_extensao` | `VARCHAR(10)` | derivada do tipo detectado |
| `doc_caminho_armazenamento` | `TEXT` | caminho relativo, pelo hash |
| `doc_estado` | `VARCHAR(30)` | |
| `doc_tipo_documento` | `VARCHAR(50)` | nulo até processar |
| `doc_confianca_tipo` | `NUMERIC(4,3)` | nulo até processar |
| `doc_nome_padronizado` | `TEXT` | nulo até processar |
| `doc_tentativas` | `SMALLINT` | quantas chamadas ao extrator já foram pagas |
| `doc_erro_codigo` | `VARCHAR(50)` | |
| `doc_erro_mensagem` | `TEXT` | técnica, nunca conteúdo do documento |
| `doc_modelo` | `VARCHAR(100)` | qual modelo produziu o resultado |
| `doc_versao_prompt` | `VARCHAR(50)` | qual versão de prompt produziu o resultado |
| `doc_versao` | `SMALLINT` | lock otimista, prepara o fato (g) |
| `doc_criado_em` | `TIMESTAMPTZ` | |
| `doc_atualizado_em` | `TIMESTAMPTZ` | |
| `doc_processado_em` | `TIMESTAMPTZ` | |

Índice único em `doc_hash_conteudo`, que é o que faz a deduplicação ser garantia
do banco e não torcida da aplicação. Índice em `(doc_estado, doc_criado_em)`,
que serve tanto para a reconciliação de documentos travados quanto para a fila
de conferência quando ela existir.

`doc_tentativas` está aqui, e não só na fila, porque é a coluna que responde
quanto dinheiro aquele documento já custou. Cada chamada é cobrada, então isso é
informação de negócio.

`doc_versao` não é usado nesta fatia. Ele existe porque o fato (g) diz que duas
pessoas podem abrir a fila ao mesmo tempo, e adicionar controle de concorrência
depois, numa tabela que já tem dados, é caro. Uma coluna vazia agora é barata.

### `submissao`

| Coluna | Tipo | Observação |
|---|---|---|
| `sub_id` | `BIGSERIAL` | PK |
| `sub_doc_id` | `BIGINT` | FK para `documento` |
| `sub_nome_original` | `TEXT` | como veio, guardado só para rastreio |
| `sub_tipo_midia_informado` | `VARCHAR(100)` | o que o cliente disse, para comparar com o real |
| `sub_origem` | `VARCHAR(50)` | qual sistema interno enviou |
| `sub_chave_idempotencia` | `VARCHAR(100)` | `UNIQUE` quando não nulo |
| `sub_criado_em` | `TIMESTAMPTZ` | |

Guardo `sub_tipo_midia_informado` ao lado de `doc_tipo_midia` de propósito. A
diferença entre os dois é a medida de quanto o cliente erra, e o fato (b) diz
que não há validação nenhuma do lado de quem envia.

### `campo_extraido`

| Coluna | Tipo | Observação |
|---|---|---|
| `cae_id` | `BIGSERIAL` | PK |
| `cae_doc_id` | `BIGINT` | FK para `documento` |
| `cae_nome` | `VARCHAR(60)` | |
| `cae_valor` | `TEXT` | dado pessoal, às vezes sensível |
| `cae_confianca` | `NUMERIC(4,3)` | por campo, não por documento |
| `cae_origem` | `VARCHAR(20)` | `MODELO` ou `CORRECAO_HUMANA` |
| `cae_criado_em` | `TIMESTAMPTZ` | |

Único em `(cae_doc_id, cae_nome)`. `cae_origem` já existe porque o comportamento
4 termina em "a pessoa conferente corrige o que a máquina errou", e depois da
correção ninguém vai lembrar qual valor veio do modelo e qual veio da pessoa se
a coluna não estiver lá.

Esta é a tabela que concentra o dado pessoal do fato (d). É a única do sistema
cujo conteúdo nunca pode aparecer em log, em mensagem de erro ou em resposta que
não seja a consulta por identificador.

### `processamento_trabalho`

Só existe quando o adaptador de fila é o de Postgres.

| Coluna | Tipo | Observação |
|---|---|---|
| `prt_id` | `BIGSERIAL` | PK |
| `prt_doc_id` | `BIGINT` | FK para `documento` |
| `prt_estado` | `VARCHAR(20)` | `PENDENTE`, `EM_EXECUCAO`, `CONCLUIDO`, `FALHOU` |
| `prt_tentativas` | `SMALLINT` | |
| `prt_disponivel_em` | `TIMESTAMPTZ` | é o backoff, o consumo só pega o que já venceu |
| `prt_bloqueado_em` | `TIMESTAMPTZ` | detecta worker que morreu segurando trabalho |
| `prt_criado_em` | `TIMESTAMPTZ` | |
| `prt_atualizado_em` | `TIMESTAMPTZ` | |

Índice em `(prt_estado, prt_disponivel_em)`. O consumo é
`SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1`, que é o mesmo mecanismo que resolve
o fato (g) mais tarde. Implementá-lo aqui é conveniente: a fila de conferência
depois reusa o padrão em vez de inventar outro.

### `evento_auditoria`

| Coluna | Tipo | Observação |
|---|---|---|
| `eva_id` | `BIGSERIAL` | PK |
| `eva_doc_id` | `BIGINT` | FK, nulo permitido |
| `eva_tipo` | `VARCHAR(50)` | |
| `eva_dados` | `JSONB` | formato varia por tipo de evento |
| `eva_criado_em` | `TIMESTAMPTZ` | |

É o único lugar com JSONB, porque é o único lugar onde o formato varia de
verdade. `eva_dados` nunca recebe valor de campo extraído: registra que a
extração aconteceu, quanto demorou, qual modelo, qual versão de prompt e quantos
campos vieram, não o que estava escrito no documento.

## Extrator e o dublê

A porta recebe o conteúdo e o tipo de mídia e devolve tipo do documento,
confiança do tipo, lista de campos com confiança, identificação do modelo e
versão do prompt. Ou levanta `FalhaTransitoriaDoExtrator` ou
`FalhaPermanenteDoExtrator`. O caso de uso não conhece HTTP, status code nem
formato de resposta do fornecedor: classificar erro é trabalho do adaptador.

O dublê é determinístico, derivando a resposta do hash do conteúdo, o que o
enunciado autoriza ao dizer que o modelo pode ser um dublê que devolve sempre a
mesma resposta. Ele tem modos, escolhidos por `DUBLE_MODO`:

| Modo | Para quê |
|---|---|
| `SUCESSO` | padrão, campos com confiança alta |
| `BAIXA_CONFIANCA` | exercita `REVIEW_REQUIRED`, comportamento 4 |
| `FALHA_TRANSITORIA` | exercita retry e o teto de tentativas, fato (a) |
| `TIMEOUT` | exercita o timeout, fato (a) |
| `LENTO` | dorme entre 5 e 40s, exercita a concorrência, fatos (a) e (e) |

Os modos custam um `switch` e são o que permite demonstrar os fatos do ambiente
sem fornecedor real. Um dublê que só acerta provaria muito menos.

## Timeout, tentativas e custo

Timeout de `60s` por chamada. O fato (a) diz que a chamada leva entre 5 e 40
segundos, então qualquer timeout abaixo de 40 paga a chamada e joga a resposta
fora. Timeout curto não economiza dinheiro, gasta. Quem protege contra lentidão
é a concorrência limitada, não o relógio.

Três tentativas no total, com backoff exponencial e jitter, aproximadamente 2s e
8s. O teto é finito porque cada tentativa é cobrada: retry sem limite num pico é
uma fatura, não resiliência.

Só falha transitória é retentada, ou seja timeout, erro de rede e `5xx`. Erro
permanente, resposta malformada e recusa do fornecedor vão direto para `FAILED`,
porque repetir o que já falhou por motivo determinístico só multiplica o custo.

Concorrência padrão de `5`, configurável. Vem da conta: o pico do fato (e) são
800 documentos em 2 horas, que dá `0,11` por segundo, e a `40s` de pior caso são
`0,11 x 40 = 4,4` execuções simultâneas para o pico drenar dentro da janela.
Arredondei para 5. O número real depende do limite de chamadas do fornecedor,
que eu não conheço e perguntei por e-mail.

## Validação de entrada

O fato (b) diz que não existe validação nenhuma do lado de quem envia, então
tudo que chega é suspeito.

O tipo de mídia sai da inspeção dos primeiros bytes do arquivo. Nome, extensão e
`Content-Type` informados são metadado, guardados para rastreio, e não entram em
nenhuma decisão. Um `.pdf` com bytes de JPEG é tratado como JPEG, e um binário
renomeado é recusado com `415` antes de custar uma chamada.

Aceitos: `image/jpeg`, `image/png`, `image/heic`, `image/heif` e
`application/pdf`. HEIC e HEIF estão na lista porque o fato (b) diz "a foto
original da câmera", e a foto original de iPhone é HEIC, não JPEG. Recusar o
formato mais comum do público-alvo seria um serviço que não funciona para quem
ele foi feito. A conversão de HEIC e a normalização de orientação por EXIF não
estão implementadas e estão registradas como risco.

Limite de 25 MB, verificado durante o recebimento e não depois de gravar.

## Segurança e dado pessoal

O fato (d) diz que o conteúdo é dado pessoal e parte dele é sensível. Isso muda
log, armazenamento e teste.

Log estruturado carrega id do documento, estado, duração, tentativa e código de
erro. Nunca carrega valor de campo extraído, conteúdo do arquivo, corpo do
multipart ou resposta crua do extrator. É a regra mais fácil de quebrar por
descuido, então tem teste.

O arquivo é gravado em `storage/`, fora do controle de versão, com o nome
derivado do hash e a extensão do tipo detectado. O nome enviado pelo cliente
nunca toca o sistema de arquivos.

Autenticação é uma chave estática comparada em tempo constante. Está declarada
como fronteira, não como segurança. O mecanismo real para tráfego entre sistemas
internos seria mTLS ou OAuth2 client credentials, e está registrado como não
implementado por decisão, já que o enunciado dispensa autenticação real.

Nenhum documento real em lugar nenhum. Os arquivos de teste são fictícios e
gerados por um script do próprio projeto, e os identificadores que aparecem
neles são inválidos de propósito.
