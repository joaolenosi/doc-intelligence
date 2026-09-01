# Sessão 03 — nome padronizado e domínio

**Data:** 31/08 · **Agente:** Claude Code (Opus 5)
**Resultado:** as três questões do nome padronizado fechadas na especificação,
ADR-012, migration dos motivos de revisão, teste de fronteira arquitetural e o
começo do domínio.

---

## Prompt 9

```
Pode manter os dois acréscimos. A restrição que impede registrar uma tentativa sem sucesso e sem código de erro faz sentido, porque sem ela a taxa de falha do fornecedor viraria um conjunto de linhas sem motivo registrado, e essa é justamente uma das informações que eu quero conseguir extrair depois. O índice parcial também fica, pelo motivo que você descreveu.

Sobre o template com marcadores, concordo que ficou melhor do que a descrição em prosa, mas ele abre duas questões que prefiro resolver agora e não durante a implementação.

A primeira é o comportamento quando o template referencia um campo que não foi extraído. Se o número da identidade não veio, o marcador fica sem valor, e não quero nem gerar um nome incompleto nem interromper o processamento. Nesse caso, o documento deve ir para conferência humana, que é exatamente a situação prevista pela política de confiança, e o motivo precisa ficar registrado indicando qual marcador ficou sem valor. Além disso, quero validação na leitura do catálogo: se o template usar um marcador que não corresponde a nenhum campo daquele tipo nem a um dos embutidos, isso é erro de configuração e precisa ser sinalizado.

A segunda é o tratamento do valor antes de ele entrar no nome. Os campos vêm de extração sobre imagem, então podem conter acento, espaço duplo, quebra de linha e caracteres que não podem compor um nome de arquivo. Prefiro uma normalização explícita, com a regra descrita na especificação e coberta por teste, em vez de deixar essa decisão para o momento da implementação.

Tem uma terceira questão que percebi olhando o template. O nome sugerido é montado a partir dos campos extraídos, então ele carrega o nome e a data da pessoa. Isso significa que ele também está sujeito ao fato (d) e não pode aparecer em log em nenhuma hipótese, mesmo sendo o resultado principal do serviço. Preciso decidir também se ele aparece na listagem ou apenas no detalhe, já que a listagem foi definida como a rota que não devolve valor extraído e o nome sugerido é composto exatamente por esses valores.

Pode seguir para o domínio. Prefiro que o teste de fronteira arquitetural entre já no primeiro commit desta etapa, porque ele precisa estar valendo enquanto o domínio é escrito e não depois. Domínio e aplicação sem dependência de framework, casos de uso instanciáveis diretamente no teste, e a ligação entre porta e adaptador ficando nos módulos da infraestrutura. Seguimos com um commit por etapa, na ordem em que o trabalho acontecer.
```

**Contexto, escrito depois.** A terceira questão é minha e não do agente, e é a
que eu considero mais valiosa das três. O nome sugerido parece identificador
técnico e carrega exatamente a mesma informação que `cae_valor`. Virou o
ADR-012.

O agente respondeu acrescentando uma regra que eu não tinha pedido e que aceitei:
o template só pode referenciar marcador embutido ou campo obrigatório daquele
tipo. Isso faz a regra do nome e a política de confiança nunca discordarem, em
vez de deixarem duas fontes de verdade sobre o mesmo caso.

## Prompt 10

```
PODE SEGUIR.
```

## Prompt 11

```
LEMBRE-SE DE DOCUMENTAR TODOS OS MEUS PROMPTS E IR DANDO COMMIT E PUSH POR ETAPAS
```

**Contexto, escrito depois.** Precisei cobrar. O `CLAUDE.md` manda o agente me
lembrar de registrar o prompt antes de seguir para a próxima tarefa, e ele
deixou de fazer isso nos prompts 9 e 10, seguindo direto para o trabalho. Está
anotado em `docs/uso-de-ia.md`.

## Prompt 12

```
pode seguir com as políticas e as entidades
```

## Prompt 13

```
Podee manter essa implementacao, e vamos seguir para etapa 3.
```
