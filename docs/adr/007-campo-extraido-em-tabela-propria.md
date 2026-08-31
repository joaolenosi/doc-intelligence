# ADR-007: Campo extraído em tabela própria, não em JSONB

**Status:** aceita, 31/08/2026

## Contexto

O comportamento 4 do produto diz que, quando a máquina não tiver confiança no
que produziu, o documento não pode entrar como pronto. Para decidir isso é
preciso saber em quê exatamente a máquina não confiou. O fato (d) diz que esse
conteúdo é dado pessoal, e parte dele sensível.

## Decisão

Uma tabela `campo_extraido`, com uma linha por campo, guardando nome, valor,
confiança individual e origem, sendo a origem `MODELO` ou `CORRECAO_HUMANA`.

JSONB fica reservado para `evento_auditoria`, que é onde o formato varia de
verdade.

## Alternativas consideradas

**Um JSONB no documento com todos os campos e uma confiança geral.** É a opção
mais rápida de escrever, absorve qualquer formato que o modelo devolva e não
exige migration quando um tipo de documento ganha um campo novo. Descartada por
causa da confiança agregada: média esconde. Um RG com nome, filiação e data de
nascimento a 0,97 e o número do documento a 0,40 tem média alta e é exatamente o
caso que precisa de olho humano. Com uma linha por campo, a política de confiança
avalia campo a campo e o caso deixa de passar despercebido.

**Um JSONB com a confiança dentro de cada campo.** Corrige o problema da média e
mantém a flexibilidade. Descartada por três motivos menores que somam. A regra
de negócio passaria a depender do formato de um documento sem esquema, o que
significa validar JSON à mão em vez de confiar no banco. A correção humana ficaria
sem lugar natural para registrar quem mudou o quê, e o comportamento 4 termina
justamente em "a pessoa conferente corrige o que a máquina errou". E o dado
pessoal ficaria espalhado dentro do documento em vez de concentrado numa tabela
que eu consigo tratar com regra própria, o que importa por causa do fato (d).

**Uma tabela por tipo de documento,** com colunas tipadas para RG, contracheque
e assim por diante. Dá a validação mais forte de todas. Descartada porque o fato
(f) diz que o modelo e os prompts vão mudar: cada mudança de campo viraria
migration e alteração de esquema, e o esquema rígido é a peça errada para
amarrar a uma saída de modelo que ainda vai mudar.

## Consequências

Adicionar um campo novo a um tipo não exige migration, porque a tabela é
genérica em nome e valor. Só a lista de campos obrigatórios por tipo muda, e ela
vive no domínio.

O valor perde tipagem: tudo é texto. Data e número extraídos vêm como string, e
quem consome converte. Aceito, porque a saída de um modelo de linguagem é texto
de qualquer forma, e converter cedo esconderia o que ele realmente devolveu.

Uma consulta a mais para montar o resultado, irrelevante neste volume.

O dado pessoal fica concentrado numa tabela só. Isso facilita a regra de nunca
logar valor extraído, e facilita a política de retenção quando ela existir, que é
um risco registrado e não implementado.
