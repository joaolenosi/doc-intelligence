/**
 * Os simbolos que o container do Nest usa para achar cada adaptador.
 *
 * Existem porque as portas sao interfaces, e interface some em tempo de
 * execucao: nao da para injetar por tipo. E o custo de o dominio e a aplicacao
 * nao conhecerem o framework, e ele fica concentrado aqui em vez de espalhado.
 */
export const PORTAS = {
  relogio: Symbol('Relogio'),
  hash: Symbol('CalculadoraDeHash'),
  inspetor: Symbol('InspetorDeArquivo'),
  armazenamento: Symbol('ArmazenamentoDeArquivo'),
  documentos: Symbol('RepositorioDeDocumento'),
  submissoes: Symbol('RepositorioDeSubmissao'),
  processamentos: Symbol('RegistroDeProcessamento'),
  auditoria: Symbol('RegistroDeAuditoria'),
  catalogo: Symbol('CatalogoDeTipos'),
  publicador: Symbol('PublicadorDeProcessamento'),
  unidadeDeTrabalho: Symbol('UnidadeDeTrabalho'),
  extrator: Symbol('ExtratorDeDocumento'),
  configuracao: Symbol('Configuracao'),
} as const;
