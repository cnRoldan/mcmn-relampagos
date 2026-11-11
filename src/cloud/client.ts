import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const cloudConfigured = Boolean(url && key);
type Manifest = { version: string; count: number };
const nativeStorage = {
  async getItem(key: string) {
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) return null;
    const m = JSON.parse(raw) as Manifest;
    if (!m.version || !Number.isInteger(m.count) || m.count < 1 || m.count > 30)
      throw new Error("Sesión local no válida.");
    const chunks = await Promise.all(
      Array.from({ length: m.count }, (_, i) =>
        SecureStore.getItemAsync(`${key}.${m.version}.${i}`),
      ),
    );
    if (chunks.some((c) => c === null))
      throw new Error("Sesión local incompleta.");
    return chunks.join("");
  },
  async setItem(key: string, value: string) {
    const old = await SecureStore.getItemAsync(key);
    const m: Manifest = {
      version: Crypto.randomUUID(),
      count: Math.max(1, Math.ceil(value.length / 1400)),
    };
    if (m.count > 30) throw new Error("Sesión demasiado grande.");
    for (let i = 0; i < m.count; i++)
      await SecureStore.setItemAsync(
        `${key}.${m.version}.${i}`,
        value.slice(i * 1400, (i + 1) * 1400),
      );
    await SecureStore.setItemAsync(key, JSON.stringify(m));
    if (old) {
      const o = JSON.parse(old) as Manifest;
      for (let i = 0; i < o.count; i++)
        await SecureStore.deleteItemAsync(`${key}.${o.version}.${i}`);
    }
  },
  async removeItem(key: string) {
    const raw = await SecureStore.getItemAsync(key);
    await SecureStore.deleteItemAsync(key);
    if (raw) {
      const m = JSON.parse(raw) as Manifest;
      for (let i = 0; i < m.count; i++)
        await SecureStore.deleteItemAsync(`${key}.${m.version}.${i}`);
    }
  },
};
export const supabase = cloudConfigured
  ? createClient(url!, key!, {
      auth: {
        storage: Platform.OS === "web" ? AsyncStorage : nativeStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;
