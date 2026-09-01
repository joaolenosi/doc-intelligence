import { ArquivoRecusado } from '../../aplicacao/erros/erros-de-aplicacao';
import { InspetorDeArquivo } from '../../aplicacao/portas/inspetor-de-arquivo.porta';

/**
 * Descobre o tipo do arquivo olhando os primeiros bytes.
 *
 * O fato (b) diz que nao existe validacao nenhuma do lado de quem envia: o nome
 * e o que a pessoa deu, a extensao pode ser qualquer uma e o content-type vem do
 * cliente. Nada disso entra em decisao. Um `.pdf` com bytes de JPEG e um JPEG, e
 * um executavel renomeado para `.jpg` e recusado antes de custar uma chamada.
 */

type Assinatura = { tipoMidia: string; casa: (bytes: Uint8Array) => boolean };

const comeca = (bytes: Uint8Array, prefixo: readonly number[]): boolean =>
  bytes.length >= prefixo.length && prefixo.every((valor, i) => bytes[i] === valor);

/**
 * HEIC e HEIF nao tem assinatura no byte zero: eles tem uma caixa `ftyp` a
 * partir do byte 4, e a marca vem logo depois. Foto original de iPhone chega
 * assim, e o fato (b) diz "a foto original da camera".
 */
const MARCAS_HEIF: readonly string[] = ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'heim'];

function marcaHeif(bytes: Uint8Array): string | undefined {
  if (bytes.length < 12) return undefined;
  const ftyp = String.fromCharCode(...bytes.slice(4, 8));
  if (ftyp !== 'ftyp') return undefined;
  const marca = String.fromCharCode(...bytes.slice(8, 12));
  return MARCAS_HEIF.includes(marca) ? marca : undefined;
}

const ASSINATURAS: readonly Assinatura[] = [
  { tipoMidia: 'image/jpeg', casa: (b) => comeca(b, [0xff, 0xd8, 0xff]) },
  {
    tipoMidia: 'image/png',
    casa: (b) => comeca(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  // `%PDF-`
  { tipoMidia: 'application/pdf', casa: (b) => comeca(b, [0x25, 0x50, 0x44, 0x46, 0x2d]) },
  { tipoMidia: 'image/heic', casa: (b) => marcaHeif(b) !== undefined },
];

export class InspetorMagicBytes implements InspetorDeArquivo {
  inspecionar(conteudo: Uint8Array): string {
    const achada = ASSINATURAS.find((assinatura) => assinatura.casa(conteudo));
    if (achada === undefined) {
      // A mensagem nao ecoa os bytes recebidos. Conteudo de documento nao entra
      // em mensagem de erro, e mensagem de erro vai para log. Fato (d).
      throw new ArquivoRecusado(
        'Conteudo nao e JPEG, PNG, HEIC nem PDF',
        'TIPO_NAO_SUPORTADO',
      );
    }
    return achada.tipoMidia;
  }
}
