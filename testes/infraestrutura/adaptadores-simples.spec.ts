import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ArquivoRecusado } from '../../src/aplicacao/erros/erros-de-aplicacao';
import { ArmazenamentoEmDisco } from '../../src/infraestrutura/armazenamento/armazenamento-em-disco.adapter';
import { CalculadoraSha256 } from '../../src/infraestrutura/comum/calculadora-sha256.adapter';
import { InspetorMagicBytes } from '../../src/infraestrutura/inspecao/inspetor-magic-bytes.adapter';

const bytes = (...valores: number[]) => new Uint8Array(valores);
const comCabecalho = (cabecalho: number[], tamanho = 64) =>
  new Uint8Array([...cabecalho, ...new Array(tamanho).fill(0)]);

const JPEG = comCabecalho([0xff, 0xd8, 0xff, 0xe0]);
const PNG = comCabecalho([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PDF = new Uint8Array([...new TextEncoder().encode('%PDF-1.7\n'), ...new Array(32).fill(0)]);
const HEIC = new Uint8Array([
  0x00, 0x00, 0x00, 0x18,
  ...new TextEncoder().encode('ftypheic'),
  ...new Array(32).fill(0),
]);

describe('InspetorMagicBytes', () => {
  const inspetor = new InspetorMagicBytes();

  it.each([
    ['JPEG', JPEG, 'image/jpeg'],
    ['PNG', PNG, 'image/png'],
    ['PDF', PDF, 'application/pdf'],
    ['HEIC', HEIC, 'image/heic'],
  ])('reconhece %s pelos bytes', (_caso, conteudo, esperado) => {
    expect(inspetor.inspecionar(conteudo)).toBe(esperado);
  });

  /**
   * O fato (b) diz que nao existe validacao nenhuma do lado de quem envia. O
   * tipo sai dos bytes, e nome, extensao e content-type informados sao metadado.
   */
  it('nao se importa com o que a extensao diz: bytes de JPEG sao JPEG', () => {
    expect(inspetor.inspecionar(JPEG)).toBe('image/jpeg');
  });

  it.each([
    ['executavel renomeado', comCabecalho([0x4d, 0x5a])],
    ['zip ou docx', comCabecalho([0x50, 0x4b, 0x03, 0x04])],
    ['texto puro', new TextEncoder().encode('isto nao e um documento')],
    ['vazio', new Uint8Array(0)],
    ['curto demais para ter assinatura', bytes(0xff)],
  ])('recusa %s antes de custar uma chamada', (_caso, conteudo) => {
    expect(() => inspetor.inspecionar(conteudo)).toThrow(ArquivoRecusado);
  });

  // Mensagem de erro vai para log, e conteudo de documento nao vai. Fato (d).
  it('nao ecoa o conteudo recebido na mensagem de erro', () => {
    const segredo = new TextEncoder().encode('MARIA DA SILVA 12345678900');
    expect(() => inspetor.inspecionar(segredo)).toThrow(/JPEG, PNG, HEIC nem PDF/);
    try {
      inspetor.inspecionar(segredo);
    } catch (erro) {
      expect((erro as Error).message).not.toContain('MARIA');
    }
  });
});

describe('CalculadoraSha256', () => {
  const calculadora = new CalculadoraSha256();

  it('produz o sha-256 conhecido de uma entrada conhecida', () => {
    // sha256("abc"), conferido contra o valor publico do algoritmo.
    expect(calculadora.calcular(new TextEncoder().encode('abc')).valor).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  // E o que sustenta a deduplicacao do fato (c): o mesmo arquivo reenviado com
  // outro nome tem o mesmo hash, porque o nome nao entra no calculo.
  it('depende so do conteudo', () => {
    const a = calculadora.calcular(new TextEncoder().encode('mesmo conteudo'));
    const b = calculadora.calcular(new TextEncoder().encode('mesmo conteudo'));
    const c = calculadora.calcular(new TextEncoder().encode('outro conteudo'));
    expect(a.valor).toBe(b.valor);
    expect(a.valor).not.toBe(c.valor);
  });
});

describe('ArmazenamentoEmDisco', () => {
  let diretorio: string;
  let armazenamento: ArmazenamentoEmDisco;

  beforeEach(async () => {
    diretorio = await mkdtemp(join(tmpdir(), 'doc-intelligence-'));
    armazenamento = new ArmazenamentoEmDisco(diretorio);
  });
  afterEach(async () => {
    await rm(diretorio, { recursive: true, force: true });
  });

  it('guarda e le o mesmo conteudo', async () => {
    const conteudo = new TextEncoder().encode('bytes ficticios de um RG');
    const chave = await armazenamento.guardar(conteudo, 'jpg');
    expect(Buffer.from(await armazenamento.ler(chave))).toEqual(Buffer.from(conteudo));
  });

  // A chave e gerada aqui e nunca recebida, entao nada que veio de fora vira
  // caminho. Fato (b).
  it('gera chave nova a cada gravacao, mesmo para o mesmo conteudo', async () => {
    const conteudo = new TextEncoder().encode('igual');
    const primeira = await armazenamento.guardar(conteudo, 'jpg');
    const segunda = await armazenamento.guardar(conteudo, 'jpg');
    expect(primeira.valor).not.toBe(segunda.valor);
  });

  it('le pelo UUID, sem depender da extensao gravada', async () => {
    const conteudo = new TextEncoder().encode('conteudo');
    const chave = await armazenamento.guardar(conteudo, 'pdf');
    expect(Buffer.from(await armazenamento.ler(chave))).toEqual(Buffer.from(conteudo));
  });
});
