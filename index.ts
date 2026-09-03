import { withSupabase } from "npm:@supabase/server@^1";

type SellerBody = {
  event_id?: string;
  full_name?: string;
  username?: string;
  password?: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
      return json({ error: "Método não permitido." }, 405);
    }

    const requesterId = ctx.userClaims?.sub;
    if (!requesterId) {
      return json({ error: "Sessão inválida." }, 401);
    }

    const admin = ctx.supabaseAdmin;

    const { data: requesterProfile, error: profileError } = await admin
      .from("profiles")
      .select("id, role, active")
      .eq("id", requesterId)
      .maybeSingle();

    if (profileError) {
      console.error("profile lookup:", profileError);
      return json({ error: "Erro ao consultar perfil ADM." }, 500);
    }

    if (
      !requesterProfile ||
      requesterProfile.role !== "ADM" ||
      requesterProfile.active !== true
    ) {
      return json({ error: "Apenas ADM pode criar vendedores." }, 403);
    }

    let body: SellerBody;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Dados inválidos." }, 400);
    }

    const eventId = String(body.event_id ?? "").trim();
    const fullName = String(body.full_name ?? "").trim();
    const username = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!eventId || !fullName || !username || !password) {
      return json({ error: "Preencha todos os campos." }, 400);
    }

    if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
      return json(
        {
          error:
            "Usuário inválido. Use 3 a 40 caracteres: letras, números, ponto, hífen ou sublinhado.",
        },
        400,
      );
    }

    if (password.length < 6) {
      return json({ error: "A senha precisa ter pelo menos 6 caracteres." }, 400);
    }

    const { data: event, error: eventError } = await admin
      .from("events")
      .select("id, name, status")
      .eq("id", eventId)
      .maybeSingle();

    if (eventError) {
      console.error("event lookup:", eventError);
      return json({ error: "Erro ao consultar o evento." }, 500);
    }

    if (!event) {
      return json({ error: "Evento não encontrado." }, 404);
    }

    if (event.status !== "ABERTO") {
      return json({ error: "O vendedor só pode ser criado em evento ABERTO." }, 400);
    }

    const email = `${username}@login.versatille-eventos.local`;

    // The admin client is server-side and is allowed to create the Auth user.
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role: "VENDEDOR",
          login_type: "event_seller",
        },
      });

    if (createError || !created.user) {
      console.error("create auth user:", createError);
      const msg = createError?.message || "";

      if (
        /already registered|already exists|duplicate/i.test(msg)
      ) {
        return json({ error: "Esse usuário já existe. Escolha outro." }, 409);
      }

      return json(
        { error: createError?.message || "Não foi possível criar o vendedor." },
        400,
      );
    }

    const sellerId = created.user.id;

    const { error: profileUpsertError } = await admin
      .from("profiles")
      .upsert(
        {
          id: sellerId,
          full_name: fullName,
          role: "VENDEDOR",
          active: true,
        },
        { onConflict: "id" },
      );

    if (profileUpsertError) {
      console.error("profile upsert:", profileUpsertError);
      await admin.auth.admin.deleteUser(sellerId);
      return json({ error: "Não foi possível criar o perfil do vendedor." }, 500);
    }

    const { error: sellerLinkError } = await admin
      .from("event_sellers")
      .insert({
        event_id: eventId,
        user_id: sellerId,
        active: true,
      });

    if (sellerLinkError) {
      console.error("event_sellers insert:", sellerLinkError);
      await admin.auth.admin.deleteUser(sellerId);

      if (sellerLinkError.code === "23505") {
        return json({ error: "Esse vendedor já está vinculado a este evento." }, 409);
      }

      return json(
        { error: "Não foi possível vincular o vendedor ao evento." },
        500,
      );
    }

    await admin.from("audit_logs").insert({
      user_id: requesterId,
      event_id: eventId,
      action: "CREATE_EVENT_SELLER",
      details: {
        seller_id: sellerId,
        username,
        full_name: fullName,
      },
    });

    return json({
      success: true,
      seller_id: sellerId,
      username,
      event_id: eventId,
    });
  }),
};
