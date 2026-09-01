import { readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { arquivosTs } from './detector-de-import';

const RAIZ = join(__dirname, '..', '..');

/**
 * O caminho sai relativo a raiz e sempre com barra normal.
 *
 * A versao anterior recortava o prefixo com `replace(RAIZ + '/')`, o que assume
 * que o separador e a barra. No Windows o separador e a contrabarra, o recorte
 * nao acontecia, e a comparacao virava caminho absoluto contra caminho
 * relativo: este teste falhava na maquina de quem clonasse o repositorio no
 * Windows, e passava no Docker, que e onde ele costumava ser rodado.
 */
const caminhoRelativo = (arquivo: string): string =>
  relative(RAIZ, arquivo).split(sep).join('/');

/**
 * O guard e global, entao rota nova nasce protegida. A protecao real esta em
 * quantas rotas se declaram fora dele.
 *
 * Este teste existe porque a excecao e barata de acrescentar e cara de
 * perceber: um `@SemAutenticacao` num controller novo nao quebra nada, nao
 * aparece em revisao apressada, e abre a rota para a internet. Aqui ele quebra
 * a suite e obriga alguem a justificar.
 */
describe('fronteira de autenticacao', () => {
  const arquivos = arquivosTs(join(RAIZ, 'src'));
  const comExcecao = arquivos.filter((arquivo) =>
    /@SemAutenticacao\(\)/.test(readFileSync(arquivo, 'utf8')),
  );

  /**
   * Duas excecoes, e as duas declaradas. Este teste ja exigiu uma so, e quebrou
   * quando a raiz virou rota de descoberta: era para isso que ele servia.
   *
   * As duas tem a mesma justificativa: elas nao devolvem dado de documento
   * nenhum, e exigir chave nelas trocaria o proposito de cada uma por um 401. A
   * lista e literal de proposito, para uma terceira excecao nao entrar sem
   * alguem escrever o nome dela aqui.
   */
  it('so a saude e a raiz ficam fora da fronteira', () => {
    expect(comExcecao.map(caminhoRelativo).sort()).toEqual([
      'src/infraestrutura/http/raiz.controller.ts',
      'src/infraestrutura/http/saude.controller.ts',
    ]);
  });

  /**
   * A documentacao existe e fica aberta, e isso e escolha registrada no
   * ADR-013, e nao consequencia.
   *
   * Este teste ja afirmou o contrario: ele exigia que nao houvesse OpenAPI
   * nenhuma no projeto, e quebrou quando o Swagger entrou. Era para isso que
   * ele servia, e por isso ele foi reescrito em vez de apagado. O que ele
   * protege agora e a parte que continua valendo: a rota do Swagger nao passa
   * pelo guard, entao ela so pode subir quando alguem liga explicitamente.
   */
  it('a documentacao nasce desligada, para nao ficar aberta por default', () => {
    const configuracao = readFileSync(
      join(RAIZ, 'src/infraestrutura/config/configuracao.ts'),
      'utf8',
    );
    // O padrao e a string 'false': um ambiente que esqueca a variavel nasce
    // fechado, em vez de nascer exposto.
    expect(configuracao).toMatch(/texto\('DOCS_HABILITADO', 'false'\)/);
  });

  // A raiz lista endpoints, e a documentacao continua morando em caminho
  // proprio: sao coisas diferentes, e misturar as duas faria a raiz servir uma
  // pagina em vez de um indice.
  it('a documentacao nao mora na raiz', () => {
    const documentacao = readFileSync(
      join(RAIZ, 'src/infraestrutura/http/documentacao.ts'),
      'utf8',
    );
    expect(documentacao).toMatch(/CAMINHO_DA_DOCUMENTACAO = 'v1\/docs'/);
  });

  // Se um dia entrar, precisa entrar protegida ou com excecao declarada, e este
  // teste e o lembrete de que a decisao passa por aqui.
  it('todo controller que serve dado de documento esta sob o guard', () => {
    const controllers = arquivos.filter((arquivo) =>
      /@Controller\(/.test(readFileSync(arquivo, 'utf8')),
    );
    expect(controllers.length).toBeGreaterThan(0);
    // Sobra o que serve documento. Se um controller novo nascer isento, esta
    // conta muda e o teste acima aponta o arquivo.
    expect(controllers.length - comExcecao.length).toBe(controllers.length - 2);
  });
});
