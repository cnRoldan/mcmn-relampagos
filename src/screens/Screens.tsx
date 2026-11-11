import React, { useState } from "react";
import { Text, View, Pressable, ActivityIndicator } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { DrawerNavigationProp } from "@react-navigation/drawer";
import * as Crypto from "expo-crypto";
import { useAuth } from "../cloud/AuthProvider";
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
import { BrandLogo } from "../components/BrandLogo";
import { colors, styles as s } from "../theme";
import {
  format,
  Size,
  Tournament,
  CompetitionFormat,
  defaultFormat,
  supportedFormats,
  maxMatches,
  suggestSplit,
  competitionPhases,
  validatePlan,
} from "../domain/tournaments";
import type { RouteProp } from "@react-navigation/native";
import type { Routes, TournamentSection } from "../navigation";
const message = (e: unknown) =>
  e instanceof Error
    ? e.message
    : "No se ha podido guardar. Inténtalo de nuevo.";
const showDate = (d: string) =>
  new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long" }).format(
    new Date(d + "T12:00:00"),
  );
function Status() {
  const { ready, error, mode, refresh } = useApp();
  const [updating, setUpdating] = useState(false);
  return (
    <>
      {!ready && <ActivityIndicator color={colors.dark} />}
      {mode === "cloud" && (
        <Button
          label={updating ? "Actualizando…" : "Actualizar"}
          secondary
          disabled={updating}
          onPress={async () => {
            setUpdating(true);
            try {
              await refresh();
            } catch {
            } finally {
              setUpdating(false);
            }
          }}
        />
      )}{" "}
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
    </>
  );
}
function LocalNote() {
  const { mode } = useApp();
  return (
    <Note>
      {mode === "cloud"
        ? "Inscripciones por orden de llegada, confirmado en servidor. Los contactos solo son visibles para su capitán y los administradores."
        : "Versión de prueba · Datos guardados solo en este dispositivo."}
    </Note>
  );
}
export function Home() {
  const { night, loadDemo, ready, error, mode, isAdmin } = useApp(),
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
        <BrandLogo />
        <Text style={[s.eyebrow, { color: colors.accent }]}>
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
        <Text style={{ fontSize: 14, lineHeight: 23, color: colors.onDark }}>
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
          label={
            night
              ? "Ver la noche →"
              : isAdmin
                ? "Crear mi primera noche →"
                : "Ver torneos →"
          }
          accent
          onPress={() => nav.navigate("Torneos", { section: "Noches" })}
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
          "Inscritos",
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
          onPress={() =>
            nav.navigate("Torneos", { section: route as TournamentSection })
          }
          style={[
            s.card,
            { flexDirection: "row", gap: 15, alignItems: "center" },
          ]}
        >
          <Text
            style={{ color: colors.primary, fontSize: 22, fontWeight: "800" }}
          >
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
      {!night && mode === "local" && (
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
  const { data, night, createNight, select, ready, error, isAdmin } = useApp(),
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
      {isAdmin && (
        <Button
          label="＋ Nueva noche"
          disabled={!ready || !!error}
          onPress={() => {
            setName("");
            setErr("");
            setOpen(true);
          }}
        />
      )}
      {data.nights.length === 0 ? (
        <View style={s.card}>
          <Text style={s.heading}>
            {isAdmin
              ? "Prepara la primera noche"
              : "Próximamente, nuevas noches"}
          </Text>
          <Text style={s.subtitle}>
            {isAdmin
              ? "Dale un nombre, una fecha y una hora de inicio."
              : "El organizador publicará aquí las próximas inscripciones."}
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
  const {
      night,
      addClub,
      removeClub,
      isAdmin,
      mode,
      myClub,
      registerMyClub,
      assignCaptain,
    } = useApp(),
    nav = useNavigation<DrawerNavigationProp<Routes>>(),
    [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [contacts, setContacts] = useState(["", "", ""]),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false),
    [linkClub, setLinkClub] = useState<string | null>(null),
    [captainEa, setCaptainEa] = useState("");
  return (
    <Page
      title="Clubes inscritos"
      subtitle={
        night ? night.name : "Selecciona una noche para inscribir clubes."
      }
    >
      <Status />
      {!night ? (
        <Button
          label="Ir a Noches"
          onPress={() => nav.navigate("Torneos", { section: "Noches" })}
        />
      ) : (
        <>
          {!night.tournaments.length && isAdmin ? (
            <Button
              label="＋ Añadir club"
              onPress={() => {
                setName("");
                setContacts(["", "", ""]);
                setErr("");
                setOpen(true);
              }}
            />
          ) : night.tournaments.length ? (
            <Note>Inscripción cerrada: el reparto ya está confirmado.</Note>
          ) : myClub ? (
            <Button
              label={
                night.clubs.some((c) => c.id === myClub.id)
                  ? "Tu club ya está inscrito"
                  : "Inscribir mi club"
              }
              disabled={busy || night.clubs.some((c) => c.id === myClub.id)}
              onPress={async () => {
                setBusy(true);
                setErr("");
                try {
                  await registerMyClub();
                } catch (e) {
                  setErr(message(e));
                } finally {
                  setBusy(false);
                }
              }}
            />
          ) : (
            <Button
              label="Crear o vincular mi club"
              onPress={() => nav.navigate("Mi Club")}
            />
          )}
          {!!err && !open && (
            <Text accessibilityRole="alert" style={s.error}>
              {err}
            </Text>
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
                    backgroundColor: colors.soft,
                    borderRadius: 10,
                    padding: 13,
                  }}
                >
                  <Text style={{ fontWeight: "800", color: colors.softInk }}>
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
                    Inscrito #{c.registrationOrder ?? i + 1}
                    {c.registeredAt
                      ? ` · ${new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }).format(new Date(c.registeredAt))}`
                      : ""}
                  </Text>
                </View>
              </View>
              {c.contacts.map((phone, index) => (
                <Text key={index} style={s.text}>
                  {phone}
                </Text>
              ))}
              {mode === "cloud" && isAdmin && !c.captainId && (
                <Button
                  secondary
                  label="Vincular capitán"
                  onPress={() => {
                    setLinkClub(c.id);
                    setCaptainEa("");
                    setErr("");
                  }}
                />
              )}
              {isAdmin && !night.tournaments.length && (
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
            {mode === "cloud"
              ? "La lista respeta el número asignado al confirmar cada inscripción. El sorteo posterior no altera el orden de llegada."
              : "Los contactos de prueba se guardan solo en este dispositivo."}
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
            {mode === "cloud"
              ? "Hasta tres contactos opcionales. Solo el capitán y los administradores pueden verlos."
              : "Utiliza contactos ficticios en la prueba local."}
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
      {linkClub && (
        <Sheet
          title="Vincular capitán"
          onClose={() => !busy && setLinkClub(null)}
        >
          <Field
            label="ID de EA del capitán"
            value={captainEa}
            onChangeText={setCaptainEa}
            maxLength={40}
            autoCapitalize="none"
          />
          <Note>
            El capitán debe tener una cuenta y no pertenecer ya a otro club.
          </Note>
          {!!err && <Text style={s.error}>{err}</Text>}
          <Button
            label={busy ? "Guardando…" : "Vincular"}
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              try {
                await assignCaptain(linkClub, captainEa);
                setLinkClub(null);
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
function FormatSelector({
  size,
  value,
  onChange,
}: {
  size: Size;
  value: CompetitionFormat;
  onChange: (kind: CompetitionFormat) => void;
}) {
  return (
    <View style={s.wrap}>
      {supportedFormats(size).map((kind) => (
        <Button
          key={kind}
          label={`${value === kind ? "●" : "○"} ${kind === "copa" ? "Copa" : "Liga"}`}
          secondary={value !== kind}
          onPress={() => onChange(kind)}
        />
      ))}
    </View>
  );
}
export function Tournaments() {
  const { night, confirmPlan, isAdmin } = useApp(),
    nav = useNavigation<DrawerNavigationProp<Routes>>();
  const [planning, setPlanning] = useState(false),
    [counts, setCounts] = useState<Record<Size, number>>({ 4: 0, 6: 0, 8: 0 }),
    [kinds, setKinds] = useState<Record<Size, CompetitionFormat>>({
      4: "copa",
      6: "liga",
      8: "copa",
    }),
    [method, setMethod] = useState<"random" | "order" | "manual">("random"),
    [draft, setDraft] = useState<Tournament[] | null>(null),
    [err, setErr] = useState(""),
    [busy, setBusy] = useState(false),
    [detail, setDetail] = useState<Tournament | null>(null);
  const sizes: Size[] = [4, 6, 8];
  function openPlanner() {
    if (!night || !isAdmin) return;
    const split = suggestSplit(night.clubs.length),
      next = { 4: 0, 6: 0, 8: 0 };
    split?.forEach((size) => next[size]++);
    setCounts(next);
    setKinds({ 4: "copa", 6: "liga", 8: "copa" });
    setMethod("random");
    setDraft(null);
    setErr(
      split
        ? ""
        : "Con esta cantidad no hay un reparto completo disponible. Revisa las inscripciones; no se excluirá ningún club automáticamente.",
    );
    setPlanning(true);
  }
  function prepare() {
    if (!night || !isAdmin) return;
    const ss = sizes.flatMap(
      (size) => Array(counts[size]).fill(size) as Size[],
    );
    if (!ss.length || ss.reduce((a, b) => a + b, 0) !== night.clubs.length) {
      setErr(`Los cupos deben sumar exactamente ${night.clubs.length} clubes.`);
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
        format: kinds[size],
        clubIds: ids.slice(offset, (offset += size)),
      })),
    );
    setErr("");
  }
  return (
    <Page
      title="Torneos relámpago"
      subtitle={
        night ? night.name : "Copa o Liga, organizadas por los administradores."
      }
    >
      <Status />
      {!night ? (
        <Button
          label="Ir a Noches"
          onPress={() => nav.navigate("Torneos", { section: "Noches" })}
        />
      ) : !night.tournaments.length ? (
        <>
          <View style={s.card}>
            <Text style={s.heading}>Copa o Liga</Text>
            <Text style={s.subtitle}>
              {night.clubs.length} clubes inscritos. La configuración se prepara
              según los participantes, manteniendo un máximo de cinco partidos
              por equipo.
            </Text>
            {isAdmin ? (
              <Button
                label="Preparar reparto"
                disabled={!night.clubs.length}
                onPress={openPlanner}
              />
            ) : (
              <Text style={s.subtitle}>
                El administrador elegirá los formatos y revisará el reparto
                antes de confirmarlo.
              </Text>
            )}
          </View>
          <View style={s.card}>
            <Badge>COPA</Badge>
            <Text style={s.heading}>Grupos y eliminatorias</Text>
            <Text style={s.subtitle}>
              4 equipos: grupo único y final. 8 equipos: dos grupos de cuatro,
              semifinales cruzadas y final.
            </Text>
          </View>
          <View style={s.card}>
            <Badge>LIGA</Badge>
            <Text style={s.heading}>Todos contra todos</Text>
            <Text style={s.subtitle}>
              Una vuelta, sin final adicional. Con 4 equipos se juegan 3
              partidos; con 6, se juegan 5. Una Liga de 8 superaría el límite.
            </Text>
          </View>
        </>
      ) : (
        <>
          {night.tournaments.map((t, i) => (
            <View style={s.card} key={t.id}>
              <Badge>
                {(t.format ?? defaultFormat(t.size)) === "copa"
                  ? "COPA"
                  : "LIGA"}{" "}
                · {t.size} EQUIPOS · MÁX. {maxMatches(t.size, t.format)}{" "}
                PARTIDOS
              </Badge>
              <Text style={s.heading}>Relámpago {i + 1}</Text>
              <Text style={s.subtitle}>{format(t.size, t.format)}</Text>
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
            Los marcadores, puntos y desempates se definirán antes de
            automatizar las clasificaciones y los campeones.
          </Note>
        </>
      )}
      {planning && night && (
        <Sheet
          title={draft ? "Revisar torneos" : "Configurar relámpagos"}
          onClose={() => !busy && setPlanning(false)}
        >
          {!draft ? (
            <>
              <Text style={s.subtitle}>
                {night.clubs.length} clubes inscritos. Esta propuesta usa
                torneos completos; puedes ajustar las cantidades y elegir Copa o
                Liga donde ambos formatos sean compatibles.
              </Text>
              <Note>
                Propuesta actual:{" "}
                {sizes
                  .filter((size) => counts[size] > 0)
                  .map(
                    (size) =>
                      `${counts[size]} ${kinds[size] === "copa" ? "Copa(s)" : "Liga(s)"} de ${size}`,
                  )
                  .join(" · ") || "Sin torneos"}
                . Plazas:{" "}
                {sizes.reduce((total, size) => total + counts[size] * size, 0)}/
                {night.clubs.length}.
              </Note>
              {sizes.map((size) => (
                <View style={s.card} key={size}>
                  <View style={s.row}>
                    <Text style={[s.heading, { flex: 1 }]}>{size} equipos</Text>
                    <Button
                      label="−"
                      secondary
                      disabled={!counts[size]}
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
                  <FormatSelector
                    size={size}
                    value={kinds[size]}
                    onChange={(kind) =>
                      setKinds((k) => ({ ...k, [size]: kind }))
                    }
                  />
                  <Text style={s.subtitle}>
                    {format(size, kinds[size])} · Máximo{" "}
                    {maxMatches(size, kinds[size])} partidos por equipo.
                  </Text>
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
                El sorteo reparte los clubes entre torneos. La lista de
                inscritos conserva siempre su orden de llegada. Los cupos deben
                incluir a todos los participantes.
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
                Revisa los formatos y los clubes antes de confirmar. La
                confirmación cierra las inscripciones de esta sesión.
              </Text>
              {method === "manual" &&
                night.clubs.map((c) => (
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
                ))}
              {draft.map((t, i) => (
                <View style={s.card} key={t.id}>
                  <Badge>
                    RELÁMPAGO {i + 1} · {t.clubIds.length}/{t.size} EQUIPOS
                  </Badge>
                  <FormatSelector
                    size={t.size}
                    value={t.format ?? defaultFormat(t.size)}
                    onChange={(kind) =>
                      setDraft((a) =>
                        a!.map((x) =>
                          x.id === t.id ? { ...x, format: kind } : x,
                        ),
                      )
                    }
                  />
                  <Text style={s.heading}>{format(t.size, t.format)}</Text>
                  <Text style={s.subtitle}>
                    Hasta {maxMatches(t.size, t.format)} partidos por equipo.
                  </Text>
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
                  if (!isAdmin || !night) return;
                  setBusy(true);
                  try {
                    validatePlan(night, draft);
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
            {format(detail.size, detail.format)} · MÁX.{" "}
            {maxMatches(detail.size, detail.format)} PARTIDOS
          </Badge>
          {competitionPhases(detail).map((phase, i) => (
            <View key={i} style={{ gap: 14 }}>
              <Text style={s.heading}>{phase.title}</Text>
              {phase.rounds.map((round, r) => (
                <View key={r} style={s.card}>
                  <Text style={s.eyebrow}>{round.label.toUpperCase()}</Text>
                  {round.matches.map(([a, b], m) => (
                    <View style={s.row} key={m}>
                      <Text style={[s.text, { flex: 1 }]}>
                        {night.clubs.find((c) => c.id === a)?.name ?? a}
                      </Text>
                      <Text style={s.subtitle}>vs</Text>
                      <Text style={[s.text, { flex: 1, textAlign: "right" }]}>
                        {night.clubs.find((c) => c.id === b)?.name ?? b}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ))}
          {(detail.format ?? defaultFormat(detail.size)) === "liga" && (
            <Note>
              El primero de la clasificación será campeón, sin final adicional.
            </Note>
          )}
          <Note>
            La duración de la noche depende de los horarios y márgenes entre
            partidos, todavía pendientes.
          </Note>
        </Sheet>
      )}
    </Page>
  );
}
export function Settings() {
  const { mode, reset } = useApp(),
    { profile, signOut, error, reloadProfile } = useAuth();
  return (
    <Page title="Ajustes" subtitle="MCM · Torneos Relámpago">
      <View style={s.card}>
        <Text style={s.heading}>
          {profile ? profile.ea_id : "Una app para tu comunidad"}
        </Text>
        <Text style={s.subtitle}>
          {profile?.role === "admin"
            ? "Administrador de la comunidad"
            : mode === "cloud"
              ? "Capitán de club"
              : "Versión de prueba local"}
        </Text>
        <Text style={s.text}>
          iOS y Android con menú lateral adaptable a móvil y tablet.
        </Text>
      </View>
      <LocalNote />
      {mode === "cloud" ? (
        <>
          {!!error && <Text style={s.error}>{error}</Text>}
          <Button
            label="Actualizar mi perfil"
            secondary
            onPress={() => {
              void reloadProfile().catch(() => {});
            }}
          />
          <Confirm
            label="Cerrar sesión"
            title="Cerrar sesión"
            message="Se cerrará tu sesión en este dispositivo. Tu club e inscripciones seguirán guardados en el servidor."
            onConfirm={signOut}
          />
        </>
      ) : (
        <Confirm
          label="Borrar datos de prueba de este dispositivo"
          title="Borrar datos locales"
          message="Se eliminarán las noches y los clubes de prueba guardados en este dispositivo."
          danger
          onConfirm={reset}
        />
      )}
      <View style={s.card}>
        <Text style={s.heading}>Próximos pasos</Text>
        <Text style={s.subtitle}>
          Resultados, puntos, desempates, cupos y gestión de bajas después del
          cierre.
        </Text>
      </View>
    </Page>
  );
}

export function TournamentHub() {
  const nav = useNavigation<DrawerNavigationProp<Routes>>();
  const route = useRoute<RouteProp<Routes, "Torneos">>();
  const section = route.params?.section ?? "Noches";
  return (
    <View style={s.page}>
      <View
        accessibilityRole="tablist"
        style={{
          flexDirection: "row",
          padding: 12,
          gap: 6,
          borderBottomWidth: 1,
          borderColor: colors.line,
        }}
      >
        {(["Noches", "Inscritos", "Relámpagos"] as const).map((tab) => (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: section === tab }}
            onPress={() => nav.setParams({ section: tab })}
            style={{
              flex: 1,
              minHeight: 48,
              justifyContent: "center",
              alignItems: "center",
              borderRadius: 10,
              backgroundColor: section === tab ? colors.primary : colors.soft,
            }}
          >
            <Text
              style={{
                color: section === tab ? colors.white : colors.softInk,
                fontSize: 13,
                fontWeight: "700",
              }}
            >
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>
      {section === "Noches" ? (
        <Nights />
      ) : section === "Inscritos" ? (
        <Clubs />
      ) : (
        <Tournaments />
      )}
    </View>
  );
}
export function MyClub() {
  const { mode, myClub, saveMyClub, updateContacts, night, registerMyClub } =
    useApp();
  const { profile } = useAuth();
  const nav = useNavigation<DrawerNavigationProp<Routes>>();
  const [editing, setEditing] = useState(false),
    [name, setName] = useState(""),
    [contacts, setContacts] = useState(["", "", ""]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const registered = !!myClub && !!night?.clubs.some((c) => c.id === myClub.id);
  return (
    <Page
      title="Mi Club"
      subtitle={
        profile
          ? `Capitán · ${profile.ea_id}`
          : "Tu equipo dentro de la comunidad."
      }
    >
      <Status />
      {mode === "local" ? (
        <Note>
          La vinculación de tu club se activará al conectar el servidor. Esta
          vista sigue en modo de prueba local.
        </Note>
      ) : myClub ? (
        <>
          <View style={s.card}>
            <Badge>TU CLUB</Badge>
            <Text style={s.heading}>{myClub.name}</Text>
            <Text style={s.subtitle}>
              Contactos privados · visibles para ti y para los administradores.
            </Text>
            {myClub.contacts.length ? (
              myClub.contacts.map((phone, i) => (
                <Text style={s.text} key={i}>
                  {phone}
                </Text>
              ))
            ) : (
              <Text style={s.subtitle}>Sin contactos añadidos.</Text>
            )}
            <Button
              secondary
              label="Editar contactos"
              onPress={() => {
                setContacts([0, 1, 2].map((i) => myClub.contacts[i] || ""));
                setError("");
                setEditing(true);
              }}
            />
          </View>
          {night ? (
            <View style={s.card}>
              <Text style={s.heading}>{night.name}</Text>
              <Text style={s.subtitle}>
                {registered
                  ? `Tu club está inscrito con el número #${night.clubs.find((c) => c.id === myClub.id)?.registrationOrder}.`
                  : night.tournaments.length
                    ? "Las inscripciones están cerradas."
                    : "Inscripción por orden de llegada. Tu puesto se asigna al confirmar en el servidor."}
              </Text>
              <Button
                label={registered ? "Club inscrito" : "Inscribir a mi club"}
                disabled={registered || !!night.tournaments.length || busy}
                onPress={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    await registerMyClub();
                  } catch (e) {
                    setError(message(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              />
              <Button
                secondary
                label="Elegir otra noche"
                onPress={() => nav.navigate("Torneos", { section: "Noches" })}
              />
            </View>
          ) : (
            <Button
              label="Ver las próximas noches"
              onPress={() => nav.navigate("Torneos", { section: "Noches" })}
            />
          )}
        </>
      ) : (
        <View style={s.card}>
          <Text style={s.heading}>Añade el club que representas</Text>
          <Text style={s.subtitle}>
            Solo necesitas su nombre. No hay jugadores ni plantillas que
            registrar.
          </Text>
          <Button
            label="Crear mi club"
            onPress={() => {
              setName("");
              setContacts(["", "", ""]);
              setError("");
              setEditing(true);
            }}
          />
          <Note>
            Si un administrador ya inscribió tu club, pídele que lo vincule a tu
            ID de EA para conservar sus inscripciones.
          </Note>
        </View>
      )}
      {!!error && !editing && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      {editing && (
        <Sheet
          title={myClub ? "Contactos de mi club" : "Crear mi club"}
          onClose={() => !busy && setEditing(false)}
        >
          {!myClub && (
            <Field
              label="Nombre del club"
              value={name}
              onChangeText={setName}
              maxLength={50}
            />
          )}
          <Note>
            Hasta tres teléfonos opcionales. No se publican en la lista de
            inscritos.
          </Note>
          {contacts.map((v, i) => (
            <Field
              key={i}
              label={`Contacto ${i + 1} · opcional`}
              value={v}
              onChangeText={(v) =>
                setContacts((a) => a.map((x, j) => (i === j ? v : x)))
              }
              maxLength={24}
            />
          ))}
          {!!error && (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          )}
          <Button
            label={busy ? "Guardando…" : "Guardar"}
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              setError("");
              try {
                if (myClub) await updateContacts(contacts);
                else await saveMyClub(name, contacts);
                setEditing(false);
              } catch (e) {
                setError(message(e));
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
export function Honours() {
  return (
    <Page
      title="Palmarés"
      subtitle="La historia de los campeones de la comunidad."
    >
      <View style={s.card}>
        <Badge>SIN TÍTULOS REGISTRADOS</Badge>
        <Text style={s.heading}>El primer campeón está por llegar</Text>
        <Text style={s.subtitle}>
          Aquí aparecerán los títulos cuando los torneos tengan un campeón
          confirmado.
        </Text>
      </View>
      <Note>
        El registro de campeones se incorporará junto con los resultados y las
        reglas de clasificación.
      </Note>
    </Page>
  );
}
