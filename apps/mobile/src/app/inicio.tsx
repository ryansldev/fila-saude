import type { MinhaEntrada } from "@fila-saude/schemas/fila";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Botao, COR, Erro, e, Tela } from "@/components/ui";
import { INTERVALO_DA_CONSULTA_MS } from "@/lib/config";
import { useSessao } from "@/lib/sessao";
import { mensagemDoErro, situacaoDaEntrada } from "@/lib/textos";

const CORES = { vez: COR.sucesso, venha: COR.alerta, normal: COR.primaria, fim: COR.suave };

/** Tela da vez (T3.4): consulta a cada ~3 s enquanto está na frente (PD-33). */
export default function MinhaVez() {
  const s = useSessao();
  const [entradas, setEntradas] = useState<MinhaEntrada[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!s.municipio) return;
      let ativo = true;
      const buscar = () =>
        s.api
          .get<MinhaEntrada[]>(`/v1/municipios/${s.municipio}/minhas`)
          .then((l) => {
            if (!ativo) return;
            setEntradas(l);
            setErro(null);
          })
          .catch((err) => {
            if (!ativo) return;
            setErro(mensagemDoErro(err));
          });
      void buscar();
      const id = setInterval(buscar, INTERVALO_DA_CONSULTA_MS);
      return () => {
        ativo = false;
        clearInterval(id);
      };
    }, [s.api, s.municipio]),
  );

  return (
    <Tela titulo={s.conta ? `Olá, ${s.conta.nome.split(" ")[0]}` : "Fila Saúde"}>
      <Erro texto={erro} />
      {entradas?.length === 0 ? (
        <Text style={e.texto}>Você não tem atendimento marcado. Veja a agenda e se inscreva.</Text>
      ) : null}
      {entradas?.map((en) => {
        const sit = situacaoDaEntrada(en);
        const cor = CORES[sit.destaque];
        return (
          <View
            key={en.entradaId}
            style={[e.cartao, { borderColor: cor, borderWidth: sit.destaque === "vez" ? 3 : 1 }]}
          >
            <Text style={e.suave}>
              {en.servico} · {en.unidade}
              {en.pessoa && s.conta && en.pessoa !== s.conta.nome ? ` · para ${en.pessoa}` : ""}
            </Text>
            {en.senha ? <Text style={{ fontSize: 40, fontWeight: "800", color: cor }}>{en.senha}</Text> : null}
            <Text style={[e.titulo, { color: cor, fontSize: 24 }]}>{sit.titulo}</Text>
            {sit.detalhe ? <Text style={e.texto}>{sit.detalhe}</Text> : null}
          </View>
        );
      })}
      {entradas?.some((en) => en.itemEstado === "remoto") ? (
        <Botao texto="Cheguei · ler o QR da unidade" onPress={() => router.push("/check-in")} />
      ) : null}
      <Botao texto="Ver agenda e me inscrever" tipo="secundario" onPress={() => router.push("/agenda")} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12 }}>
        <Pressable onPress={() => router.push("/municipio")}>
          <Text style={[e.suave, { padding: 8 }]}>Trocar município</Text>
        </Pressable>
        <Pressable
          onPress={async () => {
            await s.sair();
            router.replace("/entrar");
          }}
        >
          <Text style={[e.suave, { padding: 8 }]}>Sair</Text>
        </Pressable>
      </View>
    </Tela>
  );
}
