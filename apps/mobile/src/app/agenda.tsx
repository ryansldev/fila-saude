import { Redirect } from "expo-router";

/** A agenda virou a aba "unidades" (cada unidade mostra os seus atendimentos); links antigos continuam valendo. */
export default function Schedule() {
  return <Redirect href="/unidades" />;
}
