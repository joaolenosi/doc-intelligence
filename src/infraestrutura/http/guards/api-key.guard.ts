import { timingSafeEqual } from 'node:crypto';
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SEM_AUTENTICACAO } from './sem-autenticacao.decorator';

/**
 * A fronteira de autenticacao.
 *
 * Nao e seguranca de verdade, e o codigo diz isso em vez de fingir. O
 * comportamento 5 do produto diz que o servico e consumido por sistemas
 * internos e nao por navegador anonimo, e uma API sem fronteira nenhuma seria
 * um desenho que assume o contrario. O enunciado dispensa autenticacao real, e
 * eu aproveitei isso, mas nao desenhei como se ela nunca fosse existir.
 *
 * O mecanismo de verdade para trafego entre sistemas internos seria mTLS ou
 * OAuth2 client credentials, e este guard e o unico ponto que precisaria mudar.
 *
 * A comparacao e em tempo constante porque comparar com `===` vaza o tamanho do
 * prefixo correto pelo tempo de resposta. E barato fazer certo e constrangedor
 * explicar depois por que nao foi feito.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly esperada: Buffer;

  constructor(
    apiKey: string,
    private readonly reflector: Reflector = new Reflector(),
  ) {
    this.esperada = Buffer.from(apiKey, 'utf8');
  }

  canActivate(contexto: ExecutionContext): boolean {
    // A excecao vem da rota, marcada com @SemAutenticacao, e nao de um
    // `startsWith` no caminho.
    const liberada = this.reflector.getAllAndOverride<boolean>(SEM_AUTENTICACAO, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (liberada === true) return true;

    const requisicao = contexto.switchToHttp().getRequest<Request>();
    const recebida = requisicao.header('x-api-key');

    if (recebida === undefined || !this.confere(recebida)) {
      // A mensagem nao diz se a chave estava ausente ou errada, porque a
      // diferenca so ajuda quem esta tentando adivinhar.
      throw new UnauthorizedException('Chave de API ausente ou invalida');
    }
    return true;
  }

  private confere(recebida: string): boolean {
    const bytes = Buffer.from(recebida, 'utf8');
    // timingSafeEqual exige tamanhos iguais, e comparar tamanho antes ja vaza
    // um bit. Igualar o tamanho antes mantem a comparacao constante.
    if (bytes.length !== this.esperada.length) {
      timingSafeEqual(this.esperada, this.esperada);
      return false;
    }
    return timingSafeEqual(bytes, this.esperada);
  }
}
