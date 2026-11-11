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
          <Field
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            placeholder={signup ? "Mínimo 8 caracteres" : "Tu contraseña"}
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
              Esta cuenta y su contraseña pertenecen a MCM. Tu ID de EA
              identifica al capitán.
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
              if (signup && (password.length < 8 || password !== repeat)) {
                setError(
                  "La contraseña debe tener al menos 8 caracteres y coincidir.",
                );
                return;
              }
              setBusy(true);
              try {
                if (signup) {
                  setNotice(await signUp(ea, password));
                  setSignup(false);
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
