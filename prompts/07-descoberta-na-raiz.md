# Sessão 07 — descoberta de endpoints na raiz

**Data:** 01/09 · **Agente:** Claude Code (Opus 5)

---

## Prompt 22

```
AGORA vamos trocar o endpoint da raiz para retornar os links dos endpoihnts: healthz e /v1/docs para facilidar a desocberta dos endpoints, igual a pi do gihub. e lembre-se de documentar o prompt
```

**Contexto, escrito depois.** Isto reverte o que eu tinha pedido duas sessões
antes, quando disse que a raiz podia continuar em 404 e que eu não queria rota
nem redirecionamento ali. Mudei de ideia depois de ver o 404 na prática: ele
resolve o problema de não ter rota escondida, e não resolve o de alguém abrir o
serviço e não saber para onde ir.

O agente registrou a mudança como revisão no ADR-013, com a data e o motivo, em
vez de reescrever a decisão original. É o comportamento que o `CLAUDE.md` exige,
e é o que eu quero que o histórico mostre: a decisão mudou, e dá para ver quando
e por quê.

Dois testes quebraram com a mudança, o de contrato e o de fronteira de
autenticação, e os dois estavam certos em quebrar.
