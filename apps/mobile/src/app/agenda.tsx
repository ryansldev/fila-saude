import type { SessaoDaAgenda } from "@fila-saude/schemas/fila";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text } from "react-native";
import { Erro, e, Tela } from "@/components/ui";
import { useSessao } from "@/lib/sessao";
import { mensagemDoErro } from "@/lib/textos";

const dia = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** T3.2: agenda pública do município; só dados da sessão. */
export default function Agenda() {
  const s = useSessao();
  const [lista, setLista] = useState<SessaoDaAgenda[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    s.api
      .get<SessaoDaAgenda[]>(`/v1/municipios/${s.municipio}/agenda`)
      .then(setLista)
      .catch((err) => setErro(mensagemDoErro(err)));
  }, [s.api, s.municipio]);

  return (
    <Tela titulo="Agenda">
      <Erro texto={erro} />
      {lista?.length === 0 ? <Text style={e.texto}>Nenhum atendimento aberto para inscrição agora.</Text> : null}
      {lista?.map((x) => (
        <Pressable
          key={x.id}
          style={({ pressed }) => [e.cartao, pressed && { opacity: 0.8 }]}
          onPress={() =>
            router.push({ pathname: "/inscricao/[sessaoId]", params: { sessaoId: x.id, nome: x.servico.nome } })
          }
        >
          <Text style={[e.texto, { fontWeight: "700" }]}>{x.servico.nome}</Text>
          <Text style={e.texto}>
            {x.unidade.nome} · {x.unidade.bairro}
          </Text>
          <Text style={e.suave}>
            {dia(x.inicio)}, {hora(x.inicio)} às {hora(x.fim)}
            {x.profissional ? ` · ${x.profissional}` : ""}
          </Text>
          <Text style={e.suave}>
            {x.estado === "aberta" ? "Fila andando · " : ""}
            {x.vagasRestantes === null
              ? "Vagas livres"
              : x.vagasRestantes === 0
                ? "Lotada (você entra na reserva)"
                : `${x.vagasRestantes} vagas`}
          </Text>
        </Pressable>
      ))}
    </Tela>
  );
}
