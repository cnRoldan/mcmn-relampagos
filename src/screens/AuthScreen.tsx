import React, { useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../cloud/AuthProvider";
import { BrandLogo } from "../components/BrandLogo";
import { Button, Field, Note, Page } from "../components/UI";
import { styles as s } from "../theme";
export function AuthScreen() {
  const { configured, signIn, signUp, error: authError } = useAuth(),
    [signup, setSignup] = useState(false),
    [ea, setEa] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [repeat, setRepeat] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  return (
    <SafeAreaView style={s.page}>
      <Page
        title={signup ? "Cuenta de capitán" : "Acceso de capitanes"}
        subtitle="Tu ID de EA. Tu club. Tu comunidad."
      >
        <BrandLogo />
        {!configured && (
          <Note>
            El acceso se activará cuando termine la conexión con el servidor.
          </Note>
        )}
        <View style={s.card}>
          <Field
            label="ID de EA"
            value={ea}
            onChangeText={setEa}
            placeholder="Tu ID de EA"
            maxLength={40}
            autoCapitalize="none"
          />
          {signup && (
            <Field
              label="Correo de recuperación"
              value={email}
              onChangeText={setEmail}
              placeholder="tu@correo.com"
              maxLength={254}
              email
            />
          )}
          <Field
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            placeholder={signup ? "Mínimo 10 caracteres" : "Tu contraseña"}
            maxLength={128}
            secure
          />
          {signup && (
            <Field
              label="Repite la contraseña"
              value={repeat}
              onChangeText={setRepeat}
              maxLength={128}
              secure
            />
          )}
          {signup && (
            <Text style={s.subtitle}>
              El correo permite confirmar y recuperar tu cuenta. Para iniciar
              sesión utilizarás tu ID de EA.
            </Text>
          )}
          {!!(error || authError) && (
            <Text accessibilityRole="alert" style={s.error}>
              {error || authError}
            </Text>
          )}
          {!!notice && <Note>{notice}</Note>}
          <Button
            label={busy ? "Conectando…" : signup ? "Crear mi cuenta" : "Entrar"}
            disabled={busy || !configured}
            onPress={async () => {
              setError("");
              setNotice("");
              if (!/^[\p{L}\p{M}\p{N}_ -]{3,40}$/u.test(ea.trim())) {
                setError(
                  "Escribe un ID de EA de 3 a 40 letras, números, guiones o guiones bajos.",
                );
                return;
              }
              if (signup && (password.length < 10 || password !== repeat)) {
                setError(
                  "La contraseña debe tener al menos 10 caracteres y coincidir.",
                );
                return;
              }
              setBusy(true);
              try {
                if (signup) {
                  setNotice(await signUp(ea, email, password));
                  setPassword("");
                  setRepeat("");
                } else await signIn(ea, password);
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "No se pudo acceder.",
                );
              } finally {
                setBusy(false);
              }
            }}
          />
          <Button
            label={signup ? "Ya tengo cuenta" : "Crear cuenta de capitán"}
            secondary
            disabled={busy}
            onPress={() => {
              setSignup(!signup);
              setError("");
              setNotice("");
              setPassword("");
              setRepeat("");
            }}
          />
        </View>
      </Page>
    </SafeAreaView>
  );
}
