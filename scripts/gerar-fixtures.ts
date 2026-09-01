import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

/**
 * Gera os arquivos ficticios de `fixtures/`.
 *
 * Gerados por script, e nao commitados a mao, por dois motivos. Arquivo binario
 * escrito a mao ninguem revisa, e ninguem sabe dizer o que tem dentro. E o
 * enunciado proibe dado real de cliente: com um gerador, da para provar por
 * leitura de codigo que nao existe nada real aqui.
 *
 * Todo nome de pessoa e inventado e todo numero de documento reprova em
 * validacao de digito, de proposito. Ver `fixtures/README.md`.
 *
 * Sobre o que estes arquivos sao e o que eles nao sao: eles sao validos nos
 * bytes, entao a inspecao os classifica como um cliente classificaria. Eles nao
 * sao fotografias de documentos, e um fornecedor real precisaria de
 * digitalizacoes plausiveis. Isso esta registrado como limitacao no README do
 * diretorio.
 *
 * Os positivos embutem `TIPO-FIXTURE: <CODIGO>` no texto. O duble le esse
 * marcador para classificar, porque sem ele o tipo saia do hash e
 * `rg-frente.jpeg` virava comprovante de residencia: nao quebrava nada, mas
 * fazia a demonstracao mentir na primeira impressao.
 */

const DESTINO = join(__dirname, '..', 'fixtures');

// ---------------------------------------------------------------------------
// Blocos de construcao
// ---------------------------------------------------------------------------

/** JPEG 1x1 valido, em base64. Serve de casca para o comentario abaixo. */
const JPEG_MINIMO = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
    'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA' +
    'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  'base64',
);

/**
 * Insere um segmento COM (comentario) no JPEG.
 *
 * E o que faz cada fixture ter conteudo diferente, e portanto hash diferente,
 * sem precisar de um codificador de imagem. O texto do comentario e legivel com
 * qualquer editor, o que ajuda quem for conferir que nao ha dado real.
 */
function jpegComTexto(texto: string): Buffer {
  const conteudo = Buffer.from(`${texto}\n`, 'utf8');
  const tamanho = conteudo.length + 2;
  const segmento = Buffer.concat([
    Buffer.from([0xff, 0xfe, (tamanho >> 8) & 0xff, tamanho & 0xff]),
    conteudo,
  ]);
  // Depois de SOI (os dois primeiros bytes), que e onde um COM pode aparecer.
  return Buffer.concat([JPEG_MINIMO.subarray(0, 2), segmento, JPEG_MINIMO.subarray(2)]);
}

const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabela[n] = c >>> 0;
  }
  return tabela;
})();

function crc32(dados: Buffer): number {
  let c = 0xffffffff;
  for (const byte of dados) c = TABELA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pedacoPng(tipo: string, dados: Buffer): Buffer {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([tamanho, corpo, crc]);
}

/** PNG valido, cinza, com um pedaco tEXt carregando a descricao ficticia. */
function png(largura: number, altura: number, texto: string): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8; // profundidade
  ihdr[9] = 0; // escala de cinza
  const linhas: Buffer[] = [];
  for (let y = 0; y < altura; y += 1) {
    const linha = Buffer.alloc(largura + 1);
    // Um degrade simples, so para o arquivo nao ser um bloco de zeros.
    linha.fill(200 - Math.floor((y / altura) * 60), 1);
    linhas.push(linha);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pedacoPng('IHDR', ihdr),
    pedacoPng('tEXt', Buffer.from(`Description\0${texto}`, 'latin1')),
    pedacoPng('IDAT', deflateSync(Buffer.concat(linhas))),
    pedacoPng('IEND', Buffer.alloc(0)),
  ]);
}

/** PDF de uma pagina, com o texto visivel em qualquer leitor. */
function pdf(linhas: string[]): Buffer {
  const escapar = (texto: string) => texto.replace(/([()\\])/g, '\\$1');
  const conteudo = [
    'BT',
    '/F1 12 Tf',
    '60 760 Td',
    '16 TL',
    ...linhas.map((linha) => `(${escapar(linha)}) Tj T*`),
    'ET',
  ].join('\n');

  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let corpo = '%PDF-1.4\n';
  const posicoes: number[] = [];
  objetos.forEach((objeto, indice) => {
    posicoes.push(corpo.length);
    corpo += `${indice + 1} 0 obj\n${objeto}\nendobj\n`;
  });

  const inicioXref = corpo.length;
  corpo += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const posicao of posicoes) corpo += `${String(posicao).padStart(10, '0')} 00000 n \n`;
  corpo += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;

  return Buffer.from(corpo, 'latin1');
}

/**
 * HEIC reconhecivel pela inspecao.
 *
 * Carrega uma caixa `ftyp` com marca `heic`, que e como a foto original de
 * iPhone chega. Nao e uma imagem decodificavel, e serve para exercitar a
 * aceitacao do formato: converter HEIC de verdade exigiria dependencia nativa,
 * que esta registrada como nao implementada.
 */
function heic(texto: string): Buffer {
  const marca = Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x18]),
    Buffer.from('ftypheic', 'ascii'),
    Buffer.from([0x00, 0x00, 0x00, 0x00]),
    Buffer.from('mif1heic', 'ascii'),
  ]);
  const dados = Buffer.from(texto, 'utf8');
  const caixa = Buffer.alloc(8);
  caixa.writeUInt32BE(dados.length + 8);
  caixa.write('mdat', 4, 'ascii');
  return Buffer.concat([marca, caixa, dados]);
}

/** Cabecalho OLE2, que e o que um .doc antigo de verdade tem. */
function doc(texto: string): Buffer {
  return Buffer.concat([
    Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    Buffer.alloc(24),
    Buffer.from(texto, 'utf8'),
    Buffer.alloc(512),
  ]);
}

// ---------------------------------------------------------------------------
// Os arquivos
// ---------------------------------------------------------------------------

export interface Fixture {
  readonly arquivo: string;
  readonly conteudo: Buffer;
  /** O que a inspecao deve concluir. `undefined` quer dizer recusa com 415. */
  readonly tipoMidiaEsperado?: string;
  readonly descricao: string;
}

export function montarFixtures(): Fixture[] {
  return [
    {
      arquivo: 'rg-frente.jpeg',
      conteudo: jpegComTexto(
        [
          'DOCUMENTO FICTICIO PARA TESTE, SEM VALIDADE',
          'TIPO-FIXTURE: RG',
          'REGISTRO GERAL',
          'NOME: MARIA FICTICIA DE SOUZA',
          'FILIACAO: JOAO INVENTADO DA COSTA; ANA EXEMPLO PEREIRA',
          'DATA DE NASCIMENTO: 1988-03-14',
          'NUMERO: 000000000',
          'ORGAO EMISSOR: SSP/RN',
        ].join('\n'),
      ),
      tipoMidiaEsperado: 'image/jpeg',
      descricao: 'Identidade fotografada. O caso comum do balcao e do WhatsApp.',
    },
    {
      arquivo: 'comprovante-residencia.png',
      conteudo: png(
        320,
        200,
        'TIPO-FIXTURE: COMPROVANTE_RESIDENCIA. Conta de consumo ficticia. TITULAR: CARLOS TESTE DE ALMEIDA. ENDERECO: RUA FICTICIA 123, BAIRRO INVENTADO. REFERENCIA: 2026-07.',
      ),
      tipoMidiaEsperado: 'image/png',
      descricao: 'Captura de tela de conta de consumo, que chega bastante por e-mail.',
    },
    {
      arquivo: 'procuracao-registro-casa.pdf',
      conteudo: pdf([
        'DOCUMENTO FICTICIO PARA TESTE, SEM VALIDADE JURIDICA',
        'TIPO-FIXTURE: DESCONHECIDO',
        '',
        'PROCURACAO PARA REGISTRO DE IMOVEL',
        '',
        'OUTORGANTE: MARIA FICTICIA DE SOUZA, RG 000000000 SSP/RN',
        'OUTORGADO: JOAO INVENTADO DA COSTA, RG 111111111 SSP/SP',
        '',
        'Imovel: RUA FICTICIA 123, BAIRRO INVENTADO, cidade de exemplo.',
        'Finalidade: representar o outorgante em registro de imovel.',
        '',
        'Este arquivo foi gerado por scripts/gerar-fixtures.ts e nao',
        'corresponde a nenhuma pessoa ou imovel real.',
      ]),
      tipoMidiaEsperado: 'application/pdf',
      descricao: 'Procuracao em PDF, o caso de documento longo com varias pessoas citadas.',
    },
    {
      arquivo: 'contracheque-2026-07.pdf',
      conteudo: pdf([
        'DOCUMENTO FICTICIO PARA TESTE, SEM VALIDADE',
        'TIPO-FIXTURE: CONTRACHEQUE',
        '',
        'DEMONSTRATIVO DE PAGAMENTO',
        '',
        'NOME: ANA EXEMPLO PEREIRA',
        'COMPETENCIA: 2026-07',
        'VALOR LIQUIDO: 3.412,00',
        '',
        'Empresa ficticia de exemplo, CNPJ 00.000.000/0000-00.',
      ]),
      tipoMidiaEsperado: 'application/pdf',
      descricao: 'Contracheque, que e o tipo com campo de valor e competencia.',
    },
    {
      arquivo: 'identidade-foto-iphone.heic',
      conteudo: heic(
        'TIPO-FIXTURE: RG. Foto ficticia de identidade, no formato que a camera do iPhone produz por padrao.',
      ),
      tipoMidiaEsperado: 'image/heic',
      descricao:
        'HEIC, que e como a foto original de iPhone chega. Aceito pelo contrato; a conversao nao esta implementada.',
    },
    {
      arquivo: 'rg-reenvio.jpeg',
      conteudo: jpegComTexto(
        [
          'DOCUMENTO FICTICIO PARA TESTE, SEM VALIDADE',
          'TIPO-FIXTURE: RG',
          'REGISTRO GERAL',
          'NOME: MARIA FICTICIA DE SOUZA',
          'FILIACAO: JOAO INVENTADO DA COSTA; ANA EXEMPLO PEREIRA',
          'DATA DE NASCIMENTO: 1988-03-14',
          'NUMERO: 000000000',
          'ORGAO EMISSOR: SSP/RN',
        ].join('\n'),
      ),
      tipoMidiaEsperado: 'image/jpeg',
      descricao:
        'Copia byte a byte de rg-frente.jpeg, com outro nome. E o reenvio do fato (c): mesmo hash, submissao nova, nenhuma chamada paga.',
    },
    {
      arquivo: 'contrato-locacao.doc',
      conteudo: doc('Contrato ficticio de locacao, em formato Word antigo.'),
      descricao:
        'Formato nao aceito. Recusado com 415 antes de custar uma chamada, mesmo sendo um documento de verdade do ponto de vista do escritorio.',
    },
    {
      arquivo: 'rg-que-e-word.jpeg',
      conteudo: doc('Word disfarcado de imagem, para o caso do fato (b).'),
      descricao:
        'A extensao mente. Os bytes sao de Word e o nome diz JPEG: recusado com 415, porque o tipo sai do conteudo e nunca do nome.',
    },
  ];
}

if (require.main === module) {
  mkdirSync(DESTINO, { recursive: true });
  for (const fixture of montarFixtures()) {
    const caminho = join(DESTINO, fixture.arquivo);
    writeFileSync(caminho, fixture.conteudo);
    const hash = createHash('sha256').update(fixture.conteudo).digest('hex');
    console.log(
      `${fixture.arquivo.padEnd(32)} ${String(fixture.conteudo.length).padStart(7)} bytes  ${hash.slice(0, 12)}`,
    );
  }
  console.log(`\ngerados em ${DESTINO}`);
}
