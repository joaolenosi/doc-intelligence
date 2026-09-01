import { TipoDocumento } from '../../../../dominio/documento/tipo-documento';
import { TipoDocumentoOrm } from '../entidades/tipo-documento.orm-entity';

export function tipoParaDominio(linha: TipoDocumentoOrm): TipoDocumento {
  return TipoDocumento.de({
    codigo: linha.codigo,
    camposObrigatorios: linha.camposObrigatorios,
    templateNome: linha.templateNome,
  });
}
