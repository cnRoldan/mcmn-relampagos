import React, { useState } from "react";
import {
  Pressable,
  Text,
  View,
  TextInput,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, styles as s } from "../theme";
export function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
  danger = false,
  accent = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  danger?: boolean;
  accent?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        minHeight: 48,
        paddingHorizontal: 17,
        paddingVertical: 13,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: secondary ? colors.line : "transparent",
        backgroundColor: accent
          ? colors.accent
          : secondary
            ? "transparent"
            : danger
              ? colors.danger
              : colors.primary,
        justifyContent: "center",
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: "700",
          textAlign: "center",
          color: accent || secondary ? colors.ink : colors.white,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.badge}>
      <Text style={s.badgeText}>{children}</Text>
    </View>
  );
}
export function Note({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.note}>
      <Text style={s.noteText}>{children}</Text>
    </View>
  );
}
export function Field({
  label,
  value,
  onChangeText,
  placeholder = "",
  numeric = false,
  maxLength = 70,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  numeric?: boolean;
  maxLength?: number;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={s.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        keyboardType={numeric ? "number-pad" : "default"}
        maxLength={maxLength}
        autoCapitalize={numeric ? "none" : "sentences"}
      />
    </View>
  );
}
export function Page({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <ScrollView
      style={s.page}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={s.content}
    >
      <Text style={s.eyebrow}>CLUBES PRO · TU COMUNIDAD</Text>
      <Text accessibilityRole="header" style={s.title}>
        {title}
      </Text>
      {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
      {children}
    </ScrollView>
  );
}
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View
            style={{
              paddingHorizontal: 22,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderColor: colors.line,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text accessibilityRole="header" style={s.heading}>
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              onPress={onClose}
              hitSlop={10}
              style={{ padding: 12 }}
            >
              <Text style={{ fontSize: 24, color: colors.ink }}>×</Text>
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.content}
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
export function Confirm({
  label,
  title,
  message,
  onConfirm,
  danger = false,
}: {
  label: string;
  title: string;
  message: string;
  onConfirm: () => Promise<void>;
  danger?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <Button
        label={label}
        onPress={() => {
          setError("");
          setOpen(true);
        }}
        secondary
      />
      {open && (
        <Sheet title={title} onClose={() => !busy && setOpen(false)}>
          <Text style={s.text}>{message}</Text>
          {!!error && (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          )}
          <Button
            label={busy ? "Guardando…" : "Confirmar"}
            disabled={busy}
            danger={danger}
            onPress={async () => {
              setBusy(true);
              try {
                await onConfirm();
                setOpen(false);
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "No se pudo guardar.",
                );
              } finally {
                setBusy(false);
              }
            }}
          />
          <Button
            label="Cancelar"
            secondary
            disabled={busy}
            onPress={() => setOpen(false)}
          />
        </Sheet>
      )}
    </>
  );
}
