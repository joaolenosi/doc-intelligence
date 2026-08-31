# ADR-001: Trilha A, Node com TypeScript e NestJS

**Status:** aceita, 31/08/2026

## Contexto

O enunciado deixa a escolha de linguagem, framework, banco e ferramentas por
minha conta, e diz que a escolha é conteúdo da avaliação. Também manda escolher
uma trilha, dizendo que não existe trilha melhor e que eu devo escolher a que
representa o trabalho que eu quero fazer. O prazo é de 3 dias corridos e a
maior parte da nota está em projeto, decisão e registro, não em quantidade de
código.

## Decisão

Trilha A, back-end. Node com TypeScript e NestJS.

## Alternativas consideradas

**Trilha B, front-end.** Descartada porque o trabalho que eu quero fazer é o de
back-end, e porque os problemas mais interessantes deste cenário estão desse
lado: o fornecedor lento e instável, o arquivo que não dá para confiar, o
reenvio e o pico das 9h. Na trilha B eu definiria o contrato e o serviria por
mock, o que é justamente a parte que eu quero implementar de verdade.

**Go.** Melhor para concorrência e para o custo de processo do worker, e
produziria um binário fácil de subir. Descartada por velocidade minha: em 3 dias
eu escrevo bem mais TypeScript do que Go, e o tempo que eu economizo aqui é
tempo que vai para a documentação, que vale mais nota.

**Python com FastAPI.** É o ecossistema natural de quem chama modelo multimodal,
e teria vantagem se eu fosse integrar com um fornecedor real. Descartada porque
o fornecedor é um dublê nesta entrega, então essa vantagem não se realiza, e
porque eu produzo mais rápido em TypeScript.

**Node com TypeScript sem NestJS,** por exemplo Fastify puro. Seria mais leve e
me daria controle total da injeção de dependência, que é o que a hexagonal
precisa. Descartada porque eu teria que montar à mão a composição de módulos, e
o Nest já resolve isso com uma estrutura que o avaliador reconhece de imediato.

## Consequências

O Nest traz decorator e injeção de dependência para dentro do projeto, e isso
briga com a hexagonal se eu deixar. É o que motiva o ADR-002 e o teste de
fronteira: o framework fica confinado na infraestrutura à força.

A escolha é de familiaridade e velocidade, não uma tese de que essa é a melhor
ferramenta para o problema. Um serviço que passa a maior parte do tempo
esperando I/O de um fornecedor externo não é onde Node se destaca nem onde ele
sofre.
