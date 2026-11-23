/**
 * Canal Android dos avisos da fila: o app cria com importância máxima e a API envia por ele.
 * O Android não deixa mudar um canal depois de criado: para mudar o som ou a importância, troque o id
 * e ponha o antigo em `OLD_PUSH_CHANNELS`, que o app apaga. A API envia pelo canal novo: em aparelho com
 * o build antigo o aviso cai no canal padrão, sem destaque; publique a API depois do app novo instalado.
 */
export const PUSH_CHANNEL = "avisos";

/** "fila": criado com `sound: "default"`, que o expo-notifications lê como um arquivo que não existe. */
export const OLD_PUSH_CHANNELS = ["fila"];
