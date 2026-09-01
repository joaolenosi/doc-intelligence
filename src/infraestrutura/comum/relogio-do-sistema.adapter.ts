import { Relogio } from '../../aplicacao/portas/relogio.porta';

/** O relogio de verdade. O unico lugar do sistema que chama `new Date()`. */
export class RelogioDoSistema implements Relogio {
  agora(): Date {
    return new Date();
  }
}
