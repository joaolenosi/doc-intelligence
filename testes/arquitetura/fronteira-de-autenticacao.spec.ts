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
   * O enunciado diz que o servico e consumido por sistemas internos e nao por
   * navegador anonimo. Rota de documentacao publica e o caminho mais comum de
   * um servico interno virar um mapa aberto do que ele expoe, e ela costuma
   * nascer fora do guard porque a ferramenta a registra sozinha.
   */
  it('nao expoe documentacao OpenAPI', () => {
    const pacote = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8'));
    const dependencias = { ...pacote.dependencies, ...pacote.devDependencies };
    expect(Object.keys(dependencias).filter((nome) => nome.includes('swagger'))).toEqual([]);

    const usaSwagger = arquivos.filter((arquivo) =>
      /SwaggerModule|DocumentBuilder/.test(readFileSync(arquivo, 'utf8')),
    );
    expect(usaSwagger).toEqual([]);
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
