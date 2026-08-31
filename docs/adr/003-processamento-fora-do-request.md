# ADR-003: Processamento fora do ciclo da requisição

**Status:** aceita, 31/08/2026

## Contexto

O fato (a) diz que cada chamada ao modelo leva entre 5 e 40 segundos. O fato (e)
diz que o pico passa de 800 documentos concentrados entre 9h e 11h. O fato (b)
diz que quem envia é o atendimento, do próprio celular.

## Decisão

O upload responde imediatamente com identificador e estado. O processamento
acontece em outro processo, consumindo de uma fila. O estado do documento é o
que conta a história para quem consome.

## Alternativas consideradas

**Processar dentro do request.** Seria a implementação mais simples e entregaria
o resultado numa chamada só. Descartada porque segura uma conexão por até 40
segundos por documento: no pico, o atendimento manda um lote do celular e o
serviço fica sem conexão disponível antes de o fornecedor ficar sem capacidade.
Também porque qualquer queda de rede do celular perderia trabalho já pago.

**Processar em background dentro do mesmo processo,** com a resposta saindo
antes. Resolve o problema da conexão presa e é bem mais barato de montar.
Descartada porque o que estiver em voo se perde quando o processo cai, e o fato
(a) diz que o fornecedor falha de vez em quando, ou seja, o cenário de trabalho
interrompido não é hipotético. Perder um documento em voo é perder uma chamada
já cobrada.

## Consequências

O resultado não é imediato, e o contrato precisa dizer isso com todas as letras.
É o que motiva o ADR-008, sobre como o cliente descobre que terminou.

Passa a existir um segundo processo para subir, operar e observar. O
`docker-compose` sobe API e worker separados, o que aumenta um pouco o custo do
README.

Em troca, o pico do fato (e) é absorvido pela fila em vez de ser repassado para
quem envia, e a concorrência com o fornecedor vira um número que eu controlo.
