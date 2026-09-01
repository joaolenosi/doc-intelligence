# ADR-012: O nome sugerido é dado pessoal

**Status:** aceita, 31/08/2026

## Contexto

O comportamento 2 do produto termina em "propor um nome padronizado para o
arquivo". É o resultado mais visível do serviço, e o que substitui a parte do
trabalho manual em que uma pessoa renomeia o arquivo num padrão interno.

Ele é montado a partir dos campos extraídos. `RG_MARIA_DA_SILVA_123456789_2026-08-31.jpg`
contém nome completo, número de documento e data. O fato (d) diz que o conteúdo
desses documentos é dado pessoal e parte dele é sensível.

O problema é de percepção, e não de classificação. `cae_valor` parece dado
pessoal e é tratado como tal sem esforço. O nome sugerido parece um
identificador técnico, um nome de arquivo, uma string de sistema. As duas coisas
carregam exatamente a mesma informação.

## Decisão

O nome sugerido recebe o mesmo tratamento que `cae_valor`.

Nunca aparece em log, em nenhum nível, nem em mensagem de erro, nem em evento de
auditoria. E não aparece na listagem de documentos, quando ela existir: a
listagem devolve identificador, estado, tipo e datas, e quem precisa do nome
consulta o documento específico.

## Alternativas consideradas

**Devolver o nome sugerido na listagem.** É a opção mais útil de todas, e por uma
margem grande: a listagem existe para alguém ver o que foi processado, e o nome
é o produto. Descartada porque a regra da listagem foi definida como não devolver
valor de campo extraído, por causa do fato (d), e um nome composto exatamente
desses valores não pode ser a exceção. Uma regra de proteção de dado pessoal com
uma exceção conveniente é uma regra que não vale.

O custo é real e eu não vou fingir que não é: quem consome precisa de uma
chamada por documento para montar uma tela que mostre nomes. Num pico de 800
documentos isso é 800 chamadas em vez de algumas. Este serviço aguenta, e a
alternativa era vazar dado pessoal numa rota desenhada para não vazar.

**Devolver o nome em forma reduzida na listagem,** por exemplo `RG_M****_2026-08-31`.
Descartada porque mascaramento parcial de nome próprio junto com tipo de
documento e data reidentifica com facilidade em um universo pequeno como a
carteira de clientes de um escritório, e porque produziria uma segunda forma do
nome que alguém acabaria adotando como se fosse a real.

**Permitir o nome em log de nível `debug`,** que é onde essas coisas costumam
aparecer. Descartada porque nível de log é configuração, e configuração muda em
produção às três da manhã por alguém depurando um incidente. A regra só vale se
não tiver nível em que ela relaxa.

## Consequências

A listagem, que já não está implementada, nasce com uma limitação escrita antes
de existir. Isso importa: sem este registro, quem implementá-la depois vai
colocar o nome sugerido na resposta por ser óbvio e útil, e não vai perceber que
está furando a regra do fato (d).

`doc_nome_sugerido` fica no mesmo grupo de colunas que `cae_valor` para efeito
de retenção e de cifragem em repouso, quando essas existirem. Uma política que
apague os campos extraídos e deixe o nome sugerido não teria apagado nada.

O teste que verifica que nenhum valor de campo aparece em log passa a verificar
o nome sugerido também, e é barato porque é o mesmo teste.
