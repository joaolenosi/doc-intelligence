# Sessão 06 — contrato OpenAPI publicado e versionado

**Data:** 01/09 · **Agente:** Claude Code (Opus 5)

---

## Prompt 19

```
Lembre-se de ir commitando e documentando os prompts que utilizei para que todo historico seja construido.
```

**Contexto, escrito depois.** Cobrança durante a etapa do contrato, enquanto eu
perseguia dois testes intermitentes. É a segunda vez que preciso cobrar o
registro, e as duas vezes o agente estava no meio de um problema técnico
interessante. Está anotado em `docs/uso-de-ia.md`: a disciplina de registro é a
primeira coisa que cai quando a tarefa fica absorvente, e é justamente por isso
que ela precisa estar escrita como regra.

O prompt que originou esta sessão é o 18, registrado em
`prompts/05-e2e-com-playwright.md`, porque ele chegou ainda naquela sessão.

## Prompt 20

```
Siga pelo o readme, depois o fixtures, coloque exemplos de como testar, e no meu swagger vamos colocar exemplo, de como os dados devem ser preenchidos: /v1/documentos
Recebe um documento

Responde na hora, sem esperar o modelo. 201 no primeiro envio de um conteudo e 200 quando aquele hash ja existe: o reenvio e o comportamento esperado, e nesse caso o documento nao e reprocessado mas a submissao e registrada.
Parameters
Name    Description
X-API-Key *
string
(header)
    

Fronteira de autenticacao. Nao e seguranca de verdade: ver a especificacao.
Idempotency-Key
string
(header)
    

Opcional. A mesma requisicao repetida por timeout de rede nao cria duas submissoes.
X-Sistema-Origem *
string
(header)
    

Qual sistema interno enviou. Obrigatorio porque a unicidade da chave de idempotencia e por par sistema mais chave.
Request body
arquivo *
string($binary)
    
 e pode exibir a chave real, por que é apenas para fins de testes do desafio e nao para producao. e quando um arquivo ele ja é enviado, ele ta mudando apenas o status code para 200, vamos adicionar o description e adicionar outras informacoes interessantes relacionados a esse endpoint, tempo de processamento, modelo de ia utilizad para processamento
```

**Contexto, escrito depois.** A observação sobre o reenvio é boa e virou mudança
de contrato: só o status code mudava, então quem lia o corpo não distinguia
primeiro envio de reenvio. Entrou o campo `jaExistia`.

A chave exibida no exemplo é `chave-de-desenvolvimento`, que já está no
`.env.example` e no `docker-compose.yml` deste repositório. Não é credencial: é
o valor padrão de desenvolvimento, e a descrição diz isso e diz para trocar
fora da máquina local.

O agente inverteu a ordem pedida e fez o README por último, para os exemplos de
teste apontarem para fixtures que já existissem.
