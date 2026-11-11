// PD-22: erro de negócio com status HTTP e código `snake_case`; o handler (Task 6) o converte em
// `{ erro: codigo, campos? }`.
export class ErroApi extends Error {
  status: number;
  codigo: string;
  campos?: Record<string, string[]>;

  constructor(status: number, codigo: string, campos?: Record<string, string[]>) {
    super(codigo);
    this.name = "ErroApi";
    this.status = status;
    this.codigo = codigo;
    if (campos) this.campos = campos;
  }
}
