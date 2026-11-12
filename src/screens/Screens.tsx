import React, { useState } from "react";
import { Text, View, ActivityIndicator } from "react-native";
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
import {
  currentTournament,
  tournamentState,
} from "../domain/currentTournament";
import { ClubBadge } from "../components/ClubBadge";
import { pickBadge } from "../cloud/pickBadge";
import type { BadgeSelection } from "../domain/badges";
import { DeleteAccount } from "../components/DeleteAccount";
import { DeleteClub } from "../components/DeleteClub";
import { PrivacyPolicyButton } from "../components/PrivacyPolicy";
import { CompetitionBoard } from "../components/CompetitionBoard";
import { WhatsAppContact } from "../components/WhatsAppContact";
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
        ? "Inscripciones por orden de llegada. Los teléfonos se comparten con los capitanes del mismo torneo y los administradores para coordinar por WhatsApp."
        : "Versión de prueba · Datos guardados solo en este dispositivo."}
    </Note>
  );
}
export function Home() {
  const { data, myClub, ready, error, isAdmin } = useApp();
  const nav = useNavigation<DrawerNavigationProp<Routes>>();
  const current = currentTournament(data.nights);
  const clubs =
    current?.clubs
      .filter((c) => !c.excluded)
      .sort(
        (a, b) => (a.registrationOrder ?? 0) - (b.registrationOrder ?? 0),
      ) || [];
  const canContact =
    isAdmin || !!(myClub && clubs.some((c) => c.id === myClub.id));
  return (
    <Page title="Inicio" subtitle="Tu torneo relámpago, de un vistazo.">
      <Status />
      {!ready ? (
        <Note>Cargando el torneo actual…</Note>
      ) : !current ? (
        <View style={s.card}>
          <Badge>SIN TORNEO ACTUAL</Badge>
          <Text style={s.heading}>
            {error
              ? "No se pudo cargar el torneo"
              : "Aún no hay un torneo activo"}
          </Text>
          <Text style={s.subtitle}>
            {error
              ? "Pulsa Actualizar para volver a intentarlo."
              : "Aquí verás el próximo torneo y sus equipos en cuanto la organización lo prepare."}
          </Text>
          <Button
            label={isAdmin ? "Crear torneo" : "Ver torneos"}
            onPress={() => nav.navigate("Torneos", { section: "Listado" })}
          />
        </View>
      ) : (
        <>
          <View
            style={[
              s.card,
              { backgroundColor: colors.dark, borderColor: colors.dark },
            ]}
          >
            <Badge>{tournamentState(current).toUpperCase()}</Badge>
            <Text style={[s.heading, { color: colors.white, fontSize: 28 }]}>
              {current.name}
            </Text>
            <Text
              style={{ color: colors.onDark, fontSize: 15, lineHeight: 22 }}
            >
              {current.effectiveStart
                ? tournamentTime(current.effectiveStart)
                : `${showDate(current.date)} · ${current.time} h`}{" "}
              · Madrid
            </Text>
            <Text style={{ color: colors.onDark, lineHeight: 22 }}>
              {current.tournaments.length
                ? "El torneo ya ha comenzado. Consulta la competición y contacta con los otros capitanes."
                : "Los clubes se están apuntando. La organización decidirá el formato y confirmará el inicio."}
            </Text>
            <Button
              accent
              label={
                current.tournaments.length
                  ? "Ver competición"
                  : "Ver torneo e inscribirme"
              }
              onPress={() =>
                nav.navigate("Torneos", {
                  tournamentId: current.id,
                  section: current.tournaments.length
                    ? "Competición"
                    : "Información",
                })
              }
            />
          </View>
          {current.tournaments.map((t) => (
            <CompetitionBoard key={t.id} night={current} tournament={t} />
          ))}
          <Text style={s.heading}>Equipos apuntados · {clubs.length}</Text>
          {!clubs.length && (
            <Note>
              Todavía no hay equipos apuntados. Sé el primero en inscribir tu
              club.
            </Note>
          )}
          {clubs.map((club, i) => (
            <View key={club.id} style={s.card}>
              <View style={s.row}>
                <ClubBadge uri={club.badgeUrl} name={club.name} size={36} />
                <Text style={[s.heading, { flex: 1 }]}>{club.name}</Text>
                {club.id === myClub?.id && <Badge>TU CLUB</Badge>}
              </View>
              <Text style={s.subtitle}>
                Inscripción #{club.registrationOrder ?? i + 1}
              </Text>
              {canContact && club.id !== myClub?.id && (
                <WhatsAppContact
                  phones={club.contacts}
                  fromClub={myClub?.name || "la organización"}
                  tournamentName={current.name}
                />
              )}
              {canContact &&
                club.id !== myClub?.id &&
                !club.contacts.length && (
                  <Text style={s.subtitle}>
                    Teléfono pendiente de configurar.
                  </Text>
                )}
            </View>
          ))}
          {!canContact && (
            <Note>
              Inscribe tu club para contactar por WhatsApp con los capitanes de
              este torneo.
            </Note>
          )}
        </>
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
      <PrivacyPolicyButton />
      <MemberModeration />
      {mode === "cloud" ? (
        <>
          <DeleteAccount />
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
          Notificaciones push, nuevos formatos y gestión de bajas después del
          inicio.
        </Text>
      </View>
    </Page>
  );
}

export function MyClub() {
  const { mode, myClub, saveMyClub, updateMyClub, night } = useApp();
  const { profile } = useAuth();
  const nav = useNavigation<DrawerNavigationProp<Routes>>();
  const [editing, setEditing] = useState(false),
    [name, setName] = useState(""),
    [contacts, setContacts] = useState(["", "", ""]),
    [badge, setBadge] = useState<BadgeSelection | null | undefined>(undefined),
    [picking, setPicking] = useState(false),
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
            <ClubBadge uri={myClub.badgeUrl} name={myClub.name} size={96} />
            <Text style={s.heading}>{myClub.name}</Text>
            <Text style={s.subtitle}>
              WhatsApp del club · visible para los capitanes inscritos en tu
              mismo torneo y los administradores.
            </Text>
            {myClub.contacts.length ? (
              myClub.contacts.map((phone, i) => (
                <Text style={s.text} key={i}>
                  {phone}
                </Text>
              ))
            ) : (
              <Text style={s.subtitle}>
                Añade un teléfono de WhatsApp para poder inscribir tu club.
              </Text>
            )}
            <Button
              secondary
              label="Editar mi club"
              onPress={() => {
                setName(myClub.name);
                setBadge(undefined);
                setContacts([0, 1, 2].map((i) => myClub.contacts[i] || ""));
                setError("");
                setEditing(true);
              }}
            />
          </View>
          <DeleteClub />
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
            Necesitas su nombre y un teléfono de WhatsApp. No hay jugadores ni
            plantillas que registrar.
          </Text>
          <Button
            label="Crear mi club"
            onPress={() => {
              setName("");
              setBadge(undefined);
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
          title={myClub ? "Editar mi club" : "Crear mi club"}
          onClose={() => !busy && setEditing(false)}
        >
          <Field
            label="Nombre del club"
            value={name}
            onChangeText={setName}
            maxLength={50}
          />
          <View style={{ gap: 12, alignItems: "flex-start" }}>
            <Text style={s.heading}>Escudo del club · opcional</Text>
            <ClubBadge
              uri={badge === undefined ? myClub?.badgeUrl : badge?.uri}
              name={name || "Mi club"}
              size={96}
            />
          </View>
          <Text style={s.subtitle}>
            PNG con transparencia o JPG. Máximo 2 MB y 4096 × 4096 píxeles. La
            imagen se conserva sin recortar ni añadir fondo.
          </Text>
          <Button
            secondary
            label={picking ? "Abriendo imágenes…" : "Seleccionar escudo"}
            disabled={busy || picking}
            onPress={async () => {
              setPicking(true);
              setError("");
              try {
                const selected = await pickBadge();
                if (selected) setBadge(selected);
              } catch (e) {
                setError(message(e));
              } finally {
                setPicking(false);
              }
            }}
          />
          {(badge || (badge === undefined && myClub?.badgeUrl)) && (
            <Button
              secondary
              label="Quitar escudo"
              disabled={busy || picking}
              onPress={() => setBadge(null)}
            />
          )}
          <Note>
            Añade al menos un teléfono de WhatsApp con prefijo internacional
            (por ejemplo +34 612 345 678). Podrán verlo los capitanes inscritos
            en tu mismo torneo y los administradores.
          </Note>
          {contacts.map((v, i) => (
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
            disabled={busy || picking || !name.trim()}
            onPress={async () => {
              setBusy(true);
              setError("");
              try {
                const image = badge ? { base64: badge.base64 } : badge;
                if (myClub) await updateMyClub(name, contacts, image);
                else await saveMyClub(name, contacts, image);
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
        El historial de títulos se incorporará al confirmar los campeones de
        cada torneo.
      </Note>
    </Page>
  );
}

export { TournamentHub } from "./TournamentScreens";
