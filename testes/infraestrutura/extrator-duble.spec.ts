import {
  FalhaTransitoriaDoExtrator,
} from '../../src/aplicacao/erros/erros-de-aplicacao';
import { ExtratorDeDocumento } from '../../src/aplicacao/portas/extrator-de-documento.porta';
import { PROMPTS } from '../../src/infraestrutura/ia/catalogo-de-prompts';
import { ExtratorDuble } from '../../src/infraestrutura/ia/duble/extrator-duble.adapter';
import { ExtratorComTimeout } from '../../src/infraestrutura/ia/extrator-com-timeout.adapter';

const entrada = (texto = 'bytes ficticios de um documento') => ({
  conteudo: new TextEncoder().encode(texto),
  tipoMidia: 'image/jpeg',
});

describe('ExtratorDuble', () => {
  // O enunciado autoriza um duble que devolve sempre a mesma resposta, e o
  // teste ponta a ponta so e estavel se ele devolver mesmo.
  it('e deterministico: o mesmo conteudo produz o mesmo resultado', async () => {
    const duble = new ExtratorDuble({ modo: 'SUCESSO' });
    const primeiro = await duble.extrair(entrada());
    const segundo = await duble.extrair(entrada());
    expect(segundo).toEqual(primeiro);
  });

  it('conteudos diferentes produzem resultados diferentes', async () => {
    const duble = new ExtratorDuble({ modo: 'SUCESSO' });
    const a = await duble.extrair(entrada('documento a'));
    const b = await duble.extrair(entrada('documento b'));
    expect(a).not.toEqual(b);
  });

  // Fato (f): sem isso, nao da para provar o que mudou quando a extracao piorar.
  it('carrega provedor, modelo e versao de prompt em todo resultado', async () => {
    const resultado = await new ExtratorDuble({ modo: 'SUCESSO' }).extrair(entrada());
    expect(resultado.provedor).toBe('duble');
    expect(resultado.modelo).toBe('duble-deterministico-1');
    expect(resultado.versaoPrompt).toMatch(/\.v\d+$/);
    expect(resultado.custoEstimado).toBeGreaterThan(0);
  });

  it('devolve os campos que o tipo classificado exige', async () => {
    const resultado = await new ExtratorDuble({ modo: 'SUCESSO' }).extrair(entrada());
    expect(resultado.campos.length).toBeGreaterThan(0);
    for (const campo of resultado.campos) {
      expect(campo.valor.trim().length).toBeGreaterThan(0);
      expect(campo.confianca).toBeGreaterThanOrEqual(0);
      expect(campo.confianca).toBeLessThanOrEqual(1);
    }
  });

  /**
   * Fato (d). Se um identificador daqui fosse valido, ele acabaria colado em
   * documentacao, em exemplo de README ou num teste, e passaria a parecer dado
   * real de alguem.
   */
  it('so usa identificadores invalidos de proposito', async () => {
    const duble = new ExtratorDuble({ modo: 'SUCESSO' });
    const numeros = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      const resultado = await duble.extrair(entrada(`documento ${i}`));
      const numero = resultado.campos.find((campo) => campo.nome === 'numero');
      if (numero !== undefined) numeros.add(numero.valor);
    }
    for (const numero of numeros) {
      // Sequencia repetida ou trivial. Nenhum passa em validacao de digito.
      expect(numero).toMatch(/^(0{9}|1{9}|9{9}|123456789)$/);
    }
  });

  describe('modo BAIXA_CONFIANCA', () => {
    // E o caso do ADR-007: media alta escondendo o campo que importa.
    it('derruba um campo abaixo do limiar e mantem os outros altos', async () => {
      const resultado = await new ExtratorDuble({ modo: 'BAIXA_CONFIANCA' }).extrair(entrada());
      const confiancas = resultado.campos.map((campo) => campo.confianca);
      expect(Math.min(...confiancas)).toBeLessThan(0.85);
      expect(confiancas.filter((c) => c < 0.85)).toHaveLength(1);
    });
  });

  describe('modo FALHA_TRANSITORIA', () => {
    // Falha duas vezes e acerta na terceira: exercita o retry sem terminar
    // sempre em FAILED, que e o caminho mais interessante do fato (a).
    it('falha duas vezes e acerta na terceira', async () => {
      const duble = new ExtratorDuble({ modo: 'FALHA_TRANSITORIA' });
      await expect(duble.extrair(entrada())).rejects.toBeInstanceOf(FalhaTransitoriaDoExtrator);
      await expect(duble.extrair(entrada())).rejects.toBeInstanceOf(FalhaTransitoriaDoExtrator);
      await expect(duble.extrair(entrada())).resolves.toBeDefined();
    });
  });

  describe('modo LENTO', () => {
    it('espera entre 5 e 40 segundos, que e a faixa do fato (a)', async () => {
      const esperas: number[] = [];
      const duble = new ExtratorDuble({
        modo: 'LENTO',
        dormir: async (ms) => {
          esperas.push(ms);
        },
      });
      await duble.extrair(entrada());
      expect(esperas[0]).toBeGreaterThanOrEqual(5000);
      expect(esperas[0]).toBeLessThanOrEqual(40_000);
    });
  });
});

describe('ExtratorComTimeout', () => {
  it('deixa passar a resposta que chega dentro do limite', async () => {
    const rapido: ExtratorDeDocumento = {
      extrair: async () => new ExtratorDuble({ modo: 'SUCESSO' }).extrair(entrada()),
    };
    await expect(new ExtratorComTimeout(rapido, 1000).extrair(entrada())).resolves.toBeDefined();
  });

  // O modo TIMEOUT do duble nunca resolve. Quem corta e este adaptador, porque
  // timeout e responsabilidade dele e nao do caso de uso. Ver ADR-005.
  it('corta o que nao responde, como falha transitoria', async () => {
    const travado = new ExtratorDuble({ modo: 'TIMEOUT' });
    const comLimite = new ExtratorComTimeout(travado, 30);

    await expect(comLimite.extrair(entrada())).rejects.toMatchObject({
      name: 'FalhaTransitoriaDoExtrator',
      codigo: 'TIMEOUT',
    });
  });

  // Sem limpar o temporizador, o processo fica de pe esperando o relogio de
  // cada chamada que respondeu rapido, e o worker nao encerra.
  it('limpa o temporizador quando a resposta chega antes', async () => {
    const rapido: ExtratorDeDocumento = { extrair: async () => ({} as never) };
    const espiao = jest.spyOn(global, 'clearTimeout');
    await new ExtratorComTimeout(rapido, 60_000).extrair(entrada());
    expect(espiao).toHaveBeenCalled();
    espiao.mockRestore();
  });
});

describe('catalogo de prompts', () => {
  // Fato (f): o identificador gravado em pro_versao_prompt precisa amarrar o
  // resultado ao texto exato que o produziu.
  it('carrega os prompts com identificador e hash do conteudo', () => {
    expect(PROMPTS.extracaoRg.identificador).toBe('extracao-rg.v1');
    expect(PROMPTS.classificacao.identificador).toBe('classificacao.v1');
    expect(PROMPTS.extracaoRg.hash).toMatch(/^[0-9a-f]{12}$/);
    expect(PROMPTS.extracaoRg.conteudo).toContain('confianca');
  });

  it('cabe na coluna pro_versao_prompt, que tem 50 caracteres', () => {
    for (const prompt of Object.values(PROMPTS)) {
      expect(prompt.identificador.length).toBeLessThanOrEqual(50);
    }
  });
});
