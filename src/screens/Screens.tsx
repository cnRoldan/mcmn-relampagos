import React, { useState } from "react";
import { Text, View, Pressable, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { DrawerNavigationProp } from "@react-navigation/drawer";
import { tournamentTime } from "./SharedTournament";
import { MemberModeration } from "./MemberModeration";
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
      title="Tu torneo empieza aquí"
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
          TORNEOS MCM · CLUBES PRO
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
            ? night.effectiveStart
              ? `${tournamentTime(night.effectiveStart)} · Madrid`
              : `${showDate(night.date)} · ${night.time} h · Madrid`
            : "Prepara los relámpagos de tu comunidad de Clubes Pro."}
        </Text>
        {night && (
          <Badge>
            {night.demo
              ? "TORNEO DE EJEMPLO"
              : night.tournaments.length
                ? "REPARTO CONFIRMADO"
                : "INSCRIPCIONES ABIERTAS"}
          </Badge>
        )}
        <Button
          label={
            night
              ? "Ver torneo →"
              : isAdmin
                ? "Crear mi primer torneo →"
                : "Ver torneos →"
          }
          accent
          onPress={() =>
            nav.navigate("Torneos", {
              section: night ? "Información" : "Listado",
              tournamentId: night?.id,
            })
          }
        />
      </View>
      <View style={s.row}>
        {[
          ["Clubes", night?.clubs.length || 0],
          [
            "Participantes",
            night?.clubs.filter((c) => !c.excluded).length || 0,
          ],
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
          "Prepara la competición",
          "El administrador decidirá Copa o Liga según los participantes.",
          "Competición",
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
      <MemberModeration />
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
          message="Se eliminarán los torneos y los clubes de prueba guardados en este dispositivo."
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

export function MyClub() {
  const { mode, myClub, saveMyClub, updateContacts, night } = useApp();
  const { profile } = useAuth();
  const nav = useNavigation<DrawerNavigationProp<Routes>>();
  const [editing, setEditing] = useState(false),
    [name, setName] = useState(""),
    [contacts, setContacts] = useState(["", "", ""]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const registration = myClub
    ? night?.clubs.find((c) => c.id === myClub.id)
    : undefined;
  const registered = !!registration && !registration.excluded;
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
                {registration?.excluded
                  ? `Tu club ha quedado fuera de este torneo. ${registration.exclusionReason || "Consulta con la organización."}`
                  : registered
                    ? `Tu club está inscrito con el número #${registration?.registrationOrder}.`
                    : night.tournaments.length
                      ? "Las inscripciones están cerradas."
                      : "Inscripción por orden de llegada. Tu puesto se asigna al confirmar en el servidor."}
              </Text>
              <Button
                label={
                  registered ? "Club inscrito" : "Ver torneo e inscribirme"
                }
                disabled={
                  registered ||
                  !!registration?.excluded ||
                  !!night.tournaments.length ||
                  busy
                }
                onPress={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    nav.navigate("Torneos", {
                      section: "Información",
                      tournamentId: night.id,
                    });
                  } catch (e) {
                    setError(message(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              />
              <Button
                secondary
                label="Elegir otro torneo"
                onPress={() => nav.navigate("Torneos", { section: "Listado" })}
              />
            </View>
          ) : (
            <Button
              label="Ver torneos"
              onPress={() => nav.navigate("Torneos", { section: "Listado" })}
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

export { TournamentHub } from "./TournamentScreens";
