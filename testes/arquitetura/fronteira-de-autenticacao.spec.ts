import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { arquivosTs } from './detector-de-import';

const RAIZ = join(__dirname, '..', '..');

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

  it('so o controller de saude fica fora da fronteira', () => {
    expect(comExcecao.map((a) => a.replace(`${RAIZ}/`, ''))).toEqual([
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

  it('a documentacao nao mora na raiz', () => {
    const documentacao = readFileSync(
      join(RAIZ, 'src/infraestrutura/http/documentacao.ts'),
      'utf8',
    );
    expect(documentacao).toMatch(/CAMINHO_DA_DOCUMENTACAO = 'v1\/docs'/);
  });

  // Se um dia entrar, precisa entrar protegida ou com excecao declarada, e este
  // teste e o lembrete de que a decisao passa por aqui.
  it('todo controller declarado esta sob o guard, exceto os listados acima', () => {
    const controllers = arquivos.filter((arquivo) =>
      /@Controller\(/.test(readFileSync(arquivo, 'utf8')),
    );
    expect(controllers.length).toBeGreaterThan(0);
    expect(controllers.length - comExcecao.length).toBe(controllers.length - 1);
  });
});
