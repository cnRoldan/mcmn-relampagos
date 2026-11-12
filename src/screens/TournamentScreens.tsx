import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { DrawerNavigationProp } from "@react-navigation/drawer";
import * as Crypto from "expo-crypto";
import { useApp } from "../state/AppState";
import {
  Button,
  Badge,
  Field,
  Note,
  Page,
  Sheet,
  Confirm,
} from "../components/UI";
import { ClubBadge } from "../components/ClubBadge";
import { CompetitionBoard } from "../components/CompetitionBoard";
import { WhatsAppContact } from "../components/WhatsAppContact";
import { normalizePhone } from "../domain/contacts";
import { tournamentState } from "../domain/currentTournament";
import { Check } from "../components/Check";
import { colors, styles as s } from "../theme";
import { Routes, TournamentSection } from "../navigation";
import {
  CompetitionFormat,
  Night,
  Size,
  Tournament,
  competitionPhases,
  defaultFormat,
  format,
  maxMatches,
  supportedFormats,
  validatePlan,
} from "../domain/tournaments";
import { shareTournament, tournamentLink } from "../cloud/links";
import { tournamentTime } from "./SharedTournament";
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "No se ha podido completar la acción.";
const startText = (n: Night) =>
  n.effectiveStart
    ? tournamentTime(n.effectiveStart)
    : `${n.date} · ${n.time} h`;
const eligible = (n: Night) => n.clubs.filter((c) => !c.excluded);
function Refresh() {
  const { ready, error, refresh } = useApp(),
    [busy, setBusy] = useState(false);
  return (
    <>
      {!ready && <ActivityIndicator color={colors.primary} />}{" "}
      {!!error && (
        <Text style={s.error} accessibilityRole="alert">
          {error}
        </Text>
      )}
      <Button
        secondary
        label={busy ? "Actualizando…" : "Actualizar"}
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          try {
            await refresh();
          } catch {
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
function useTournamentNav() {
  return useNavigation<DrawerNavigationProp<Routes>>();
}
export function TournamentHub() {
  const { data, night, ready, select } = useApp(),
    nav = useTournamentNav(),
    route = useRoute<RouteProp<Routes, "Torneos">>();
  const section = route.params?.section ?? "Listado",
    target = route.params?.tournamentId;
  useEffect(() => {
    if (
      target &&
      ready &&
      data.nights.some((n) => n.id === target) &&
      night?.id !== target
    )
      void select(target).catch(() => {});
  }, [target, ready, night?.id, data.nights.length]);
  if (section === "Listado") return <TournamentList />;
  if (
    !ready ||
    (target && night?.id !== target && data.nights.some((n) => n.id === target))
  )
    return (
      <Page title="Torneo">
        <ActivityIndicator color={colors.primary} />
      </Page>
    );
  if (!night || (target && !data.nights.some((n) => n.id === target)))
    return (
      <Page title="Torneo no encontrado">
        <Button
          label="Ver torneos"
          onPress={() =>
            nav.setParams({ section: "Listado", tournamentId: undefined })
          }
        />
      </Page>
    );
  return (
    <View style={s.page}>
      <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
        <Button
          secondary
          label="← Todos los torneos"
          onPress={() =>
            nav.setParams({ section: "Listado", tournamentId: undefined })
          }
        />
      </View>
      <View
        accessibilityRole="tablist"
        style={{ flexDirection: "row", padding: 12, gap: 6 }}
      >
        {(
          ["Información", "Inscritos", "Competición"] as TournamentSection[]
        ).map((tab) => (
          <View key={tab} style={{ flex: 1 }}>
            <Button
              label={tab}
              secondary={section !== tab}
              onPress={() =>
                nav.setParams({ section: tab, tournamentId: night.id })
              }
            />
          </View>
        ))}
      </View>
      {section === "Información" ? (
        <TournamentInfo key={night.id} />
      ) : section === "Inscritos" ? (
        <TournamentRegistrations />
      ) : (
        <TournamentCompetition />
      )}
    </View>
  );
}
function TournamentList() {
  const { data, createNight, select, isAdmin, ready, error } = useApp(),
    nav = useTournamentNav();
  const [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [date, setDate] = useState(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Madrid",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    ),
    [time, setTime] = useState("22:00"),
    [rules, setRules] = useState(""),
    [busy, setBusy] = useState(false),
    [err, setErr] = useState("");
  return (
    <Page title="Torneos" subtitle="Elige tu próximo relámpago de MCM.">
      <Refresh />
      {isAdmin && (
        <Button
          label="＋ Crear torneo"
          disabled={!ready || !!error}
          onPress={() => {
            setName("");
            setRules("");
            setErr("");
            setOpen(true);
          }}
        />
      )}
      {!data.nights.length && (
        <View style={s.card}>
          <Text style={s.heading}>Próximamente, nuevos torneos</Text>
          <Text style={s.subtitle}>
            {isAdmin
              ? "Crea el torneo con su hora de inicio y las normas para abrir las inscripciones."
              : "La organización publicará aquí los próximos relámpagos."}
          </Text>
        </View>
      )}
      {data.nights.map((n) => (
        <View key={n.id} style={s.card}>
          <Badge>{tournamentState(n).toUpperCase()}</Badge>
          <Text style={s.heading}>{n.name}</Text>
          <Text style={s.text}>Inicio · {startText(n)}</Text>
          <Text style={s.subtitle}>
            Hora de Madrid · {n.clubs.length} inscritos · {eligible(n).length}{" "}
            dentro
          </Text>
          <Text style={s.subtitle}>
            {n.tournaments.length
              ? format(n.tournaments[0].size, n.tournaments[0].format)
              : "Copa o Liga por decidir por la organización."}
          </Text>
          <Button
            label="Ver torneo"
            onPress={async () => {
              try {
                await select(n.id);
                nav.setParams({ section: "Información", tournamentId: n.id });
              } catch (e) {
                setErr(errorText(e));
              }
            }}
          />
        </View>
      ))}
      {!!err && !open && <Text style={s.error}>{err}</Text>}
      {open && (
        <Sheet title="Crear torneo" onClose={() => !busy && setOpen(false)}>
          <Field
            label="Nombre del torneo"
            value={name}
            onChangeText={setName}
          />
          <Field
            label="Fecha · AAAA-MM-DD"
            value={date}
            onChangeText={setDate}
            maxLength={10}
          />
          <Field
            label="Hora de inicio · HH:MM · Madrid"
            value={time}
            onChangeText={setTime}
            maxLength={5}
          />
          <Field
            label="Normas del torneo"
            value={rules}
            onChangeText={setRules}
            maxLength={5000}
            multiline
            placeholder="Escribe las normas que deberán aceptar los capitanes."
          />
          <Note>
            El formato se decidirá con los clubes participantes a la hora
            indicada. Puedes conceder margen si hace falta esperar a otro
            equipo.
          </Note>
          {!!err && (
            <Text style={s.error} accessibilityRole="alert">
              {err}
            </Text>
          )}
          <Button
            label={busy ? "Guardando…" : "Crear torneo y abrir inscripción"}
            disabled={busy}
            onPress={async () => {
              setErr("");
              if (!name.trim() || !rules.trim()) {
                setErr("Completa el nombre y las normas del torneo.");
                return;
              }
              if (
                !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
                isNaN(Date.parse(date + "T12:00:00Z")) ||
                new Date(date + "T12:00:00Z").toISOString().slice(0, 10) !==
                  date ||
                !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
              ) {
                setErr("Revisa la fecha y la hora de inicio.");
                return;
              }
              setBusy(true);
              try {
                await createNight(name, date, time, rules);
                setOpen(false);
                nav.setParams({
                  section: "Información",
                  tournamentId: undefined,
                });
              } catch (e) {
                setErr(errorText(e));
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
function TournamentInfo() {
  const {
      night: n,
      myClub,
      isAdmin,
      registerMyClub,
      extendStart,
      mode,
    } = useApp(),
    nav = useTournamentNav();
  const [accepted, setAccepted] = useState(false),
    [busy, setBusy] = useState(false),
    [err, setErr] = useState(""),
    [notice, setNotice] = useState(""),
    [grace, setGrace] = useState(false),
    [minutes, setMinutes] = useState("10");
  if (!n) return null;
  const registration = myClub
      ? n.clubs.find((c) => c.id === myClub.id)
      : undefined,
    closed = !!n.tournaments.length;
  return (
    <Page title={n.name} subtitle="Torneo relámpago · MCM">
      <Refresh />
      <View style={s.card}>
        <Badge>{tournamentState(n).toUpperCase()}</Badge>
        <Badge>
          {closed
            ? format(n.tournaments[0].size, n.tournaments[0].format)
            : "INSCRIPCIÓN ABIERTA"}
        </Badge>
        <Text style={s.heading}>Inicio · {startText(n)}</Text>
        <Text style={s.subtitle}>
          Hora de Madrid · {n.clubs.length} clubes inscritos
        </Text>
        {!!n.graceMinutes && (
          <Note>
            La organización ha concedido {n.graceMinutes} minutos de margen.
          </Note>
        )}
        {!closed && (
          <Text style={s.subtitle}>
            El administrador decidirá Copa o Liga al confirmar los
            participantes. La inscripción seguirá abierta hasta ese momento.
          </Text>
        )}
        {mode === "cloud" && (
          <>
            <Button
              secondary
              label="Compartir torneo"
              onPress={async () => {
                try {
                  setNotice(await shareTournament(n.id, n.name));
                } catch {
                  setNotice("Puedes copiar el enlace que aparece debajo.");
                }
              }}
            />
            <Text selectable style={s.subtitle}>
              {tournamentLink(n.id)}
            </Text>
          </>
        )}
        {isAdmin && !closed && (
          <Button
            secondary
            label="Dar margen de tiempo"
            onPress={() => {
              setErr("");
              setGrace(true);
            }}
          />
        )}
      </View>
      <View style={s.card}>
        <Text style={s.heading}>Normas del torneo</Text>
        <Text style={s.text}>
          {n.rules || "La organización todavía no ha publicado las normas."}
        </Text>
      </View>
      {isAdmin ? (
        <View style={s.card}>
          <Text style={s.heading}>Gestión del torneo</Text>
          <Button
            label="Gestionar inscritos"
            onPress={() => nav.setParams({ section: "Inscritos" })}
          />
          <Button
            secondary
            label={
              closed ? "Ver competición" : "Decidir formato y participantes"
            }
            onPress={() => nav.setParams({ section: "Competición" })}
          />
        </View>
      ) : (
        <View style={s.card}>
          <Text style={s.heading}>Inscripción de mi club</Text>
          {registration?.excluded ? (
            <Note>
              Tu club ha quedado fuera de este torneo.{" "}
              {registration.exclusionReason || "Consulta con la organización."}
            </Note>
          ) : registration ? (
            <Note>
              Tu club está inscrito con el número #
              {registration.registrationOrder}.{" "}
              {closed
                ? "Participación confirmada."
                : "La organización confirmará los participantes definitivos."}
            </Note>
          ) : closed ? (
            <Note>La inscripción está cerrada.</Note>
          ) : !myClub ? (
            <>
              <Text style={s.subtitle}>
                Crea tu club o pide al administrador que lo vincule a tu cuenta
                de capitán.
              </Text>
              <Button
                label="Crear o vincular mi club"
                onPress={() => nav.navigate("Mi Club")}
              />
            </>
          ) : !myClub.contacts.some((phone) => normalizePhone(phone)) ? (
            <>
              <Note>
                Añade un teléfono de WhatsApp con prefijo internacional antes de
                inscribir tu club.
              </Note>
              <Button
                label="Configurar WhatsApp de mi club"
                onPress={() => nav.navigate("Mi Club")}
              />
            </>
          ) : (
            <>
              <Text style={s.text}>{myClub.name}</Text>
              <Text style={s.subtitle}>
                La inscripción guarda tu orden de llegada. Solo hace falta la
                cuenta del capitán, sin registrar jugadores.
              </Text>
              {!!n.rules && (
                <Check
                  label="Acepto las normas de este torneo"
                  checked={accepted}
                  onChange={setAccepted}
                />
              )}
              <Button
                label={busy ? "Inscribiendo…" : "Inscribir a mi club"}
                disabled={busy || (!!n.rules && !accepted)}
                onPress={async () => {
                  setBusy(true);
                  setErr("");
                  try {
                    await registerMyClub(accepted);
                    setNotice("Inscripción guardada.");
                  } catch (e) {
                    setErr(errorText(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </>
          )}
        </View>
      )}
      {!!notice && <Note>{notice}</Note>}
      {!!err && !grace && (
        <Text style={s.error} accessibilityRole="alert">
          {err}
        </Text>
      )}
      {grace && (
        <Sheet
          title="Dar margen de tiempo"
          onClose={() => !busy && setGrace(false)}
        >
          <Field
            label="Minutos adicionales"
            value={minutes}
            onChangeText={setMinutes}
            numeric
            maxLength={3}
          />
          <Text style={s.subtitle}>
            Se actualizará la hora de inicio visible para los capitanes. La
            inscripción seguirá abierta.
          </Text>
          {!!err && <Text style={s.error}>{err}</Text>}
          <Button
            label={busy ? "Guardando…" : "Conceder margen"}
            disabled={busy}
            onPress={async () => {
              const value = Number(minutes);
              if (!Number.isInteger(value) || value < 1 || value > 120) {
                setErr("Indica entre 1 y 120 minutos.");
                return;
              }
              setBusy(true);
              try {
                await extendStart(value);
                setGrace(false);
              } catch (e) {
                setErr(errorText(e));
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
function TournamentRegistrations() {
  const {
    night: n,
    myClub,
    isAdmin,
    addClub,
    setExcluded,
    assignCaptain,
  } = useApp();
  const [add, setAdd] = useState(false),
    [name, setName] = useState(""),
    [phones, setPhones] = useState(["", "", ""]),
    [target, setTarget] = useState<string | null>(null),
    [linkTarget, setLinkTarget] = useState<string | null>(null),
    [captainEa, setCaptainEa] = useState(""),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [err, setErr] = useState("");
  if (!n) return null;
  const selected = n.clubs.find((c) => c.id === target),
    closed = !!n.tournaments.length;
  return (
    <Page title="Inscritos" subtitle={n.name}>
      <Refresh />
      <Note>
        {n.clubs.length} inscritos · {eligible(n).length} dentro. Se conserva el
        orden de llegada aunque la organización deje un club fuera.
      </Note>
      {isAdmin && !closed && (
        <Button
          label="＋ Añadir club"
          onPress={() => {
            setName("");
            setPhones(["", "", ""]);
            setErr("");
            setAdd(true);
          }}
        />
      )}
      {!n.clubs.length && (
        <Text style={s.subtitle}>Todavía no hay clubes inscritos.</Text>
      )}
      {n.clubs.map((c, i) => (
        <View key={c.id} style={[s.card, c.excluded && { opacity: 0.75 }]}>
          <View style={s.row}>
            <ClubBadge uri={c.badgeUrl} name={c.name} size={36} />
            <Text style={[s.heading, { flex: 1 }]}>{c.name}</Text>
            <Badge>
              {c.excluded ? "FUERA" : closed ? "PARTICIPANTE" : "INSCRITO"}
            </Badge>
          </View>
          <Text style={s.subtitle}>
            Inscripción #{c.registrationOrder ?? i + 1}
            {c.registeredAt
              ? ` · ${new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Madrid" }).format(new Date(c.registeredAt))}`
              : ""}
          </Text>
          {c.excluded && c.exclusionReason && <Note>{c.exclusionReason}</Note>}
          {(isAdmin ||
            n.clubs.some((own) => own.id === myClub?.id && !own.excluded)) &&
            c.id !== myClub?.id &&
            !c.excluded &&
            !n.endedAt && (
              <WhatsAppContact
                phones={c.contacts}
                fromClub={myClub?.name || "la organización"}
                tournamentName={n.name}
              />
            )}
          {isAdmin && !c.captainId && !c.deletedAt && (
            <Button
              secondary
              label="Vincular capitán"
              onPress={() => {
                setLinkTarget(c.id);
                setCaptainEa("");
                setErr("");
              }}
            />
          )}
          {isAdmin && !closed && (
            <Button
              secondary
              label={
                c.excluded ? "Volver a incluir" : "Dejar fuera de este torneo"
              }
              onPress={() => {
                setTarget(c.id);
                setReason(c.excluded ? "Readmitido por la organización." : "");
                setErr("");
              }}
            />
          )}
        </View>
      ))}
      {add && (
        <Sheet title="Añadir club" onClose={() => !busy && setAdd(false)}>
          <Field
            label="Nombre del club"
            value={name}
            onChangeText={setName}
            maxLength={50}
          />
          {phones.map((v, i) => (
            <Field
              key={i}
              label={
                i === 0
                  ? "WhatsApp del capitán · obligatorio"
                  : `Contacto ${i + 1} · opcional`
              }
              phone
              placeholder="+34 612 345 678"
              value={v}
              maxLength={24}
              onChangeText={(v) =>
                setPhones((a) => a.map((x, j) => (j === i ? v : x)))
              }
            />
          ))}
          {!!err && <Text style={s.error}>{err}</Text>}
          <Button
            label={busy ? "Guardando…" : "Añadir a inscritos"}
            disabled={busy}
            onPress={async () => {
              if (!name.trim()) {
                setErr("Escribe el nombre del club.");
                return;
              }
              setBusy(true);
              try {
                await addClub(name, phones);
                setAdd(false);
              } catch (e) {
                setErr(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          />
        </Sheet>
      )}
      {selected && (
        <Sheet
          title={selected.excluded ? "Volver a incluir" : "Dejar club fuera"}
          onClose={() => !busy && setTarget(null)}
        >
          <Text style={s.heading}>{selected.name}</Text>
          <Field
            label="Motivo para el capitán"
            value={reason}
            onChangeText={setReason}
            maxLength={500}
            multiline
          />
          <Note>
            El capitán podrá consultar este aviso en el torneo. Las
            notificaciones push se incorporarán más adelante.
          </Note>
          {!!err && <Text style={s.error}>{err}</Text>}
          <Button
            label={busy ? "Guardando…" : "Confirmar decisión"}
            disabled={busy}
            onPress={async () => {
              if (!reason.trim()) {
                setErr("Indica el motivo de la decisión.");
                return;
              }
              setBusy(true);
              try {
                await setExcluded(selected.id, !selected.excluded, reason);
                setTarget(null);
              } catch (e) {
                setErr(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          />
        </Sheet>
      )}
      {linkTarget && (
        <Sheet
          title="Vincular capitán"
          onClose={() => !busy && setLinkTarget(null)}
        >
          <Field
            label="ID de EA del capitán"
            value={captainEa}
            onChangeText={setCaptainEa}
            maxLength={40}
            autoCapitalize="none"
          />
          <Note>
            El capitán debe tener una cuenta y no representar ya a otro club.
          </Note>
          {!!err && <Text style={s.error}>{err}</Text>}
          <Button
            label={busy ? "Guardando…" : "Vincular"}
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              try {
                await assignCaptain(linkTarget, captainEa);
                setLinkTarget(null);
              } catch (e) {
                setErr(errorText(e));
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
function shuffle(ids: string[]) {
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) {
    const limit = 4294967296 - (4294967296 % (i + 1));
    let k: number;
    do {
      k = Crypto.getRandomValues(new Uint32Array(1))[0];
    } while (k >= limit);
    k %= i + 1;
    [a[i], a[k]] = [a[k], a[i]];
  }
  return a;
}
function TournamentCompetition() {
  const { night: n, isAdmin, confirmPlan, finishTournament } = useApp(),
    nav = useTournamentNav();
  const clubs = n ? eligible(n) : [],
    size = clubs.length as Size,
    valid = [4, 6, 8].includes(size);
  const [kind, setKind] = useState<CompetitionFormat>(
      defaultFormat(valid ? size : 4),
    ),
    [random, setRandom] = useState(true),
    [draft, setDraft] = useState<Tournament | null>(null),
    [busy, setBusy] = useState(false),
    [err, setErr] = useState("");
  useEffect(() => {
    setDraft(null);
    setKind(defaultFormat(valid ? size : 4));
    setErr("");
  }, [n?.id, size]);
  if (!n) return null;
  const confirmed = n.tournaments[0],
    shown = confirmed ?? draft,
    canStart = !n.effectiveStart || Date.now() >= Date.parse(n.effectiveStart);
  return (
    <Page title="Competición" subtitle={n.name}>
      <Refresh />
      {!confirmed && (
        <View style={s.card}>
          <Text style={s.heading}>{clubs.length} clubes dentro del torneo</Text>
          {isAdmin ? (
            <>
              {!valid ? (
                <>
                  <Note>
                    Con la configuración actual se pueden organizar torneos de
                    4, 6 u 8 clubes, con un máximo de cinco partidos por equipo.
                    Revisa qué participantes entran o concede más margen si
                    falta alguno.
                  </Note>
                  <Button
                    label="Revisar inscritos"
                    onPress={() => nav.setParams({ section: "Inscritos" })}
                  />
                  <Button
                    secondary
                    label="Ver hora y dar margen"
                    onPress={() => nav.setParams({ section: "Información" })}
                  />
                </>
              ) : (
                <>
                  <Text style={s.subtitle}>
                    Elige el formato para estos {size} clubes. La decisión final
                    es de la organización.
                  </Text>
                  <View style={s.wrap}>
                    {supportedFormats(size).map((value) => (
                      <Button
                        key={value}
                        label={`${kind === value ? "●" : "○"} ${value === "copa" ? "Copa" : "Liga"}`}
                        secondary={kind !== value}
                        onPress={() => {
                          setKind(value);
                          setDraft(null);
                        }}
                      />
                    ))}
                  </View>
                  <Text style={s.text}>
                    {format(size, kind)} · Máximo {maxMatches(size, kind)}{" "}
                    partidos.
                  </Text>
                  <Check
                    label="Sortear el orden de los clubes"
                    checked={random}
                    onChange={(v) => {
                      setRandom(v);
                      setDraft(null);
                    }}
                  />
                  <Button
                    label="Revisar configuración"
                    onPress={() => {
                      setErr("");
                      setDraft({
                        id: Crypto.randomUUID(),
                        size,
                        format: kind,
                        clubIds: random
                          ? shuffle(clubs.map((c) => c.id))
                          : clubs.map((c) => c.id),
                      });
                    }}
                  />
                </>
              )}
              {!canStart && (
                <Note>
                  Podrás confirmar el inicio a partir de {startText(n)}, hora de
                  Madrid.
                </Note>
              )}
            </>
          ) : (
            <Text style={s.subtitle}>
              La organización decidirá Copa o Liga y confirmará los
              participantes a la hora indicada.
            </Text>
          )}
        </View>
      )}
      {confirmed && <Badge>{tournamentState(n).toUpperCase()}</Badge>}
      {confirmed && isAdmin && !n.endedAt && (
        <Confirm
          label="Finalizar torneo"
          title="Finalizar torneo"
          message="El torneo dejará de aparecer como actual en Inicio. Su competición se conservará en Torneos."
          onConfirm={finishTournament}
        />
      )}
      {shown && (
        <>
          <View style={s.card}>
            <Badge>
              {confirmed
                ? "CONFIGURACIÓN CONFIRMADA"
                : "REVISIÓN ANTES DE INICIAR"}
            </Badge>
            <Text style={s.heading}>{format(shown.size, shown.format)}</Text>
            <Text style={s.subtitle}>
              {shown.size} participantes · Máximo{" "}
              {maxMatches(shown.size, shown.format)} partidos por equipo.
            </Text>
            {!confirmed &&
              shown.clubIds.map((id) => (
                <Text key={id} style={s.text}>
                  {n.clubs.find((c) => c.id === id)?.name}
                </Text>
              ))}
            {!confirmed && isAdmin && (
              <Button
                label={
                  busy ? "Guardando…" : "Confirmar formato e iniciar torneo"
                }
                disabled={busy || !canStart}
                onPress={async () => {
                  setBusy(true);
                  setErr("");
                  try {
                    validatePlan(n, [shown]);
                    await confirmPlan([shown]);
                    setDraft(null);
                  } catch (e) {
                    setErr(errorText(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            )}
          </View>
          {confirmed
            ? n.tournaments.map((t) => (
                <CompetitionBoard key={t.id} night={n} tournament={t} manage />
              ))
            : competitionPhases(shown).map((phase, i) => (
                <View key={i} style={{ gap: 14 }}>
                  <Text style={s.heading}>{phase.title}</Text>
                  {phase.rounds.map((round, r) => (
                    <View key={r} style={s.card}>
                      <Text style={s.eyebrow}>{round.label.toUpperCase()}</Text>
                      {round.matches.map(([a, b], m) => (
                        <View key={m} style={s.row}>
                          <Text style={[s.text, { flex: 1 }]}>
                            {n.clubs.find((c) => c.id === a)?.name ?? a}
                          </Text>
                          <Text style={s.subtitle}>vs</Text>
                          <Text
                            style={[s.text, { flex: 1, textAlign: "right" }]}
                          >
                            {n.clubs.find((c) => c.id === b)?.name ?? b}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              ))}
        </>
      )}
      {!!err && (
        <Text style={s.error} accessibilityRole="alert">
          {err}
        </Text>
      )}
    </Page>
  );
}
