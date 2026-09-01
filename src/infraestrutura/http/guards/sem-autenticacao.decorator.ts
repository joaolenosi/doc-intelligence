import { SetMetadata } from '@nestjs/common';

/**
 * Marca a rota que fica fora da fronteira de autenticacao.
 *
 * Existe para a excecao ser declarada na rota, e nao adivinhada por caminho
 * dentro do guard. Guard que decide por `startsWith('/healthz')` abre a porta
 * para qualquer rota futura que comece igual, e ninguem revisa expressao de
 * caminho com o mesmo cuidado com que revisa um decorator visivel.
 */
export const SEM_AUTENTICACAO = 'sem_autenticacao';
export const SemAutenticacao = () => SetMetadata(SEM_AUTENTICACAO, true);
