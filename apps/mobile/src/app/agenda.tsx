import { Redirect } from "expo-router";

/** A agenda virou a aba "unidades" (cada unidade mostra os seus atendimentos); links antigos continuam valendo. */
export default function Agenda() {
  return <Redirect href="/unidades" />;
}
