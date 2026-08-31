# Análise inicial de requisitos

## Contexto Geral

O DOC Intelligence será um serviço interno para automatizar o tratamento de
documentos recebidos pelo escritório.

Para esta entrega escolhi a Trilha A, portanto o foco será exclusivamente no
backend: recebimento, processamento e persistência dos documentos, além da
exposição de uma API Swagger para consulta dos resultados.

Vamos utilizar Node.js, TypeScript e NestJS. As demais decisões de
infraestrutura serão avaliadas durante o planejamento.

## Abstracao do desáfio 

O serviço precisa receber documentos enviados por outros sistemas internos.
Esses documentos poderão ser imagens ou PDFs e não podemos assumir que o nome
do arquivo ou outras informações enviadas pelo cliente estejam corretos.

Depois do recebimento, o documento precisa passar por um modelo multimodal
externo responsável por identificar o tipo do documento e extrair os dados de
interesse (Vamos usar um modelo de llm fake para simular processamento).

O resultado do processamento precisa ser armazenado para consulta posterior.

Embora o produto final tenha outras funcionalidades, como fila de conferência
humana e listagem dos documentos processados, a entrega solicita uma fatia
vertical pequena. Minha intenção inicial é implementar o fluxo:

receber > processar > persistir > consultar.

## Pontos que identifiquei no cenário

### Processamento pode ser demorado

O modelo de IA pode levar entre 5 e 40 segundos para responder.

Por isso, minha hipótese inicial é que o processamento não deve ocorrer
diretamente durante a requisição HTTP de upload para que a aplicacao nao fique travada. Quero avaliar uma estratégia
de processamento assíncrono como por bullmq.

### A llm pode falhar

A API externa ocasionalmente retorna erro ou não responde.

O sistema precisa considerar timeout, tentativas de processamento e um estado
de falha. Como cada chamada possui custo, as tentativas não devem ocorrer de
forma ilimitada.

### Documentos podem ser enviados mais de uma vez

O mesmo documento pode chegar repetidamente.

Quero investigar uma forma de identificar duplicações antes de realizar uma
nova chamada ao modelo de llm, principalmente porque cada processamento possui
custo.

Também considero importante distinguir duplicação do arquivo de idempotência
da requisição.

### Os arquivos recebidos não são confiáveis

Os documentos chegam principalmente por celular e não existe validação no
sistema que atualmente os recebe.

O backend não deve confiar apenas no nome do arquivo, extensão ou tipo MIME
informado pelo cliente.

### Existem dados pessoais

Os documentos podem conter dados pessoais e dados pessoais sensíveis.

Isso afeta principalmente armazenamento, logs, acesso aos arquivos, dados
utilizados nos testes e futura política de retenção.

Nenhum teste deste projeto deverá utilizar documentos reais.

### Existe concentração de volume

O volume médio informado é de aproximadamente 150 documentos por dia, mas pode
passar de 800 documentos em um período concentrado entre 9h e 11h.

Mesmo não sendo um volume extremamente alto, o processamento externo é lento.
Quero considerar esse comportamento no desenho da solução para evitar que o
pico de uploads seja limitado diretamente pela capacidade do fornecedor.

### Modelo e prompts mudarão

O modelo utilizado pelo fornecedor será substituído e os prompts sofrerão
alterações ao longo do tempo.

Por isso considero importante evitar dependência direta do fornecedor nas
regras centrais da aplicação e manter alguma rastreabilidade sobre qual modelo
e versão de prompt produziram cada resultado.

### Existe conferência humana

Resultados com baixa confiança não devem ser considerados prontos.

Mesmo que a correção humana não faça parte da fatia implementada inicialmente,
o modelo de estados do documento precisa conseguir representar essa situação.

Também existe um problema futuro de concorrência, pois duas pessoas podem
acessar a fila de conferência simultaneamente.

### O serviço não é público

O DOC Intelligence será consumido por outros sistemas internos do escritório.

Autenticação real está explicitamente fora da entrega, mas a arquitetura não
deve assumir que esta é uma API pública e anônima.

## Fatia vertical que pretendo implementar

Minha proposta inicial é implementar somente:

1. recebimento de imagem ou PDF;
2. validação básica do arquivo;
3. persistência do documento;
4. envio para processamento;
5. processamento utilizando um dublê do modelo de IA;
6. persistência do resultado;
7. definição do estado do documento de acordo com o processamento;
8. consulta do documento e do resultado por identificador.

A conferência humana será considerada no projeto, mas não faz parte da
implementação inicial.

## Pontos que ainda quero decidir

Ainda preciso avaliar e registrar:

- estratégia de processamento assíncrono;
- tecnologia de fila;
- banco de dados;
- armazenamento dos arquivos;
- estratégia de deduplicação;
- política de retry e timeout;
- estados definitivos do documento;
- política inicial de confiança;
- fronteira com o fornecedor de IA;
- estrutura dos módulos;
- contrato HTTP;
- quais testes representam melhor os riscos da fatia.

Essas decisões deverão ser tomadas antes da implementação e registradas na
especificação, arquitetura ou em ADRs quando justificarem um registro
individual.
