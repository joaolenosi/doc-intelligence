# Sessão 04 — infraestrutura

**Data:** 01/09 · **Agente:** Claude Code (Opus 5)

---

## Prompt 14

```
Pode seguir e no final  vamos criar uma pasta fuxtures  e criar alguns arquivos fakes simulando arquivos reais que clientes enviariam para o escritorio, ai voce pode variar entrer .pdf .doc, .png por exemplo? rg.jpeg proucaracao-registro-casa.pdf
```

**Contexto, escrito depois.** O `.doc` do pedido não é um tipo aceito pelo
contrato, e por isso ele entrou como fixture **negativo**, de propósito: serve
para exercitar o `415` e o caso do fato (b) em que a extensão mente sobre o
conteúdo. Está anotado no README do diretório de fixtures.

## Prompt 15

```
Agora siga pelos adaptadores de persistência e va dando commit a medida que for sendo construido e documentando nossos prompts
```

**Contexto, escrito depois.** Os adaptadores de persistência já tinham entrado
no commit anterior, com os onze testes de integração contra o Postgres. O agente
apontou isso em vez de refazer, e seguiu para o que faltava: o dublê, os dois
adaptadores de fila e a camada HTTP.
