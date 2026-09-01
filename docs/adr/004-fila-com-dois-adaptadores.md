# ADR-004: Fila atrás de porta, com dois adaptadores reais

**Status:** aceita, 31/08/2026

## Contexto

O ADR-003 tirou o processamento do request e criou a necessidade de um mecanismo
de entrega. O volume não é o problema: 800 documentos em 2 horas dão 0,11 por
segundo, e a 40 segundos de pior caso isso exige cerca de 4,4 execuções
simultâneas, então arredondei a concorrência para 5 e deixei configurável, já
que o número real depende do limite de chamadas do fornecedor, que eu não
conheço.

O que decide não é o volume, é o fato (a) junto com o fato (e). Um fornecedor
que leva até 40 segundos e falha de vez em quando, num pico concentrado, exige
retentativa com espera crescente e teto de tentativas. Esse é o tipo de código
que parece pronto no dia em que eu escrevo e só mostra o defeito no dia do pico.

## Decisão

A fila fica atrás de uma porta, com enfileirar separado de consumir: a aplicação
só sabe publicar, e o consumo é iniciativa da infraestrutura.

Dois adaptadores reais, escolhidos pela variável `FILA_ADAPTADOR`. O padrão é
BullMQ sobre Redis. O alternativo é uma tabela no Postgres consumida com
`SELECT ... FOR UPDATE SKIP LOCKED`.

## Alternativas consideradas

**Só BullMQ.** Retry, backoff, concorrência e reprocessamento vêm prontos, e eu
não escrevo nada de infraestrutura de fila. Descartada como solução única porque
adaptador que ninguém implementou é promessa e não demonstração: com um só, a
afirmação de que a fila é trocável fica sem prova, e é justamente o que os 30%
da nota perguntam.

**Só fila no Postgres.** Uma fonte de verdade, sem Redis no `docker-compose`, e
enfileirar cabe na mesma transação que grava o documento. É a opção
tecnicamente mais limpa para este volume. Descartada como solução única porque
me obrigaria a escrever lease, backoff e reconciliação à mão em três dias, com
risco de bug sutil, e porque abriria mão de mostrar que eu sei usar a
ferramenta que qualquer equipe usaria aqui.

**Fila em memória no processo.** Descartada no ADR-003: perde o que está em voo.

## Consequências

Manutenção dobrada nessa fronteira. Todo comportamento novo de fila precisa
existir duas vezes, e é o custo que eu aceitei conscientemente.

Os dois adaptadores não são intercambiáveis em comportamento fino. O BullMQ
conta tentativa do jeito dele, o adaptador de Postgres conta em
`flp_tentativas`, e a curva de espera difere. O que o sistema garante igual nos
dois é o teto de tentativas e o estado final. Preferi essa imprecisão a vazar
`attemptsMade` para dentro do caso de uso.

**A janela do adaptador BullMQ.** O estado do documento fica no Postgres e o job
fica no Redis. Se o processo cair entre gravar o documento e publicar o
trabalho, o documento fica parado em `RECEIVED` esperando um worker que nunca
vai pegá-lo. A rotina que varre `RECEIVED` antigo e republica não está
implementada, e o desenho dela está em `docs/escopo-nao-implementado.md`. Com o
adaptador de Postgres a janela não existe, porque gravar o documento e criar o
trabalho cabem na mesma transação.

Escolhi o padrão que tem o defeito, sabendo qual é e como fechá-lo, porque no
prazo desta entrega a ferramenta pronta me poupa tempo que vale mais em
documentação. Se isso fosse produção, eu inverteria o padrão.

Se a etapa de implementação apertar, o adaptador de Postgres é o primeiro item a
cair, e nesse caso o certo é declarar que a porta existe com um adaptador só, em
vez de entregar o segundo pela metade.
