/**
 * Monta o que um erro pode carregar para o log.
 *
 * Existe por causa de uma coisa que eu verifiquei em vez de supor. Numa
 * violacao de restricao, o Postgres devolve dois textos: `message`, que diz
 * qual restricao falhou, e `detail`, que diz "Failing row contains (...)" com a
 * linha inteira. Numa linha de `campo_extraido`, essa linha inteira e o dado
 * pessoal do fato (d); numa de `documento`, e o nome sugerido, que o ADR-012
 * coloca na mesma categoria.
 *
 * Hoje o TypeORM nao copia `detail` para `message`, entao nada vazava. Mas isso
 * era sorte, e nao desenho: bastava alguem logar o erro inteiro, ou o TypeORM
 * mudar de ideia numa versao, para o dado sair.
 *
 * Por isso este arquivo monta a saida por lista de permissao, e nunca repassa o
 * erro. De erro de banco saem `codigo` e `restricao`, que sao mais uteis para
 * diagnostico do que a frase e sao comprovadamente livres de valor. A mensagem
 * so sai de erro que nao veio do driver, porque essas mensagens sao escritas
 * por nos.
 */
export interface ErroDescrito {
  readonly erro: string;
  readonly codigo?: string;
  readonly restricao?: string;
  readonly mensagem?: string;
}

interface ErroDeDriver {
  code?: string;
  constraint?: string;
  detail?: string;
}

export function descreverErro(erro: unknown): ErroDescrito {
  if (erro === null || typeof erro !== 'object') {
    return { erro: 'ErroDesconhecido' };
  }

  const bruto = erro as Error & { codigo?: string; driverError?: ErroDeDriver };
  const driver = bruto.driverError;

  if (driver !== undefined) {
    // Erro vindo do banco. Nem `message` nem `detail` entram: `detail` carrega
    // a linha inteira, e `message` so nao carrega porque a versao atual do
    // TypeORM nao a copia.
    return {
      erro: bruto.name ?? 'QueryFailedError',
      codigo: driver.code,
      restricao: driver.constraint,
    };
  }

  return {
    erro: bruto.name ?? 'Erro',
    codigo: bruto.codigo,
    mensagem: bruto.message,
  };
}

/** Log estruturado de falha, com o erro ja filtrado. */
export function registrarFalha(evento: string, erro: unknown, extra: Record<string, unknown> = {}): void {
  console.error(JSON.stringify({ evento, ...extra, ...descreverErro(erro) }));
}
