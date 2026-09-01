# Fixtures

Arquivos fictícios que simulam o que chega ao escritório pelo WhatsApp do
atendimento, por e-mail e no balcão.

Gerados por `npm run fixtures:gerar`, e não escritos à mão. São dois motivos:
arquivo binário commitado à mão ninguém revisa e ninguém sabe dizer o que tem
dentro, e o enunciado proíbe dado real de cliente. Com um gerador, dá para
provar por leitura de código que não existe nada real aqui.

## Nenhum dado real, e isso é verificado

Todo nome de pessoa é inventado e **todo número de documento reprova em
validação de dígito**, de propósito. Isso não é promessa: há um teste em
`testes/infraestrutura/fixtures.spec.ts` que varre os arquivos procurando
qualquer número de onze dígitos que passe na validação de CPF, e que também
confere que o arquivo no disco é exatamente o que o gerador produz hoje.

Os arquivos que carregam texto legível avisam no próprio conteúdo que são
fictícios, para o caso de um deles escapar do repositório.

## O que estes arquivos são, e o que não são

Eles são **válidos nos bytes**: o `file(1)` do sistema operacional os classifica
como PNG, PDF, JPEG, HEIF e OLE2, do mesmo jeito que a inspeção do serviço
classifica.

Eles **não são fotografias de documentos**. O dublê deriva a resposta do hash do
conteúdo e não olha pixel, então imagem de verdade não acrescentaria nada aqui.
Um fornecedor real precisaria de digitalizações plausíveis, com foto torta,
sombra e papel amassado, e isso está registrado como limitação:
`docs/escopo-nao-implementado.md` explica que a qualidade da extração sobre
imagem real não foi avaliada neste projeto.

O `identidade-foto-iphone.heic` merece uma nota própria: ele carrega uma caixa
`ftyp` com marca `heic`, que é o que a inspeção usa e é como a foto de iPhone
chega, mas não é uma imagem decodificável. Serve para exercitar a aceitação do
formato, e a conversão de HEIC continua não implementada.

## Os arquivos

### Aceitos

| Arquivo | Tipo detectado | Para que serve |
|---|---|---|
| `rg-frente.jpeg` | `image/jpeg` | identidade fotografada, o caso comum do balcão e do WhatsApp |
| `rg-reenvio.jpeg` | `image/jpeg` | cópia byte a byte do anterior, com outro nome |
| `comprovante-residencia.png` | `image/png` | captura de tela de conta de consumo, que chega bastante por e-mail |
| `procuracao-registro-casa.pdf` | `application/pdf` | documento longo, com mais de uma pessoa citada |
| `contracheque-2026-07.pdf` | `application/pdf` | tipo com competência e valor |
| `identidade-foto-iphone.heic` | `image/heic` | o formato que a câmera de iPhone produz por padrão |

### Recusados, de propósito

| Arquivo | O que acontece | Por quê |
|---|---|---|
| `contrato-locacao.doc` | `415` | formato não aceito, mesmo sendo documento de verdade para o escritório |
| `rg-que-e-word.jpeg` | `415` | a extensão mente: os bytes são de Word e o nome diz JPEG |

O `rg-que-e-word.jpeg` é o fixture mais importante do conjunto. O fato (b) do
enunciado diz que não existe validação nenhuma do lado de quem envia, e este
arquivo é a prova de que o serviço decide pelo conteúdo: ele é recusado apesar
de o nome, a extensão e o `Content-Type` dizerem imagem.

O `.doc` está aqui porque é um formato que o escritório recebe de verdade e que
este serviço **não** trata. Ele documenta um limite do contrato, e não um
esquecimento.

## Como usar

O ambiente precisa estar de pé. Ver o `README.md` na raiz.

```bash
# Primeiro envio: 201
curl -i -X POST http://localhost:3000/v1/documentos \
  -H "X-API-Key: chave-de-desenvolvimento" \
  -H "X-Sistema-Origem: crm-atendimento" \
  -F "arquivo=@fixtures/rg-frente.jpeg"

# Mesmo conteúdo, outro nome e outro canal: 200, com jaExistia true
curl -i -X POST http://localhost:3000/v1/documentos \
  -H "X-API-Key: chave-de-desenvolvimento" \
  -H "X-Sistema-Origem: portal-balcao" \
  -F "arquivo=@fixtures/rg-reenvio.jpeg"

# Extensão mentindo sobre o conteúdo: 415
curl -i -X POST http://localhost:3000/v1/documentos \
  -H "X-API-Key: chave-de-desenvolvimento" \
  -H "X-Sistema-Origem: crm-atendimento" \
  -F "arquivo=@fixtures/rg-que-e-word.jpeg"
```

Depois do primeiro envio, consulte com o id que veio na resposta:

```bash
curl -s http://localhost:3000/v1/documentos/1 \
  -H "X-API-Key: chave-de-desenvolvimento" | python3 -m json.tool
```

O `submissoes.total` vai mostrar `2` e `submissoes.canais` vai listar os dois
canais, porque o segundo envio registrou a submissão sem reprocessar o
documento e sem pagar uma chamada nova ao modelo.
