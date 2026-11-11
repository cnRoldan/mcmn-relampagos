import React, { useState } from "react";
import { Text, View, Pressable, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { DrawerNavigationProp } from "@react-navigation/drawer";
import * as Crypto from "expo-crypto";
import { useApp } from "../state/AppState";
import {
  Button,
  Badge,
  Note,
  Page,
  Field,
  Sheet,
  Confirm,
} from "../components/UI";
import { colors, styles as s } from "../theme";
import { format, roundRobin, Size, Tournament } from "../domain/tournaments";
import type { Routes } from "../navigation";
const message = (e: unknown) =>
  e instanceof Error
    ? e.message
    : "No se ha podido guardar. Inténtalo de nuevo.";
const showDate = (d: string) =>
  new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long" }).format(
    new Date(d + "T12:00:00"),
  );
function Status() {
  const { ready, error } = useApp();
  return (
    <>
      {!ready && <ActivityIndicator color={colors.dark} />}{" "}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
    </>
  );
}
function LocalNote() {
  return (
    <Note>
      Versión inicial · Datos guardados solo en este dispositivo. La
      sincronización y las cuentas de capitanes están pendientes.
    </Note>
  );
}
export function Home() {
  const { night, loadDemo, ready, error } = useApp(),
    nav = useNavigation<DrawerNavigationProp<Routes>>(),
    [busy, setBusy] = useState(false),
    [err, setErr] = useState("");
  return (
    <Page
      title="Tu noche empieza aquí"
      subtitle="Organiza los clubes. Prepara los cruces. Que ruede el balón."
    >
      <Status />
      <View
        style={[
          s.card,
          {
            backgroundColor: colors.dark,
            borderColor: colors.dark,
            padding: 25,
          },
        ]}
      >
        <Text style={[s.eyebrow, { color: colors.lime }]}>
          UNA NOCHE · TODO EN JUEGO
        </Text>
        <Text
          style={{
            fontSize: 38,
            fontWeight: "900",
            color: colors.white,
            lineHeight: 43,
          }}
        >
          {night ? night.name : "POCO TIEMPO.\nMUCHO FÚTBOL."}
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 23, color: "#A8BAA6" }}>
          {night
            ? `${showDate(night.date)} · ${night.time} h · Madrid`
            : "Prepara los relámpagos de tu comunidad de Clubes Pro."}
        </Text>
        {night && (
          <Badge>
            {night.demo
              ? "NOCHE DE EJEMPLO"
              : night.tournaments.length
                ? "REPARTO CONFIRMADO"
                : "INSCRIPCIONES ABIERTAS"}
          </Badge>
        )}
        <Button
          label={night ? "Gestionar la noche →" : "Crear mi primera noche →"}
          accent
          onPress={() => nav.navigate("Noches")}
        />
      </View>
      <View style={s.row}>
        {[
          ["Clubes", night?.clubs.length || 0],
          ["Relámpagos", night?.tournaments.length || 0],
          ["Máx. partidos", 5],
        ].map(([label, v]) => (
          <View key={label} style={[s.card, { flex: 1, padding: 13, gap: 5 }]}>
            <Text
              style={{ fontSize: 30, fontWeight: "800", color: colors.ink }}
            >
              {v}
            </Text>
            <Text style={{ fontSize: 10, color: colors.muted }}>{label}</Text>
          </View>
        ))}
      </View>
      <Text style={s.heading}>De la lista al campo</Text>
      {[
        [
          "01",
          "Reúne a tu comunidad",
          "Inscribe clubes sin registrar jugadores ni plantillas.",
          "Clubes",
        ],
        [
          "02",
          "Revisa el reparto",
          "Elige torneos de 4, 6 u 8 equipos, sin superar cinco partidos.",
          "Relámpagos",
        ],
      ].map(([num, title, desc, route]) => (
        <Pressable
          key={num}
          accessibilityRole="button"
          onPress={() => nav.navigate(route as keyof Routes)}
          style={[
            s.card,
            { flexDirection: "row", gap: 15, alignItems: "center" },
          ]}
        >
          <Text style={{ color: "#678548", fontSize: 22, fontWeight: "800" }}>
            {num}
          </Text>
          <View style={{ flex: 1, gap: 5 }}>
            <Text
              style={{ fontSize: 16, fontWeight: "700", color: colors.ink }}
            >
              {title}
            </Text>
            <Text style={s.subtitle}>{desc}</Text>
          </View>
          <Text style={s.text}>›</Text>
        </Pressable>
      ))}
      {!night && (
        <>
          <Button
            label={busy ? "Cargando…" : "Explorar con 8 clubes de ejemplo"}
            disabled={busy || !ready || !!error}
            secondary
            onPress={async () => {
              setBusy(true);
              try {
                await loadDemo();
              } catch (e) {
                setErr(message(e));
              } finally {
                setBusy(false);
              }
            }}
          />
          {!!err && <Text style={s.error}>{err}</Text>}
        </>
      )}
      <LocalNote />
    </Page>
  );
}
export function Nights() {
  const { data, night, createNight, select, ready, error } = useApp(),
    [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [time, setTime] = useState("22:00"),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Page
      title="Noches de juego"
      subtitle="Una lista de inscritos puede dar lugar a varios relámpagos independientes."
    >
      <Status />
      <Button
        label="＋ Nueva noche"
        disabled={!ready || !!error}
        onPress={() => {
          setName("");
          setErr("");
          setOpen(true);
        }}
      />
      {data.nights.length === 0 ? (
        <View style={s.card}>
          <Text style={s.heading}>Prepara la primera noche</Text>
          <Text style={s.subtitle}>
            Dale un nombre, una fecha y una hora de inicio.
          </Text>
        </View>
      ) : (
        data.nights.map((n) => (
          <View key={n.id} style={s.card}>
            <View style={s.row}>
              <Text style={[s.heading, { flex: 1 }]}>{n.name}</Text>
              {n.id === night?.id && <Badge>ACTIVA</Badge>}
            </View>
            <Text style={s.subtitle}>
              {showDate(n.date)} · {n.time} h · Madrid
            </Text>
            <Text style={s.text}>
              {n.clubs.length} clubes · {n.tournaments.length} relámpagos
            </Text>
            {n.demo && <Badge>DATOS FICTICIOS</Badge>}
            <Button
              label={
                n.id === night?.id ? "Noche seleccionada" : "Seleccionar noche"
              }
              disabled={n.id === night?.id || busy}
              secondary
              onPress={async () => {
                setBusy(true);
                try {
                  await select(n.id);
                } catch (e) {
                  setErr(message(e));
                } finally {
                  setBusy(false);
                }
              }}
            />
          </View>
        ))
      )}
      {!!err && !open && <Text style={s.error}>{err}</Text>}
      {open && (
        <Sheet title="Nueva noche" onClose={() => !busy && setOpen(false)}>
          <Field
            label="Nombre de la noche"
            value={name}
            onChangeText={setName}
            placeholder="Viernes de Clubes Pro"
          />
          <Field
            label="Fecha · AAAA-MM-DD"
            value={date}
            onChangeText={setDate}
            placeholder="2026-11-13"
            maxLength={10}
          />
          <Field
            label="Inicio · HH:MM · hora de Madrid"
            value={time}
            onChangeText={setTime}
            placeholder="22:00"
            maxLength={5}
          />
          <Text style={s.subtitle}>
            Objetivo: una noche de unas 2 a 2,5 horas. Los horarios de cada
            partido se definirán más adelante.
          </Text>
          {!!err && (
            <Text accessibilityRole="alert" style={s.error}>
              {err}
            </Text>
          )}
          <Button
            label={busy ? "Guardando…" : "Crear noche"}
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              try {
                await createNight(name, date, time);
                setOpen(false);
              } catch (e) {
                setErr(message(e));
              } finally {
                setBusy(false);
              }
            }}
          />
        </Sheet>
      )}
    </Page>
  );
}
export function Clubs() {
  const { night, addClub, removeClub } = useApp(),
    nav = useNavigation<DrawerNavigationProp<Routes>>(),
    [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [contacts, setContacts] = useState(["", "", ""]),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Page
      title="Clubes inscritos"
      subtitle={
        night ? night.name : "Selecciona una noche para inscribir clubes."
      }
    >
      <Status />
      {!night ? (
        <Button label="Ir a Noches" onPress={() => nav.navigate("Noches")} />
      ) : (
        <>
          {!night.tournaments.length ? (
            <Button
              label="＋ Añadir club"
              onPress={() => {
                setName("");
                setContacts(["", "", ""]);
                setErr("");
                setOpen(true);
              }}
            />
          ) : (
            <Note>
              Inscripción cerrada: el reparto ya está confirmado. La gestión de
              bajas posteriores está pendiente de definir.
            </Note>
          )}
          {!night.clubs.length && (
            <View style={s.card}>
              <Text style={s.heading}>El primer club abre la noche</Text>
              <Text style={s.subtitle}>
                Solo necesitas el nombre del equipo. No hace falta añadir
                jugadores.
              </Text>
            </View>
          )}
          {night.clubs.map((c, i) => (
            <View style={s.card} key={c.id}>
              <View style={s.row}>
                <View
                  style={{
                    backgroundColor: "#EAF0E0",
                    borderRadius: 10,
                    padding: 13,
                  }}
                >
                  <Text style={{ fontWeight: "800", color: "#56733E" }}>
                    {c.name.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text
                    style={{
                      fontWeight: "700",
                      fontSize: 17,
                      color: colors.ink,
                    }}
                  >
                    {c.name}
                  </Text>
                  <Text style={s.subtitle}>
                    Inscrito #{i + 1} · {c.contacts.length} contactos locales
                  </Text>
                </View>
              </View>
              {!night.tournaments.length && (
                <Confirm
                  label="Retirar de esta noche"
                  title="Retirar club"
                  message={`¿Retirar a ${c.name}?`}
                  danger
                  onConfirm={() => removeClub(c.id)}
                />
              )}
            </View>
          ))}
          <Note>
            Inscripción administrativa en esta versión. Los contactos son
            opcionales para probar el flujo: utiliza datos ficticios hasta
            disponer de permisos y almacenamiento seguro en servidor.
          </Note>
        </>
      )}
      {open && (
        <Sheet title="Añadir club" onClose={() => !busy && setOpen(false)}>
          <Field
            label="Nombre del club"
            value={name}
            onChangeText={setName}
            placeholder="Nombre del equipo"
            maxLength={50}
          />
          <Note>
            No introduzcas teléfonos reales en esta versión de prueba.
          </Note>
          {contacts.map((c, i) => (
            <Field
              key={i}
              label={`Contacto ${i + 1} · opcional`}
              value={c}
              onChangeText={(v) =>
                setContacts((a) => a.map((x, j) => (j === i ? v : x)))
              }
              placeholder="Contacto ficticio"
              maxLength={24}
            />
          ))}
          {!!err && (
            <Text accessibilityRole="alert" style={s.error}>
              {err}
            </Text>
          )}
          <Button
            label={busy ? "Guardando…" : "Inscribir club"}
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              try {
                await addClub(name, contacts);
                setOpen(false);
              } catch (e) {
                setErr(message(e));
              } finally {
                setBusy(false);
              }
            }}
          />
        </Sheet>
      )}
    </Page>
  );
}
function shuffled(ids: string[]) {
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) {
    const limit = 4294967296 - (4294967296 % (i + 1));
    let j: number;
    do {
      j = Crypto.getRandomValues(new Uint32Array(1))[0];
    } while (j >= limit);
    j %= i + 1;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function Tournaments() {
  const { night, confirmPlan } = useApp(),
    nav = useNavigation<DrawerNavigationProp<Routes>>(),
    [planning, setPlanning] = useState(false),
    [counts, setCounts] = useState<Record<Size, number>>({ 4: 0, 6: 0, 8: 0 }),
    [method, setMethod] = useState<"random" | "order" | "manual" | null>(null),
    [draft, setDraft] = useState<Tournament[] | null>(null),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false),
    [detail, setDetail] = useState<Tournament | null>(null);
  const sizes: Size[] = [4, 6, 8];
  function prepare() {
    if (!night) return;
    const ss = sizes.flatMap(
      (size) => Array(counts[size]).fill(size) as Size[],
    );
    if (!ss.length || ss.reduce((a, b) => a + b, 0) !== night.clubs.length) {
      setErr(`Los cupos deben sumar exactamente ${night.clubs.length} clubes.`);
      return;
    }
    if (!method) {
      setErr("Elige cómo repartir los clubes.");
      return;
    }
    const ids =
      method === "random"
        ? shuffled(night.clubs.map((c) => c.id))
        : night.clubs.map((c) => c.id);
    let offset = 0;
    setDraft(
      ss.map((size) => ({
        id: Crypto.randomUUID(),
        size,
        clubIds: ids.slice(offset, (offset += size)),
      })),
    );
    setErr("");
  }
  return (
    <Page
      title="Relámpagos"
      subtitle={night ? night.name : "Cada torneo, su propio campeón."}
    >
      <Status />
      {!night ? (
        <Button label="Ir a Noches" onPress={() => nav.navigate("Noches")} />
      ) : (
        <>
          {!night.tournaments.length ? (
            <>
              <View style={s.card}>
                <Text style={s.heading}>De la lista a la competición</Text>
                <Text style={s.subtitle}>
                  {night.clubs.length} clubes inscritos. Elige cuántos torneos
                  quieres y revisa los participantes antes de confirmar.
                </Text>
                <Button
                  label="Preparar reparto"
                  disabled={!night.clubs.length}
                  onPress={() => {
                    setCounts({ 4: 0, 6: 0, 8: 0 });
                    setMethod(null);
                    setDraft(null);
                    setErr("");
                    setPlanning(true);
                  }}
                />
              </View>
              {sizes.map((size) => (
                <View style={s.card} key={size}>
                  <Badge>
                    {size} EQUIPOS · MÁX. {size === 4 ? 4 : 5} PARTIDOS
                  </Badge>
                  <Text style={s.heading}>{format(size)}</Text>
                  <Text style={s.subtitle}>
                    {size === 4
                      ? "Tres partidos por equipo. Final entre primero y segundo."
                      : size === 6
                        ? "Cinco partidos por equipo. El primero de la tabla es campeón."
                        : "Tres partidos de grupos. Semifinales cruzadas y final."}
                  </Text>
                </View>
              ))}
            </>
          ) : (
            <>
              {night.tournaments.map((t, i) => (
                <View style={s.card} key={t.id}>
                  <Badge>
                    {t.size} EQUIPOS · MÁX. {t.size === 4 ? 4 : 5} PARTIDOS
                  </Badge>
                  <Text style={s.heading}>Relámpago {i + 1}</Text>
                  <Text style={s.subtitle}>{format(t.size)}</Text>
                  <View style={s.wrap}>
                    {t.clubIds.map((id) => (
                      <View
                        key={id}
                        style={{
                          backgroundColor: colors.bg,
                          padding: 9,
                          borderRadius: 6,
                        }}
                      >
                        <Text style={{ fontSize: 12, color: colors.ink }}>
                          {night.clubs.find((c) => c.id === id)?.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <Button
                    secondary
                    label="Ver enfrentamientos →"
                    onPress={() => setDetail(t)}
                  />
                </View>
              ))}
              <Note>
                Marcadores, puntos, desempates y permisos para comunicar
                resultados están pendientes de definir.
              </Note>
            </>
          )}
        </>
      )}
      {planning && night && (
        <Sheet
          title={draft ? "Revisar reparto" : "Preparar reparto"}
          onClose={() => !busy && setPlanning(false)}
        >
          {!draft ? (
            <>
              <Text style={s.subtitle}>
                {night.clubs.length} clubes. Elige la combinación de torneos.
              </Text>
              {sizes.map((size) => (
                <View style={[s.card, s.row]} key={size}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.heading}>{size} equipos</Text>
                    <Text style={s.subtitle}>
                      Hasta {size === 4 ? 4 : 5} partidos
                    </Text>
                  </View>
                  <Button
                    label="−"
                    disabled={!counts[size]}
                    secondary
                    onPress={() =>
                      setCounts((c) => ({ ...c, [size]: c[size] - 1 }))
                    }
                  />
                  <Text
                    accessibilityLabel={`${counts[size]} torneos de ${size} equipos`}
                    style={s.heading}
                  >
                    {counts[size]}
                  </Text>
                  <Button
                    label="＋"
                    secondary
                    disabled={counts[size] >= 50}
                    onPress={() =>
                      setCounts((c) => ({ ...c, [size]: c[size] + 1 }))
                    }
                  />
                </View>
              ))}
              <Text style={s.label}>Método de reparto</Text>
              {(
                [
                  ["random", "Sorteo aleatorio"],
                  ["order", "Orden de inscripción"],
                  ["manual", "Selección manual"],
                ] as const
              ).map(([id, label]) => (
                <Button
                  key={id}
                  label={`${method === id ? "●" : "○"} ${label}`}
                  secondary={method !== id}
                  onPress={() => setMethod(id)}
                />
              ))}
              <Note>
                Los cupos deben coincidir con la lista completa. No se excluyen
                clubes ni se crean formatos para impares automáticamente.
              </Note>
              {!!err && (
                <Text accessibilityRole="alert" style={s.error}>
                  {err}
                </Text>
              )}
              <Button label="Revisar propuesta →" onPress={prepare} />
            </>
          ) : (
            <>
              <Text style={s.subtitle}>
                Revisa los clubes de cada torneo. Al confirmar se cierra la
                inscripción en esta versión.
              </Text>
              {method === "manual"
                ? night.clubs.map((c) => (
                    <View style={s.card} key={c.id}>
                      <Text style={s.heading}>{c.name}</Text>
                      <View style={s.wrap}>
                        {draft.map((t, i) => (
                          <Button
                            key={t.id}
                            label={`R${i + 1} · ${t.size} plazas`}
                            secondary={!t.clubIds.includes(c.id)}
                            onPress={() =>
                              setDraft((a) =>
                                a!.map((x, j) => ({
                                  ...x,
                                  clubIds:
                                    j === i
                                      ? [
                                          ...x.clubIds.filter(
                                            (id) => id !== c.id,
                                          ),
                                          c.id,
                                        ]
                                      : x.clubIds.filter((id) => id !== c.id),
                                })),
                              )
                            }
                          />
                        ))}
                      </View>
                    </View>
                  ))
                : null}
              {draft.map((t, i) => (
                <View style={s.card} key={t.id}>
                  <Badge>
                    RELÁMPAGO {i + 1} · {t.clubIds.length}/{t.size} PLAZAS
                  </Badge>
                  <Text style={s.heading}>{format(t.size)}</Text>
                  {t.clubIds.map((id) => (
                    <Text key={id} style={s.text}>
                      {night.clubs.find((c) => c.id === id)?.name}
                    </Text>
                  ))}
                </View>
              ))}
              {!!err && (
                <Text accessibilityRole="alert" style={s.error}>
                  {err}
                </Text>
              )}
              <Button
                label={busy ? "Guardando…" : "Confirmar reparto"}
                disabled={busy}
                onPress={async () => {
                  setBusy(true);
                  try {
                    await confirmPlan(draft);
                    setPlanning(false);
                    setDraft(null);
                  } catch (e) {
                    setErr(message(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              />
              <Button
                label="Volver a la configuración"
                secondary
                disabled={busy}
                onPress={() => {
                  setDraft(null);
                  setErr("");
                }}
              />
            </>
          )}
        </Sheet>
      )}
      {detail && night && (
        <Sheet title="Enfrentamientos" onClose={() => setDetail(null)}>
          <Badge>
            {format(detail.size)} · MÁX. {detail.size === 4 ? 4 : 5} PARTIDOS
          </Badge>
          {(detail.size === 8
            ? [detail.clubIds.slice(0, 4), detail.clubIds.slice(4)]
            : [detail.clubIds]
          ).map((group, g) => (
            <View key={g} style={{ gap: 14 }}>
              <Text style={s.heading}>
                {detail.size === 8
                  ? `Grupo ${g === 0 ? "A" : "B"}`
                  : "Fase de liga"}
              </Text>
              {roundRobin(group).map((round, r) => (
                <View style={s.card} key={r}>
                  <Text style={s.eyebrow}>JORNADA {r + 1}</Text>
                  {round.map(([a, b]) => (
                    <View style={s.row} key={a + b}>
                      <Text style={[s.text, { flex: 1 }]}>
                        {night.clubs.find((c) => c.id === a)?.name}
                      </Text>
                      <Text style={s.subtitle}>vs</Text>
                      <Text style={[s.text, { flex: 1, textAlign: "right" }]}>
                        {night.clubs.find((c) => c.id === b)?.name}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ))}
          {detail.size === 4 ? (
            <View style={s.card}>
              <Text style={s.heading}>Final</Text>
              <Text style={s.text}>1.º de liga — 2.º de liga</Text>
            </View>
          ) : detail.size === 8 ? (
            <View style={s.card}>
              <Text style={s.heading}>Semifinales cruzadas</Text>
              <Text style={s.text}>1.º A — 2.º B</Text>
              <Text style={s.text}>1.º B — 2.º A</Text>
              <Text style={s.heading}>Final</Text>
              <Text style={s.text}>Ganador SF1 — Ganador SF2</Text>
            </View>
          ) : (
            <Note>
              El primero de la liga será campeón, sin final adicional.
            </Note>
          )}
          <Note>
            La duración de la noche dependerá de los horarios y márgenes de los
            partidos, todavía pendientes.
          </Note>
        </Sheet>
      )}
    </Page>
  );
}
export function Settings() {
  const { reset } = useApp();
  return (
    <Page title="Ajustes" subtitle="Relámpagos · nombre provisional">
      <View style={s.card}>
        <Text style={s.heading}>Una app para tu comunidad</Text>
        <Text style={s.text}>
          iOS y Android con React Native y Expo. Menú lateral adaptable a móvil
          y tablet.
        </Text>
        <Text style={s.subtitle}>
          Versión 0.1.0 · Panel inicial del organizador.
        </Text>
      </View>
      <LocalNote />
      <View style={s.card}>
        <Text style={s.heading}>Siguientes decisiones</Text>
        <Text style={s.text}>
          Admisión de clubes y cuentas de capitanes. Visibilidad de contactos.
          Marcadores, puntos y desempates. Cupos, reservas y bajas.
        </Text>
        <Text style={s.subtitle}>
          La administración real y la protección de datos se comprobarán en el
          servidor cuando se incorpore la base de datos compartida.
        </Text>
      </View>
      <Confirm
        label="Borrar datos de prueba de este dispositivo"
        title="Borrar datos locales"
        message="Se eliminarán todas las noches, clubes y repartos guardados en este dispositivo. Esta acción no se puede deshacer."
        danger
        onConfirm={reset}
      />
    </Page>
  );
}
