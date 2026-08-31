# Versões anteriores

Os dois arquivos aqui são o estado anterior de documentos que depois foram
reescritos. Guardo por dois motivos.

O primeiro é a regra do próprio enunciado: se a implementação divergir da
especificação, entrego a especificação como estava e digo onde divergiu.
Aplico o mesmo critério aos documentos de projeto.

O segundo é que sem eles o registro de uso de IA fica sem prova. Em
`docs/uso-de-ia.md` eu afirmo que o agente produziu um documento genérico e que
eu mandei refazer. Com o antes e o depois lado a lado, quem estiver lendo
confere a afirmação em vez de acreditar nela.

## `analise-requisitos-v1.md`

Primeira versão de `docs/analise-requisitos.md`, saída da sessão 00. Cobre os
sete fatos do ambiente, o que era o objetivo, mas termina com doze decisões em
aberto e nenhuma pergunta para o avaliador. Foi reescrita antes do commit
inicial, por isso não aparece no histórico do git.

## `instrucoes-agente-rascunho.md`

Rascunho de instruções do agente, também da sessão 00, com as minhas decisões
de arquitetura hexagonal, padrões de projeto e nomenclatura de banco. Viveu na
raiz como `CLAUDE2.MD` e foi fundido no `CLAUDE.md` definitivo no commit
932235f. Nunca foi rastreado pelo git, então esta cópia é o único registro
dele.

Duas coisas dele não entraram, de propósito. Os caminhos de arquivo, porque
apontavam para arquivos que não existem neste repositório. E a regra de
escrever mensagem de commit sem acento, porque português sem acento lê como
descuido e não como convenção.
