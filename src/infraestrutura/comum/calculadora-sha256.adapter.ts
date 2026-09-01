import { createHash } from 'node:crypto';
import { CalculadoraDeHash } from '../../aplicacao/portas/calculadora-de-hash.porta';
import { HashConteudo } from '../../dominio/documento/hash-conteudo.vo';

/**
 * sha-256 do conteudo, que e a identidade do documento pelo fato (c).
 *
 * Mora na infraestrutura porque `node:crypto` e importacao proibida no dominio,
 * e o teste de fronteira falha se alguem tentar encurtar esse caminho.
 */
export class CalculadoraSha256 implements CalculadoraDeHash {
  calcular(conteudo: Uint8Array): HashConteudo {
    return HashConteudo.de(createHash('sha256').update(conteudo).digest('hex'));
  }
}
