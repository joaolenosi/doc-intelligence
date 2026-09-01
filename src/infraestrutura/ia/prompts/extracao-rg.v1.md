---
id: extracao-rg
versao: v1
tipo: RG
criado_em: 2026-09-01
---

Extraia os campos abaixo da carteira de identidade na imagem.

| Campo | O que é |
|---|---|
| `nome` | nome completo do titular, como está impresso |
| `filiacao` | nomes dos pais, separados por `;` |
| `dataNascimento` | no formato `AAAA-MM-DD` |
| `numero` | número do registro geral, só dígitos e letras |
| `orgaoEmissor` | sigla do órgão e UF, por exemplo `SSP/RN` |

Responda em JSON, sem texto em volta, com uma confiança por campo:

```json
{
  "campos": [
    { "nome": "nome", "valor": "...", "confianca": 0.96 }
  ]
}
```

Regras:

- Não invente valor. Campo que você não conseguiu ler fica de fora da lista.
- Não corrija o que está escrito. Se o nome está com erro de digitação no
  documento, transcreva com o erro.
- A confiança é por campo, e não do documento inteiro. Um campo borrado no meio
  de quatro campos nítidos precisa ter confiança baixa só ele.
