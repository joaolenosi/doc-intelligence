import { ErroDeDominio } from '../comum/erro-de-dominio';

/**
 * Os tipos de arquivo que o servico aceita, e a extensao de cada um.
 *
 * HEIC e HEIF estao aqui porque o fato (b) diz "a foto original da camera", e a
 * foto original de iPhone e HEIC e nao JPEG. Recusar o formato mais comum do
 * publico-alvo seria um servico que nao funciona para quem ele foi feito. A
 * conversao de HEIC e a rotacao por EXIF nao estao implementadas e estao
 * registradas como risco.
 *
 * A extensao e derivada do tipo detectado, e por isso nao existe coluna
 * `doc_extensao`: guardar as duas coisas criaria a chance de elas divergirem, e
 * a que vale e sempre a que saiu da inspecao dos bytes.
 */
const EXTENSAO_POR_TIPO: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
};

export const TIPOS_MIDIA_ACEITOS: readonly string[] = Object.keys(EXTENSAO_POR_TIPO);

export function ehTipoAceito(tipoMidia: string): boolean {
  return tipoMidia in EXTENSAO_POR_TIPO;
}

export function extensaoDe(tipoMidia: string): string {
  const extensao = EXTENSAO_POR_TIPO[tipoMidia];
  if (extensao === undefined) {
    throw new ErroDeDominio(`Tipo de midia nao aceito: ${tipoMidia}`, 'TIPO_MIDIA_NAO_ACEITO');
  }
  return extensao;
}
