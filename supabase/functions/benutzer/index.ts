// Benutzerverwaltung für Admins.
// Aufruf: POST .../benutzer  mit { aktion: "...", ... }
// Aktionen: liste | anlegen | name | passwort | rolle | aktiv | pruefung
//
// Der service_role-Schlüssel wird von Supabase automatisch bereitgestellt.
// Er verlässt diese Function nie.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  });
}

const URL_ = Deno.env.get("SUPABASE_URL");
const KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const kopf = () => ({ apikey: KEY!, Authorization: `Bearer ${KEY}`,
                      "Content-Type": "application/json" });

// ---- Notfall-Administratoren ----
// Diese Konten behalten immer die Rolle admin und lassen sich nicht sperren.
// Damit bleibt ein Weg in die Verwaltung offen, auch wenn bei den übrigen
// Rollen etwas schiefgeht. Weitere Adresse nötig? Hier ergänzen.
const GESCHUETZT = ["admin@eventorganisation.ch"];
const istGeschuetzt = (mail: string) =>
  GESCHUETZT.includes(String(mail ?? "").trim().toLowerCase());

// Erlaubte Rollen — muss zum Check in spesen_benutzer passen.
const ROLLEN = ["admin", "supervisor", "projektleiter", "user"];
const rolleVon = (r: unknown) => ROLLEN.includes(String(r)) ? String(r) : "user";

// PATCH auf spesen_benutzer, mit Prüfung der Antwort
async function benutzerAendern(email: string, felder: Record<string, unknown>) {
  const r = await fetch(`${URL_}/rest/v1/spesen_benutzer?email=eq.${encodeURIComponent(email)}`, {
    method: "PATCH", headers: { ...kopf(), Prefer: "return=representation" },
    body: JSON.stringify(felder),
  });
  if (!r.ok) return "Datenbank: " + await r.text();
  const zeilen = await r.json();
  if (!Array.isArray(zeilen) || !zeilen.length) return "Benutzer nicht gefunden.";
  return null;
}

// ---- Wer ruft an, und ist er Admin? ----
async function pruefeAdmin(req: Request) {
  const h = req.headers.get("Authorization") ?? "";
  const token = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!token) return { ok: false, fehler: "Nicht angemeldet." };

  const r = await fetch(`${URL_}/auth/v1/user`, {
    headers: { apikey: KEY!, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return { ok: false, fehler: "Anmeldung ungültig." };
  const benutzer = await r.json();
  const email = String(benutzer?.email ?? "").toLowerCase();
  if (!email) return { ok: false, fehler: "Keine E-Mail im Token." };

  const r2 = await fetch(
    `${URL_}/rest/v1/spesen_benutzer?email=eq.${encodeURIComponent(email)}&select=rolle,aktiv`,
    { headers: kopf() });
  const zeilen = await r2.json();
  const z = Array.isArray(zeilen) ? zeilen[0] : null;
  if (!z || z.rolle !== "admin" || z.aktiv !== true) {
    return { ok: false, fehler: "Nur Administratoren dürfen das." };
  }
  return { ok: true, email };
}

// ---- Auth-Benutzer suchen ----
async function authBenutzer(email: string) {
  const r = await fetch(`${URL_}/auth/v1/admin/users?per_page=1000`, { headers: kopf() });
  const d = await r.json();
  const liste = d?.users ?? [];
  return liste.find((u: any) => String(u.email).toLowerCase() === email.toLowerCase()) ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  if (!URL_ || !KEY) {
    return json({ ok: false, fehler:
      "SUPABASE_SERVICE_ROLE_KEY fehlt. Unter Edge Functions → Secrets nachtragen." }, 500);
  }

  const wer = await pruefeAdmin(req);
  if (!wer.ok) return json({ ok: false, fehler: wer.fehler }, 403);

  let anfrage: any = {};
  try { anfrage = await req.json(); } catch { /* leer */ }
  const aktion = String(anfrage.aktion ?? "");
  const email  = String(anfrage.email ?? "").trim().toLowerCase();

  try {
    // ---------- Liste ----------
    if (aktion === "liste") {
      const r  = await fetch(`${URL_}/rest/v1/spesen_benutzer?select=*&order=rolle,email`,
                             { headers: kopf() });
      const eigene = await r.json();

      const r2 = await fetch(`${URL_}/auth/v1/admin/users?per_page=1000`, { headers: kopf() });
      const d2 = await r2.json();
      const auth = d2?.users ?? [];

      const benutzer = eigene.map((b: any) => {
        const a = auth.find((u: any) => String(u.email).toLowerCase() === b.email);
        return { ...b,
                 angemeldet: a?.last_sign_in_at ?? null,
                 gesperrt: a ? Boolean(a.banned_until &&
                            new Date(a.banned_until) > new Date()) : false,
                 vorhanden: Boolean(a),
                 geschuetzt: istGeschuetzt(b.email) };
      });
      return json({ ok: true, benutzer });
    }

    if (!email) return json({ ok: false, fehler: "E-Mail fehlt." }, 400);

    // ---------- Anlegen ----------
    if (aktion === "anlegen") {
      const passwort = String(anfrage.passwort ?? "");
      if (passwort.length < 6) return json({ ok:false, fehler:"Passwort zu kurz." }, 400);

      const r = await fetch(`${URL_}/auth/v1/admin/users`, {
        method: "POST", headers: kopf(),
        body: JSON.stringify({ email, password: passwort, email_confirm: true }),
      });
      const d = await r.json();
      if (!r.ok) return json({ ok:false, fehler: d?.msg || d?.message || "Anlegen fehlgeschlagen." }, 400);

      // Zweiter Schritt: die eigene Zeile. Geht der schief, wird das
      // Anmeldekonto wieder entfernt — sonst bleibt ein Konto zurück, das
      // sich anmelden kann, aber in keiner Liste auftaucht.
      const r2 = await fetch(`${URL_}/rest/v1/spesen_benutzer`, {
        method: "POST",
        headers: { ...kopf(), Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({ email, name: anfrage.name ?? null,
                               rolle: rolleVon(anfrage.rolle), aktiv: true,
                               // nur mitschicken, wenn an — so läuft die Function
                               // auch auf einer Datenbank ohne die Spalte
                               ...(anfrage.pruefung === true ? { pruefung: true } : {}) }),
      });

      if (!r2.ok) {
        const text = await r2.text();
        if (d?.id) {
          await fetch(`${URL_}/auth/v1/admin/users/${d.id}`,
                      { method: "DELETE", headers: kopf() });
        }
        return json({ ok:false, fehler:
          "Der Benutzer konnte nicht vollständig angelegt werden, das Anmeldekonto "
          + "wurde wieder entfernt. Meldung der Datenbank: " + text }, 400);
      }

      return json({ ok: true });
    }

    // ---------- Name ändern ----------
    if (aktion === "name") {
      const name = String(anfrage.name ?? "").trim();
      const r = await fetch(
        `${URL_}/rest/v1/spesen_benutzer?email=eq.${encodeURIComponent(email)}`, {
          method: "PATCH", headers: kopf(),
          body: JSON.stringify({ name: name || null }),
        });
      if (!r.ok) {
        const text = await r.text();
        return json({ ok:false, fehler: "Name konnte nicht gespeichert werden. " + text }, 400);
      }
      return json({ ok: true });
    }

    // ---------- Passwort setzen ----------
    if (aktion === "passwort") {
      const passwort = String(anfrage.passwort ?? "");
      if (passwort.length < 6) return json({ ok:false, fehler:"Passwort zu kurz." }, 400);

      const u = await authBenutzer(email);
      if (!u) return json({ ok:false, fehler:"Dieses Konto gibt es in der Anmeldung nicht." }, 404);

      const r = await fetch(`${URL_}/auth/v1/admin/users/${u.id}`, {
        method: "PUT", headers: kopf(), body: JSON.stringify({ password: passwort }),
      });
      if (!r.ok) {
        const d = await r.json();
        return json({ ok:false, fehler: d?.msg || "Passwort konnte nicht gesetzt werden." }, 400);
      }
      return json({ ok: true });
    }

    // ---------- Rolle ändern ----------
    if (aktion === "rolle") {
      const rolle = rolleVon(anfrage.rolle);

      if (rolle !== "admin" && istGeschuetzt(email)) {
        return json({ ok:false, fehler:
          "Dieses Konto ist als Notfall-Administrator festgelegt und behält die Rolle." }, 400);
      }

      // Aussperrschutz: der letzte Admin bleibt Admin
      if (rolle !== "admin") {
        const r0 = await fetch(
          `${URL_}/rest/v1/spesen_benutzer?rolle=eq.admin&aktiv=is.true&select=email`,
          { headers: kopf() });
        const admins = await r0.json();
        if (Array.isArray(admins) && admins.length <= 1 &&
            admins[0]?.email === email) {
          return json({ ok:false, fehler:"Das ist der letzte Administrator." }, 400);
        }
      }

      const fehler = await benutzerAendern(email, { rolle });
      if (fehler) return json({ ok:false, fehler: "Rolle nicht gespeichert. " + fehler }, 400);
      return json({ ok: true });
    }

    // ---------- Prüfung einrichten ----------
    // An: Belege ohne Projektleiter/Supervisor gehen nicht automatisch durch,
    // sondern warten auf einen Admin oder Supervisor.
    if (aktion === "pruefung") {
      const fehler = await benutzerAendern(email, { pruefung: anfrage.pruefung === true });
      if (fehler) return json({ ok:false, fehler: "Nicht gespeichert. " + fehler }, 400);
      return json({ ok: true });
    }

    // ---------- Aktiv oder gesperrt ----------
    if (aktion === "aktiv") {
      const aktiv = anfrage.aktiv !== false;

      if (!aktiv && istGeschuetzt(email)) {
        return json({ ok:false, fehler:
          "Dieses Konto ist als Notfall-Administrator festgelegt und "
          + "kann nicht gesperrt werden." }, 400);
      }

      if (!aktiv && email === wer.email) {
        return json({ ok:false, fehler:"Du kannst dich nicht selbst sperren." }, 400);
      }

      const u = await authBenutzer(email);
      if (u) {
        await fetch(`${URL_}/auth/v1/admin/users/${u.id}`, {
          method: "PUT", headers: kopf(),
          body: JSON.stringify({ ban_duration: aktiv ? "none" : "876000h" }),
        });
      }
      const fehler = await benutzerAendern(email, { aktiv });
      if (fehler) return json({ ok:false, fehler: "Status nicht gespeichert. " + fehler }, 400);
      return json({ ok: true });
    }

    return json({ ok: false, fehler: `Unbekannte Aktion: ${aktion}` }, 400);

  } catch (e) {
    return json({ ok: false, fehler: String(e) }, 500);
  }
});
