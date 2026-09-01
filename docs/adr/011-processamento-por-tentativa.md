# ADR-011: Uma linha por tentativa, não um contador no documento

**Status:** aceita, 31/08/2026

## Contexto

O fato (a) diz que cada chamada ao modelo é cobrada por documento, leva entre 5
e 40 segundos, e de vez em quando falha. O ADR-005 estabeleceu um teto de 3
tentativas. O fato (f) diz que o modelo vai trocar de versão.

A primeira versão da especificação resolvia isso com um contador
`doc_tentativas` e três colunas no documento para modelo, versão de prompt e
erro.

## Decisão

Uma tabela `processamento`, com uma linha por tentativa de chamada, guardando o
número da tentativa, provedor, modelo, versão do prompt, sucesso, duração, custo
estimado, código e mensagem de erro, início e fim.

O documento perde `doc_tentativas`, `doc_modelo`, `doc_versao_prompt`,
`doc_erro_codigo` e `doc_erro_mensagem`. O `GET` monta o bloco `processamento`
da resposta a partir da última tentativa.

## Alternativas consideradas

**Contador e colunas no documento,** que era o desenho anterior. É mais simples,
não precisa de junção e responde a pergunta imediata, que é "esse documento
falhou quantas vezes". Descartada porque só responde essa. Num serviço cobrado
por chamada, as perguntas que decidem contrato são outras: quanto o fornecedor
custou no mês, qual a taxa real de falha dele, e se a versão nova do modelo
ficou mais lenta ou mais cara que a anterior. Um contador não responde nenhuma
delas, e a informação para respondê-las é destruída a cada sobrescrita.

**Guardar só a última tentativa,** com as colunas no documento sendo atualizadas
a cada vez. Descartada pelo mesmo motivo, agravado: quando o documento termina
em `PROCESSED` depois de duas falhas, as duas falhas somem, e a taxa de falha
medida fica artificialmente boa exatamente nos casos em que o retry salvou.

**Registrar as tentativas apenas em log estruturado,** deixando o banco limpo. É
o que muitos projetos fazem e é barato. Descartada porque log é volátil, tem
retenção própria, e porque uma pergunta de negócio sobre custo não deveria
depender de uma ferramenta de observabilidade estar configurada e ter o período
retido.

## Consequências

Uma junção a mais no `GET`, apoiada no índice
`(pro_doc_id, pro_iniciado_em DESC)`. Irrelevante neste volume.

A tabela cresce mais rápido que `documento`, até três linhas por documento. Em
150 documentos por dia isso é ruído, e mesmo no pico de 800 é irrelevante.

`pro_custo_estimado` é estimado, e a palavra está no nome de propósito. O preço
real vem da fatura do fornecedor, e o que o sistema guarda é o cálculo pela
tabela de preços conhecida no momento da chamada. Serve para comparar e para
alertar, não para conciliar contabilidade.

A resposta do `GET` fica com um bloco `processamento` em vez de campos soltos, o
que é uma mudança de contrato em relação à primeira versão da especificação. Como
não existe código ainda, é revisão e não divergência.

Fica de graça a base para a métrica que o `docs/escopo-nao-implementado.md`
descreve como não implementada: chamadas por documento concluído. Os dados
passam a existir mesmo sem ninguém tê-los coletado ainda.
