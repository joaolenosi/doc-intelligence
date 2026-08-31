# ADR-002: Hexagonal com a aplicação livre de framework

**Status:** aceita, 31/08/2026

## Contexto

O fato (f) diz que o modelo do fornecedor será trocado de versão e que os
prompts vão mudar mais de uma vez no primeiro ano. O critério de maior peso da
avaliação, 30%, é arquitetura e modularidade, descrito como "o que acontece
quando uma peça precisa ser trocada". A peça que mais vai mudar é a mais funda:
a chamada ao modelo.

## Decisão

Portas e adaptadores, com a dependência apontando sempre para dentro. O domínio
não importa nada além de tipos da linguagem. A aplicação importa o domínio,
define as portas e também fica livre de framework: os casos de uso são classes
comuns, sem decorator, que recebem tudo pelo construtor. A ligação entre porta e
adaptador é feita por fábrica escrita à mão nos módulos do Nest, na
infraestrutura.

Um teste automatizado varre `src/dominio` e `src/aplicacao` procurando
importação de framework e falha se achar.

## Alternativas consideradas

**Camada padrão do Nest**, com serviço decorado injetado no controller e
repositório do TypeORM dentro do serviço. É mais rápida de escrever, é o que eu
faria num CRUD, e o Nest já dá a separação de módulos de graça. Descartada
porque a regra de negócio passaria a depender de decorator e de entidade de ORM,
e trocar o fornecedor ou o banco encostaria no núcleo. Também porque testar um
serviço decorado exige subir `Test.createTestingModule`, que é lento e acopla o
teste ao framework.

**Hexagonal só até o domínio,** deixando a aplicação usar `@Injectable`.
Descartada com mais dúvida, porque é o meio-termo que quase todo projeto Nest
adota e funciona bem. Descartei porque o decorator na camada de aplicação é
justamente o que faz o caso de uso precisar do container para existir, e o ganho
de testar caso de uso com `new` é o que me permite escrever mais teste em menos
tempo, no prazo que eu tenho.

**Deixar a fronteira só documentada,** sem teste que a defenda. Descartada
porque regra de arquitetura que ninguém verifica dura até o primeiro dia
apertado.

## Consequências

Eu escrevo fábrica à mão para cada porta. É código repetitivo e é o custo real
da decisão, sentido em cada módulo novo.

Existem duas representações de documento, a entidade de domínio e a entidade de
ORM, com mapeamento explícito entre elas. Isso é mais código e é mais um lugar
onde um campo novo precisa ser adicionado.

Em troca, os casos de uso e o domínio são testáveis sem infraestrutura nenhuma,
e trocar o extrator, o armazenamento ou a fila é escrever um adaptador e mudar
uma fábrica.
