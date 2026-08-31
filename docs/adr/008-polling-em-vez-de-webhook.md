# ADR-008: Polling em vez de webhook

**Status:** aceita, 31/08/2026

## Contexto

O ADR-003 tirou o processamento do request, então o resultado não sai na
resposta do upload. Alguém precisa descobrir quando ficou pronto. O
comportamento 5 do produto diz que quem consome são outros sistemas internos do
escritório, e não um navegador anônimo.

## Decisão

Polling. O upload responde na hora com identificador e estado, `201` no primeiro
envio e `200` quando o mesmo conteúdo já existe, e o cliente consulta
`GET /v1/documentos/{id}` até o estado sair de `RECEIVED` ou `PROCESSING`.

## Alternativas consideradas

**Webhook.** É melhor para quem consome e evita polling em 800 documentos num
pico. Descartada para esta fatia porque é um subsistema inteiro disfarçado de
funcionalidade: cadastro e validação do destino, reentrega com backoff quando o
destino está fora, assinatura do payload para o destino confiar na origem, e a
regra de não vazar valor de campo extraído no corpo da notificação, que vem do
fato (d). Entregar isso pela metade é exatamente o que o enunciado diz preferir
não ver.

**Server-sent events ou long polling.** Descartada porque resolve latência de
percepção, que não é problema aqui: o processamento leva dezenas de segundos, e
um cliente que consulta a cada poucos segundos já é rápido o suficiente.

**Os dois, com webhook opcional no upload.** É o contrato mais completo e o mais
próximo do que um cliente interno real quer. Descartada porque entregaria os
dois caminhos incompletos dentro do prazo.

## Consequências

Quem consome escreve o laço de consulta, e o custo de descobrir o resultado fica
do lado dele. No pico, 800 documentos com consulta a cada 5 segundos geram
tráfego que este serviço aguenta sem esforço, então o custo é de código do
cliente e não de capacidade.

O contrato precisa deixar explícito que `PROCESSED` e `REVIEW_REQUIRED` são
resultados diferentes, e que documento em `REVIEW_REQUIRED` não é pronto. É por
isso que o estado aparece na resposta do upload, e não só na consulta.

Webhook fica registrado como evolução natural em
`docs/escopo-nao-implementado.md`, com o custo real anotado, e não como algo que
eu não pensei.

**Pergunta em aberto.** Se quem consome preferir webhook, essa decisão muda, e
ela é do lado de quem consome. Perguntei por e-mail em vez de escolher sozinho.
