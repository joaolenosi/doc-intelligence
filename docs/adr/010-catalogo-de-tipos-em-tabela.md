# ADR-010: Catálogo de tipos de documento em tabela

**Status:** aceita, 31/08/2026

## Contexto

Cada tipo de documento carrega duas coisas que a aplicação precisa saber: quais
campos aquele tipo exige, e como o nome padronizado daquele tipo é montado.

A primeira é o que permite exigir conferência humana de uma identidade sem
número sem exigir o mesmo de um contrato, que não tem número nenhum. A segunda é
o padrão interno de nomes do escritório, citado no cenário como algo que já
existe hoje na mão de uma pessoa.

Nenhuma das duas é decisão de engenharia. As duas são decisão de negócio, e o
fato (f) diz que o modelo e os prompts vão mudar mais de uma vez no primeiro
ano, o que arrasta a lista de campos junto.

## Decisão

Uma tabela `tipo_documento` com código, nome legível, template do nome
padronizado, lista de campos obrigatórios e um marcador de ativo. Populada por
migration, incluindo `DESCONHECIDO` com lista vazia. `doc_tpd_id` é chave
estrangeira para ela, então o banco impõe a lista fechada.

O domínio continua dono da regra. A política de confiança sabe comparar
confiança com limiar, e a política de nomenclatura sabe montar, sanitizar e
truncar o nome. O que vem do catálogo são os parâmetros, carregados na
infraestrutura e entregues às políticas como dados.

## Alternativas consideradas

**Lista fechada como constante no domínio,** que é como estava na primeira
versão da especificação. É a opção mais simples, dá validação em tempo de
compilação e mantém o domínio autossuficiente. Descartada porque transforma
"o escritório passou a exigir o órgão emissor no comprovante" em pull request,
revisão e deploy. É decisão de negócio esperando fila de engenharia.

**Campos obrigatórios e template em arquivo de configuração,** carregado na
subida. Fica versionado, que é uma vantagem real sobre a tabela. Descartada
porque continua exigindo deploy para mudar, e porque o tipo do documento precisa
de integridade referencial com `documento`: com arquivo, nada impede o banco de
guardar um tipo que não existe mais.

**Uma tabela por tipo de documento,** com colunas tipadas. Descartada no
ADR-007, pelo mesmo motivo: esquema rígido amarrado a uma saída de modelo que
ainda vai mudar.

## Consequências

Mudar o padrão de nomes ou a lista de campos obrigatórios de um tipo vira uma
linha de SQL, sem deploy. É exatamente o que se quer de uma regra que pertence
ao negócio.

Em troca, some a validação em tempo de compilação: um template mal escrito no
banco só aparece quando um documento daquele tipo for processado. O mitigador é
a política de nomenclatura ter fallback determinístico para campo ausente, o que
ela já tem por outro motivo, e um teste que exercita template incompleto.

O domínio deixa de ser autossuficiente para nomear e para decidir confiança:
precisa receber o tipo carregado. Isso é uma dependência de dados, não de
framework, então a fronteira do ADR-002 continua de pé e o teste que a defende
continua passando.

Tipo aposentado não é apagado, é marcado como inativo. Apagar quebraria a chave
estrangeira dos documentos já classificados com ele, e perder a classificação
histórica para limpar um catálogo seria um mau negócio.
