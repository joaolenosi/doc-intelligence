# ADR-005: Timeout acima do pior caso e teto finito de tentativas

**Status:** aceita, 31/08/2026

## Contexto

O fato (a) diz três coisas na mesma frase: a chamada leva entre 5 e 40 segundos,
é cobrada por documento, e de vez em quando devolve erro ou simplesmente não
responde. As três juntas mudam a resposta.

## Decisão

Timeout de 60 segundos, acima do pior caso conhecido. Teto de 3 tentativas no
total, com backoff exponencial e jitter, aproximadamente 2s e 8s. Só falha
transitória é retentada: timeout, erro de rede e `5xx`. Erro permanente,
resposta malformada e recusa do fornecedor vão direto para `FAILED`.

A classificação do erro é responsabilidade do adaptador, que devolve
`FalhaTransitoriaDoExtrator` ou `FalhaPermanenteDoExtrator`. O caso de uso não
conhece status code.

## Alternativas consideradas

**Timeout curto, por exemplo 15 ou 30 segundos,** para liberar o worker mais
cedo. É o reflexo comum e está errado aqui. A cobrança é por documento e
acontece do lado do fornecedor: cortar aos 30 segundos uma chamada que responde
aos 35 significa pagar e jogar a resposta fora, e depois pagar de novo no retry.
Timeout curto não economiza dinheiro, gasta. Descartada. Quem protege contra
lentidão é a concorrência limitada do ADR-004, não o relógio.

**Retry sem teto, com backoff longo.** Descartada porque cada tentativa é
cobrada. Numa indisponibilidade do fornecedor durante o pico, retry infinito
transforma uma falha em uma fatura. Um teto finito e um estado terminal de falha
tornam o problema visível para uma pessoa em vez de silenciosamente caro.

**Retentar qualquer erro.** Descartada porque repetir o que falhou por motivo
determinístico, como um arquivo que o modelo não consegue ler, só multiplica o
custo sem mudar o resultado.

## Consequências

Um worker pode ficar preso por até 60 segundos numa chamada que nunca responde,
o que reduz a vazão efetiva. É o preço de não desperdiçar chamada paga, e a
concorrência configurável é o que compensa.

Um documento pode custar até 3 chamadas antes de terminar em `FAILED`. Por isso
`doc_tentativas` fica na tabela `documento` e não só na fila: é a coluna que
responde quanto aquele documento já custou, o que é informação de negócio.

**Risco que fica em aberto.** O timeout do nosso lado não cancela o
processamento do lado do fornecedor. Se ele responder aos 65 segundos, nós
pagamos, descartamos, e o retry paga outra vez. Fechar isso exigiria idempotência
do lado do fornecedor, com uma chave de requisição que ele reconheça, e eu não
sei se o fornecedor oferece isso. Está registrado em
`docs/escopo-nao-implementado.md` e virou pergunta por e-mail.
