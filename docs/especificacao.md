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
| `X-Sistema-Origem` | sim | qual sistema interno enviou, e por qual canal o documento chegou |
| `Idempotency-Key` | não | mesma requisição repetida por timeout de rede não cria duas submissões |

A unicidade da chave de idempotência é por par `(sistema de origem, chave)`, e
só quando a chave vem preenchida. Chave única global seria errado aqui: dois
sistemas internos geram identificador sem nenhuma coordenação entre si, e uma
colisão acidental faria um deles descartar silenciosamente o envio do outro. É
o que torna `X-Sistema-Origem` obrigatório e não opcional.

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
  "motivosRevisao": [],
  "campos": [
    { "nome": "nome", "valor": "MARIA DA SILVA", "confianca": 0.96, "origem": "MODELO" }
  ],
  "submissoes": {
    "total": 3,
    "canais": ["crm-atendimento", "portal-balcao"],
    "nomeOriginalMaisRecente": "WhatsApp Image 2026-08-11 at 09.12.33.jpeg"
  },
  "processamento": {
    "tentativas": 2,
    "provedor": "duble",
    "modelo": "duble-deterministico-1",
    "versaoPrompt": "extracao-rg.v1",
    "erro": null
  },
  "criadoEm": "2026-08-31T12:04:11.221Z",
  "processadoEm": "2026-08-31T12:04:29.884Z"
}
```

`campos` só aparece preenchido quando o estado é `PROCESSED` ou
`REVIEW_REQUIRED`. Em `RECEIVED`, `PROCESSING`, `FAILED` e `REJECTED` ele vem
vazio, porque não existe resultado. `404` quando o id não existe.

`motivosRevisao` vem vazio em `PROCESSED` e traz os códigos da tabela de motivos
quando o estado é `REVIEW_REQUIRED`. Quem consome precisa saber por que o
documento parou, e "confiança baixa" e "faltou o número da identidade" levam a
conferências diferentes. São códigos e nomes de campo, nunca valores.

O bloco `submissoes` existe porque o nome original e a origem pertencem à
submissão, e não ao documento. `nomeOriginalMaisRecente` é o nome da submissão
mais recente, `total` é quantas vezes aquele conteúdo chegou e `canais` são os
sistemas por onde ele chegou, sem repetição. É a resposta direta ao fato (c):
sem esses três campos, quem consome não consegue distinguir um documento que
chegou uma vez de outro que chegou cinco.

O bloco `processamento` é montado a partir da última tentativa registrada na
tabela `processamento`, e não de colunas do documento. `tentativas` é a
contagem de tentativas daquele documento, que é quanto ele custou em chamadas.
`erro` traz código e mensagem técnica da última tentativa quando o estado é
`FAILED`, e é nulo nos demais.

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

Lista fechada, mantida na tabela `tipo_documento` e não em constante no código.
Cada tipo guarda o código, o nome legível, o template do nome padronizado e a
lista de campos obrigatórios daquele tipo.

Os dois últimos são o motivo de a tabela existir. O padrão de nomes do
escritório é decisão de negócio e muda sem aviso, e a lista de campos
obrigatórios é o que permite exigir conferência de uma identidade sem número
sem exigir o mesmo de um contrato. Nenhuma das duas coisas deveria precisar de
deploy para mudar.

O domínio continua dono da regra: a política de confiança sabe comparar
confiança com limiar e a política de nomenclatura sabe montar e sanitizar o
nome. O que vem do catálogo são os parâmetros, carregados e entregues às
políticas como dados. O raciocínio está no ADR-010.

Conteúdo inicial do catálogo:

| Código | Campos obrigatórios |
|---|---|
| `RG` | `nome`, `filiacao`, `dataNascimento`, `numero`, `orgaoEmissor` |
| `CPF` | `nome`, `numero` |
| `COMPROVANTE_RESIDENCIA` | `titular`, `endereco`, `dataReferencia` |
| `CONTRACHEQUE` | `nome`, `competencia`, `valorLiquido` |
| `DESCONHECIDO` | nenhum |

Os campos do `RG` são os que o próprio enunciado cita. Os outros três saem dos
exemplos do cenário. Se existe uma lista fechada de tipos que interessam ao
escritório, ela substitui esta, e essa é uma das perguntas que mandei por
e-mail. Trocá-la passa a ser uma linha de SQL, e não um deploy.

`doc_tipo_documento` é chave estrangeira para o catálogo, então o banco impõe a
lista fechada. Tipo que o extrator devolver fora dela vira `DESCONHECIDO`, que
existe como linha e sem campos obrigatórios, e o documento vai para
`REVIEW_REQUIRED`, porque tipo que o sistema não conhece é precisamente o caso
em que ele não deveria decidir sozinho.

## Nome padronizado

O formato de cada tipo vem de `tpd_template_nome`, no catálogo, e não de
constante no código. Para o `RG` o template é
`{tipo}_{nome}_{numero}_{data}.{extensao}`, que produz
`RG_MARIA_DA_SILVA_123456789_2026-08-31.jpg`.

O nome nunca deriva do nome enviado. O fato (b) diz que o arquivo chega como
"WhatsApp Image 2026-08-11 at 09.12.33.jpeg", e usar isso como base seria
propagar o problema que o serviço existe para resolver. Também é o que impede
path traversal por nome de arquivo.

É uma proposta, e só. O serviço devolve `nomePadronizado` no resultado e não
renomeia nada: no disco o arquivo continua guardado pela chave de
armazenamento. Quem decide adotar o nome é o sistema que consome, e num
documento que ainda vai passar por conferência humana o nome pode mudar depois
da correção.

### Marcadores válidos

Três são embutidos: `{tipo}` é o código do tipo, `{data}` é a data de
referência do documento quando aquele tipo tem uma e a de processamento quando
não tem, e `{extensao}` vem do tipo de mídia detectado.

Qualquer outro marcador é o nome de um campo extraído, e **só pode ser um dos
campos obrigatórios daquele tipo**. Essa restrição não é burocracia: um template
que referencie campo opcional produziria nome incompleto como comportamento
rotineiro, e o nome incompleto é exatamente o que se quer evitar. Amarrar o
template aos obrigatórios faz as duas regras nunca discordarem.

Um template que use marcador fora dessas duas categorias é **erro de
configuração do catálogo**, não erro do documento. Ele é detectado quando o tipo
é carregado, e o tratamento é deliberado: o serviço registra o erro em nível de
erro no log, dizendo qual tipo e qual marcador, e o documento daquele tipo vai
para `REVIEW_REQUIRED` com motivo `CATALOGO_INVALIDO`.

O serviço **não** recusa subir por causa disso. Uma linha malformada no catálogo
derrubaria o serviço inteiro, incluindo os tipos que estão corretos, e o
catálogo existe justamente para ser editado por quem não faz deploy. Falhar
alto e continuar de pé é a resposta certa aqui. Nome de marcador é nome de
campo, e não valor de campo, então pode aparecer no log sem ferir o fato (d).

### Normalização do valor

Os campos vêm de extração sobre foto, então chegam com acento, espaço duplo,
quebra de linha e caractere que não pode compor nome de arquivo. A regra é
explícita, aplicada a cada valor antes de ele entrar no nome, e tem teste:

1. normalizar em `NFD` e remover os sinais diacríticos, de modo que `João` vire
   `Joao`;
2. passar para maiúsculas;
3. trocar qualquer sequência de espaço, tabulação ou quebra de linha por um `_`;
4. descartar todo caractere fora de `A-Z`, `0-9`, `_` e `-`;
5. colapsar sequências de `_` em um só;
6. remover `_` do começo e do fim;
7. truncar em 40 caracteres e remover de novo o `_` que a truncagem possa ter
   deixado no fim.

O hífen sobrevive de propósito, porque `{data}` produz `2026-08-31` e
`competencia` costuma vir como `2026-07`.

Se o resultado da normalização for vazio, e isso acontece quando o modelo
devolve só pontuação ou um caractere que não sobrevive à regra, o marcador conta
como **sem valor**, e cai no caso abaixo. Valor que não é representável é
equivalente a valor que não veio.

O nome inteiro é truncado em 200 caracteres, com folga sobre o limite de 255 de
sistema de arquivos, para o caso de um tipo com muitos marcadores.

### Quando falta valor para um marcador

O documento vai para `REVIEW_REQUIRED`, `doc_nome_sugerido` fica nulo e o motivo
é registrado dizendo **qual marcador ficou sem valor**.

Não gerar nome incompleto e não interromper o processamento é deliberado. Um
nome com buraco seria adotado por quem consome sem ninguém notar, e uma
interrupção jogaria fora uma extração já paga, que na maior parte das vezes está
correta em todos os outros campos.

Na prática esse caso quase sempre coincide com o da política de confiança, já
que o marcador só pode ser campo obrigatório e campo obrigatório ausente já leva
a `REVIEW_REQUIRED`. A coincidência é boa: as duas regras chegam à mesma
conclusão por caminhos diferentes. Ele aparece sozinho quando o campo veio, com
confiança alta, e o valor não sobreviveu à normalização.

Os motivos ficam em `doc_motivos_revisao`, um vetor de texto, e aparecem no
`GET` como `motivosRevisao`. São códigos e nomes de campo, nunca valor.

| Motivo | Quando |
|---|---|
| `CONFIANCA_TIPO_BAIXA` | confiança do tipo abaixo do limiar |
| `CONFIANCA_CAMPO_BAIXA` | algum campo obrigatório abaixo do limiar |
| `CAMPO_OBRIGATORIO_AUSENTE` | campo obrigatório não veio |
| `NOME_INCOMPLETO` | marcador do template ficou sem valor |
| `TIPO_DESCONHECIDO` | extrator devolveu tipo fora do catálogo |
| `CATALOGO_INVALIDO` | template do tipo usa marcador inválido |

### O nome sugerido é dado pessoal

Ele é montado a partir dos campos extraídos, então carrega nome de pessoa,
número de documento e data. Isso o coloca sob o fato (d) junto com `cae_valor`,
apesar de ele ser o resultado principal do serviço.

Duas consequências. Ele **nunca** aparece em log, em nenhuma hipótese, nem em
mensagem de erro, e essa é a regra mais fácil de quebrar por descuido, porque
parece um identificador técnico e não parece dado pessoal. E ele **não** aparece
na listagem, quando ela existir, porque a listagem foi definida como a rota que
não devolve valor extraído, e um nome composto exatamente desses valores não
pode ser a exceção. O raciocínio está no ADR-012.

## Modelo de dados

Tabela e coluna em português. Toda coluna leva o prefixo formado pelas iniciais
do nome da tabela. Chave primária auto incremento, relação sempre com chave
estrangeira declarada no banco. `synchronize` desabilitado, evolução por
migration escrita em SQL.

Mapa de prefixos:

| Tabela | Prefixo | Para quê |
|---|---|---|
| `documento` | `doc` | o conteúdo, identificado pelo hash |
| `submissao` | `sub` | cada envio daquele conteúdo |
| `tipo_documento` | `tpd` | catálogo de tipos, template de nome e obrigatórios |
| `campo_extraido` | `cae` | um campo por linha, com confiança individual |
| `processamento` | `pro` | uma linha por tentativa de chamada ao modelo |
| `fila_processamento` | `flp` | fila em banco do adaptador Postgres |
| `evento_auditoria` | `eva` | trilha de acesso |

A tabela de controle de migrations do TypeORM não segue essa convenção, porque
é do framework e não do domínio. É a única exceção.

### `documento`

| Coluna | Tipo | Observação |
|---|---|---|
| `doc_id` | `BIGSERIAL` | PK |
| `doc_hash_conteudo` | `CHAR(64)` | sha-256 em hex, `UNIQUE`, é a identidade |
| `doc_chave_armazenamento` | `UUID` | gerada por nós, é o único que vira caminho no disco |
| `doc_tipo_midia` | `VARCHAR(100)` | detectado por inspeção, nunca o informado |
| `doc_tamanho_bytes` | `BIGINT` | |
| `doc_situacao` | `VARCHAR(30)` | `CHECK` nos seis valores do ciclo de vida |
| `doc_tpd_id` | `INTEGER` | FK para `tipo_documento`, nulo até classificar |
| `doc_confianca_tipo` | `NUMERIC(4,3)` | confiança consolidada do tipo |
| `doc_nome_sugerido` | `TEXT` | nulo até processar, e nulo quando o nome ficou incompleto |
| `doc_motivos_revisao` | `TEXT[]` | por que parou, códigos e nomes de campo |
| `doc_versao` | `SMALLINT` | lock otimista, prepara o fato (g) |
| `doc_criado_em` | `TIMESTAMPTZ` | |
| `doc_atualizado_em` | `TIMESTAMPTZ` | |
| `doc_processado_em` | `TIMESTAMPTZ` | |

Índice único em `doc_hash_conteudo`, que é o que faz a deduplicação ser garantia
do banco e não torcida da aplicação. Índice em `(doc_situacao, doc_criado_em)`,
que serve tanto para a reconciliação de documentos travados quanto para a fila
de conferência quando ela existir.

`doc_chave_armazenamento` e o nome original são coisas separadas de propósito, e
o nome original nem sequer mora aqui: ele pertence à submissão. O nome vem da
câmera e da mão de quem enviou, e o fato (b) diz que não há validação nenhuma do
outro lado, então ele nunca pode virar caminho no disco. A chave de
armazenamento é um UUID gerado por nós, e é a única coisa que o adaptador de
arquivo conhece.

`doc_situacao` é `VARCHAR` com `CHECK` em vez de chave estrangeira para uma
tabela de apoio. Estado novo sempre exige código novo, então uma tabela de
estados só acrescentaria uma junção sem acrescentar flexibilidade real.
`tipo_documento` é o caso oposto, e por isso é tabela.

`doc_versao` não é usado nesta fatia. Ele existe porque o fato (g) diz que duas
pessoas podem abrir a fila ao mesmo tempo, e adicionar controle de concorrência
depois, numa tabela que já tem dados, é caro. Uma coluna vazia agora é barata.

Não existe `doc_tentativas`, `doc_modelo`, `doc_versao_prompt` nem
`doc_erro_codigo`. Essas quatro coisas são propriedade de uma tentativa, e não
do documento, e moram em `processamento`. O raciocínio está no ADR-011.

### `submissao`

| Coluna | Tipo | Observação |
|---|---|---|
| `sub_id` | `BIGSERIAL` | PK |
| `sub_doc_id` | `BIGINT` | FK para `documento` |
| `sub_nome_original` | `TEXT` | como veio, guardado só para rastreio |
| `sub_tipo_midia_informado` | `VARCHAR(100)` | o que o cliente disse, para comparar com o real |
| `sub_sistema_origem` | `VARCHAR(50)` | qual sistema interno enviou, e o canal |
| `sub_chave_idempotencia` | `VARCHAR(100)` | opcional |
| `sub_criado_em` | `TIMESTAMPTZ` | |

Índice único parcial em `(sub_sistema_origem, sub_chave_idempotencia)`, só
quando a chave não é nula. O escopo por sistema é deliberado e está no ADR-006.

Índice em `(sub_doc_id, sub_criado_em DESC)`, que é o que o `GET` usa para achar
a submissão mais recente sem varrer.

Guardo `sub_tipo_midia_informado` ao lado de `doc_tipo_midia` de propósito. A
diferença entre os dois é a medida de quanto o cliente erra, e o fato (b) diz
que não há validação nenhuma do lado de quem envia.

### `tipo_documento`

| Coluna | Tipo | Observação |
|---|---|---|
| `tpd_id` | `SERIAL` | PK |
| `tpd_codigo` | `VARCHAR(50)` | `UNIQUE`, é o que aparece no contrato |
| `tpd_nome` | `VARCHAR(100)` | legível, para interface |
| `tpd_template_nome` | `TEXT` | template do nome padronizado daquele tipo |
| `tpd_campos_obrigatorios` | `TEXT[]` | quais campos aquele tipo exige |
| `tpd_ativo` | `BOOLEAN` | tipo aposentado deixa de ser classificável sem perder histórico |
| `tpd_criado_em` | `TIMESTAMPTZ` | |

Populada por migration, incluindo `DESCONHECIDO` com lista vazia. `tpd_ativo`
existe porque apagar um tipo quebraria a chave estrangeira dos documentos já
classificados com ele.

### `campo_extraido`

| Coluna | Tipo | Observação |
|---|---|---|
| `cae_id` | `BIGSERIAL` | PK |
| `cae_doc_id` | `BIGINT` | FK para `documento` |
| `cae_nome` | `VARCHAR(60)` | |
| `cae_valor` | `TEXT` | dado pessoal, às vezes sensível |
| `cae_confianca` | `NUMERIC(4,3)` | por campo, não por documento |
| `cae_origem` | `VARCHAR(20)` | `MODELO` ou `CORRECAO_HUMANA` |
| `cae_atualizado_em` | `TIMESTAMPTZ` | |

Único em `(cae_doc_id, cae_nome)`. Nada de JSONB aqui, porque a regra de
confiança avalia campo a campo. O raciocínio está no ADR-007.

`cae_origem` indica a origem do **valor atual**. Como existe uma linha por
documento e campo, uma correção humana substitui o valor do modelo, e o valor
anterior não é preservado. Para esta fatia isso é aceitável. O histórico e a
comparação entre resposta do modelo e correção humana ficam registrados como
evolução em `docs/escopo-nao-implementado.md`, porque é justamente o que
permitiria medir a taxa real de acerto do fornecedor.

Esta é a tabela que concentra o dado pessoal do fato (d). É a única do sistema
cujo conteúdo nunca pode aparecer em log, em mensagem de erro ou em resposta que
não seja a consulta por identificador.

### `processamento`

Uma linha por tentativa de chamada ao modelo, e não por documento.

| Coluna | Tipo | Observação |
|---|---|---|
| `pro_id` | `BIGSERIAL` | PK |
| `pro_doc_id` | `BIGINT` | FK para `documento` |
| `pro_tentativa` | `SMALLINT` | 1, 2, 3, único junto com o documento |
| `pro_provedor` | `VARCHAR(50)` | quem atendeu, `duble` nesta fatia |
| `pro_modelo` | `VARCHAR(100)` | qual modelo |
| `pro_versao_prompt` | `VARCHAR(50)` | qual versão de prompt |
| `pro_sucesso` | `BOOLEAN` | |
| `pro_duracao_ms` | `INTEGER` | |
| `pro_custo_estimado` | `NUMERIC(10,6)` | quanto aquela chamada custou |
| `pro_erro_codigo` | `VARCHAR(50)` | nulo quando teve sucesso |
| `pro_erro_mensagem` | `TEXT` | técnica, nunca conteúdo do documento |
| `pro_iniciado_em` | `TIMESTAMPTZ` | |
| `pro_terminado_em` | `TIMESTAMPTZ` | |

Único em `(pro_doc_id, pro_tentativa)`. Índice em
`(pro_doc_id, pro_iniciado_em DESC)` para o `GET` achar a última tentativa.

Uma linha por tentativa, e não um contador no documento, porque um contador
responde "quantas vezes" e nada mais. Com uma linha por tentativa o sistema
responde quanto o fornecedor custou no mês, qual a taxa real de falha dele e se
a versão nova do modelo ficou mais lenta que a anterior. Num serviço cobrado por
chamada, essa é a informação que decide contrato. Está no ADR-011.

### `fila_processamento`

Fila em banco usada pelo adaptador Postgres.

| Coluna | Tipo | Observação |
|---|---|---|
| `flp_id` | `BIGSERIAL` | PK |
| `flp_doc_id` | `BIGINT` | FK para `documento` |
| `flp_situacao` | `VARCHAR(20)` | `PENDENTE`, `EM_EXECUCAO`, `CONCLUIDO`, `FALHOU` |
| `flp_tentativas` | `SMALLINT` | |
| `flp_disponivel_em` | `TIMESTAMPTZ` | é o backoff, o consumo só pega o que já venceu |
| `flp_reservado_em` | `TIMESTAMPTZ` | detecta worker que morreu segurando trabalho |
| `flp_reservado_por` | `VARCHAR(100)` | identificação do worker |
| `flp_criado_em` | `TIMESTAMPTZ` | |
| `flp_atualizado_em` | `TIMESTAMPTZ` | |

Índice em `(flp_situacao, flp_disponivel_em)`. O consumo é
`SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1`, que é o mesmo mecanismo que resolve
o fato (g) mais tarde. Implementá-lo aqui é conveniente: a fila de conferência
depois reusa o padrão em vez de inventar outro.

**A tabela é criada sempre**, independente de qual adaptador de fila esteja
ativo. Migration condicional a variável de ambiente produz bancos diferentes com
o mesmo número de migration, o que transforma qualquer diagnóstico futuro em
adivinhação. Uma tabela vazia não custa nada.

### `evento_auditoria`

| Coluna | Tipo | Observação |
|---|---|---|
| `eva_id` | `BIGSERIAL` | PK |
| `eva_doc_id` | `BIGINT` | FK, `ON DELETE SET NULL` |
| `eva_acao` | `VARCHAR(50)` | |
| `eva_ator` | `VARCHAR(100)` | qual sistema ou pessoa |
| `eva_detalhe` | `JSONB` | formato varia por ação |
| `eva_criado_em` | `TIMESTAMPTZ` | |

A chave estrangeira é `ON DELETE SET NULL` porque o registro de que alguém
acessou um documento precisa sobreviver ao apagamento do documento. Quando a
política de retenção existir, apagar o dado pessoal não pode apagar a prova de
quem o acessou antes.

É o único lugar com JSONB, porque é o único lugar onde o formato varia de
verdade. `eva_detalhe` carrega nome de campo e contagem, nunca valor extraído:
registra que a extração aconteceu, quanto demorou e quantos campos vieram, não o
que estava escrito no documento.

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
erro. Nunca carrega valor de campo extraído, **nome sugerido**, conteúdo do
arquivo, corpo do multipart ou resposta crua do extrator. É a regra mais fácil
de quebrar por descuido, então tem teste.

O nome sugerido está nessa lista apesar de ser o resultado principal do serviço,
porque ele é montado a partir dos campos extraídos e carrega nome de pessoa e
número de documento. Ele parece identificador técnico e não parece dado pessoal,
e é por isso que precisa estar escrito.

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
