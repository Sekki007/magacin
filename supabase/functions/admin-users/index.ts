import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

serve(async (req) => {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const body = await req.json();
  const { action } = body;

  // 🔹 LIST USERS
  if (action === "list") {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    return Response.json({ data, error });
  }

  // 🔹 CREATE USER
  if (action === "create") {
    const { email, password, username, uloga } = body;

    const { data: user, error } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (error) return Response.json({ error }, { status: 400 });

    await supabaseAdmin.from("profiles").insert({
      id: user.user.id,
      username,
      uloga,
    });

    return Response.json({ success: true });
  }

  // 🔹 DELETE USER
  if (action === "delete") {
    const { userId } = body;

    const { error } =
      await supabaseAdmin.auth.admin.deleteUser(userId);

    return Response.json({ success: !error, error });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
});
