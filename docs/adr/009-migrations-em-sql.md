# ADR-009: Migrations em SQL, `synchronize` desabilitado

**Status:** aceita, 31/08/2026

## Contexto

O projeto usa uma convenção de nomenclatura própria: tabela e coluna em
português, com toda coluna carregando o prefixo formado pelas iniciais do nome
da tabela, como `doc_hash_conteudo` e `cae_valor`. O ADR-002 exige entidade de
domínio separada da entidade de ORM.

## Decisão

`synchronize` desabilitado em qualquer ambiente. A evolução do banco é feita por
migration escrita à mão em SQL. O TypeORM fica restrito à infraestrutura, e a
entidade de ORM é mapeada explicitamente para a entidade de domínio.

## Alternativas consideradas

**`synchronize: true` em desenvolvimento.** É conveniente e economiza tempo no
começo. Descartada porque o esquema passaria a ser um efeito colateral das
anotações da entidade, e a convenção de prefixo é justamente o tipo de detalhe
que se perde assim, silenciosamente, quando alguém esquece um `name:`. Também
porque um projeto que nasce com `synchronize` ligado costuma descobrir tarde que
não sabe migrar, e o enunciado pede um README que permita a outra pessoa subir o
projeto.

**Migrations geradas pelo TypeORM a partir das entidades.** É o meio-termo
usual e economiza digitação. Descartada porque o SQL gerado é verboso e
imprevisível em detalhes que aqui importam: nome de índice, nome de constraint e
ordem de coluna. Como as tabelas são poucas, escrever o SQL à mão custa pouco e
me deixa dono do que vai para o banco.

**Prisma.** Migrations declarativas melhores que as do TypeORM e tipagem forte
de graça. Descartada porque o Prisma Client continua sendo infraestrutura, o
mapeamento para o domínio continua necessário, a convenção de prefixo exigiria
`@map` em cada campo, e o rascunho de instruções que eu já tinha escrito antes do
repositório citava TypeORM. A vantagem não pagava a divergência.

## Consequências

Escrevo SQL à mão para cada mudança de esquema, e uma mudança na entidade de ORM
que eu esqueça de refletir na migration só aparece quando o banco reclama.

O SQL das migrations é legível como documentação do modelo de dados, e vale como
prova de que a convenção de prefixo foi seguida de verdade.

A troca de banco fica mais cara, porque as migrations usam recurso de Postgres,
incluindo o `SKIP LOCKED` do adaptador de fila. A arquitetura garante que o
domínio e os casos de uso não mudam, e não que a troca seja de graça. Está
escrito assim na `docs/arquitetura.md`.
