# ADR-006: Identidade pelo hash do conteúdo, submissão separada

**Status:** aceita, 31/08/2026

## Contexto

O fato (c) diz que o mesmo documento costuma chegar mais de uma vez, porque o
cliente reenvia por insegurança e o atendimento reenvia por precaução. O fato
(b) diz que o nome do arquivo é o que a pessoa deu, e muda a cada reenvio. O
fato (a) diz que cada processamento é cobrado. Reenvio processado é dinheiro
gasto por nada.

## Decisão

A identidade do documento é o sha-256 do conteúdo do arquivo, com índice único
no banco. Cada envio cria uma linha em `submissao`, apontando para o documento,
com o nome original, o tipo de mídia informado, a origem e a data.

Reenvio não é erro: a API devolve `200` com o documento existente, em vez de
`409`. `201` fica só para o primeiro envio de um conteúdo.

Idempotência de requisição é problema separado, resolvido pelo header
`Idempotency-Key` gravado em `sub_chave_idempotencia`.

## Alternativas consideradas

**Deduplicar por nome do arquivo ou por metadado do envio.** Descartada de
imediato: o fato (b) diz que o nome é o que a pessoa deu, e o mesmo documento
chega como "WhatsApp Image 2026-08-11 at 09.12.33.jpeg" e "scan0001.pdf". Só o
conteúdo permanece igual.

**Uma tabela só, com uma linha por envio e a deduplicação feita na consulta.**
Mais simples de modelar. Descartada porque a garantia de não pagar duas vezes
passaria a depender de a aplicação lembrar de consultar antes, em vez de ser
imposta pelo banco. Com índice único, duas requisições simultâneas do mesmo
arquivo não conseguem criar dois documentos nem em condição de corrida.

**Uma tabela só, guardando apenas o primeiro envio e descartando os demais.**
Resolve o custo e é a opção mais barata. Descartada porque joga fora informação
de negócio: o escritório perde a capacidade de saber que aquele documento chegou
três vezes e por quais canais, que é exatamente o comportamento que o cenário
descreve. Separar submissão de documento dá isso de graça.

**Tratar o reenvio como conflito, respondendo `409`.** Descartada porque seria
mentir sobre o que aconteceu. O reenvio é o comportamento esperado do fato (c),
não um erro do cliente, e forçar quem consome a tratar exceção para um caso
normal é contrato ruim.

## Consequências

Uma junção a mais para responder "quantas vezes esse documento chegou", o que é
irrelevante neste volume.

O hash é calculado no caminho do upload, sobre até 25 MB. É custo de CPU no
request, mas é muito mais barato do que uma chamada ao modelo.

**Limitação conhecida.** O hash pega o reenvio literal do mesmo arquivo, que é a
maior parte do volume descrito. Não pega refotografia: o cliente que tira outra
foto do mesmo RG gera bytes diferentes e cria um documento novo, que vai ser
processado e cobrado. Resolver isso exigiria comparação perceptual de imagem ou
deduplicação pelos campos já extraídos, e as duas coisas custam mais do que a
economia que trazem neste volume. Está registrado em
`docs/escopo-nao-implementado.md`.
