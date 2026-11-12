import { createClient } from "npm:@supabase/supabase-js@2";
import { purgeBadgeFiles } from "../_shared/badges.ts";
import { handleAccountDeletion } from "./handler.ts";
// The body authenticates the current user and rechecks the password. No service
// credential or caller-chosen target ID is ever sent to the client.
Deno.serve((req: Request) => {
  const url = Deno.env.get("SUPABASE_URL")!,
    secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const auth = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return handleAccountDeletion(req, {
    verifyAccess: async (token) => {
      const { data, error } = await admin.auth.getUser(token);
      return error || !data.user?.email
        ? null
        : { id: data.user.id, email: data.user.email };
    },
    allowAttempt: async (id) => {
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode("account-delete:" + id),
      );
      const key = Array.from(new Uint8Array(digest), (v) =>
        v.toString(16).padStart(2, "0"),
      ).join("");
      const { data, error } = await admin.rpc("consume_auth_attempt", {
        p_key: key,
      });
      if (error) throw error;
      return data === true;
    },
    verifyPassword: async (email, password) => {
      const { data, error } = await auth.auth.signInWithPassword({
        email,
        password,
      });
      return error || !data.session
        ? null
        : { id: data.user.id, accessToken: data.session.access_token };
    },
    prepare: async (id) => {
      const { error } = await admin.rpc("prepare_account_deletion", {
        p_member_id: id,
      });
      if (error) throw error;
    },
    purgeFiles: (id) => purgeBadgeFiles(admin.storage, id),
    revoke: async (token) => {
      const { error } = await admin.auth.admin.signOut(token, "global");
      if (error) throw error;
    },
    remove: async (id) => {
      const { error } = await admin.auth.admin.deleteUser(id, false);
      if (error) throw error;
    },
  });
});
