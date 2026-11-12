import { createClient } from "npm:@supabase/supabase-js@2";
import { handleClubProfile } from "./handler.ts";
import { BADGE_BUCKET, purgeBadgeFiles } from "../_shared/badges.ts";
Deno.serve((req: Request) => {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await admin.rpc(name, args);
    if (error) {
      if (error.code === "23505")
        throw new Error(
          "El club ha cambiado o ese nombre ya existe. Elige otro nombre o actualiza.",
        );
      throw new Error(error.message);
    }
    return data;
  };
  return handleClubProfile(req, {
    verify: async (token) => {
      const { data, error } = await admin.auth.getUser(token);
      return error ? null : data.user?.id || null;
    },
    acquire: (id, deleting) =>
      rpc("begin_club_operation", { p_member_id: id, p_delete: deleting }),
    release: (id, token) =>
      rpc("end_club_operation", { p_member_id: id, p_token: token }),
    current: async (id) => {
      const { data, error } = await admin
        .from("clubs")
        .select("name,badge_path")
        .eq("owner_id", id)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    upload: async (path, bytes, mime) => {
      const { error } = await admin.storage
        .from(BADGE_BUCKET)
        .upload(path, bytes, {
          contentType: mime,
          cacheControl: "60",
          upsert: false,
        });
      if (error) throw error;
    },
    discard: async (path) => {
      const { error } = await admin.storage.from(BADGE_BUCKET).remove([path]);
      if (error) throw error;
    },
    purge: (id, keep) => purgeBadgeFiles(admin.storage, id, keep),
    save: (id, token, name, contacts, badge, version) =>
      rpc("save_club_profile", {
        p_member_id: id,
        p_token: token,
        p_name: name,
        p_contacts: contacts,
        p_badge_path: badge,
        p_version: version,
      }),
    remove: (id, token, confirmation) =>
      rpc("delete_club_profile", {
        p_member_id: id,
        p_token: token,
        p_confirmation: confirmation,
      }),
    uuid: () => crypto.randomUUID(),
  });
});
