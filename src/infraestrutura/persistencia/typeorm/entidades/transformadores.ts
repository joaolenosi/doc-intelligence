import { ValueTransformer } from 'typeorm';

/**
 * `NUMERIC` volta do driver do Postgres como string, para nao perder precisao.
 *
 * Aqui a precisao nao esta em risco: confianca tem tres casas e custo tem seis,
 * e os dois cabem folgados em double. Sem este transformador, `cae_confianca`
 * chegaria ao dominio como "0.960" e `Confianca.de` receberia uma string onde
 * espera numero, com o TypeScript sem perceber porque o tipo declarado mente.
 */
export const numerico: ValueTransformer = {
  to: (valor?: number | null) => valor ?? null,
  from: (valor?: string | null) => (valor === null || valor === undefined ? undefined : Number(valor)),
};
