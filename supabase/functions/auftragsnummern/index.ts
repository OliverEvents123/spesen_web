// Vermittler zwischen Web-App und FileMaker
// Liefert die Auftragsnummern eines Jahres plus die übergreifenden Nummern.
// Aufruf:  .../auftragsnummern?jahr=2026

const TIMEOUT_MS = 8000;
const SEITENGROESSE = 500;
const MAX_SEITEN = 40;

// Jahresübergreifende Nummern — erscheinen unabhängig vom gewählten Jahr.
// Kommt eine neue dazu: hier ergänzen und die Function neu deployen.
const IMMER_DABEI = [
  "97", "98", "99",                   // Ausbildung / Lehrlingsarbeiten
  "200", "201",                       // Tit-Pit allgemein
  "221", "223", "224", "225",         // Eventmitarbeiter, SMS-Konto, Preisdruck, Solvent
  "325",                              // Sprintservice
  "615",                              // swiss Athletics
  "900", "901", "902", "903",         // 3D & Rendering, Nähen, StageCrew, Internet
  "905", "906", "907", "909", "911",  // Fahrzeuge, Recycling, Grafik, Kleider, Hauswartung
];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  });
}

async function fetchMitTimeout(url: string, init: RequestInit = {}, ms = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function basicAuth(user: string, pass: string) {
  const bytes = new TextEncoder().encode(`${user}:${pass}`);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return "Basic " + btoa(bin);
}

function erklaerung(code: string | undefined): string {
  const map: Record<string, string> = {
    "212": "Benutzername oder Passwort stimmt nicht. Prüfe die Secrets FM_USER und FM_PASSWORD.",
    "9": "Dem Konto fehlt das erweiterte Zugriffsrecht 'fmrest'. Berechtigungssatz in FileMaker prüfen.",
    "802": "Datenbank nicht gefunden. Stimmt FM_DATABASE exakt (ohne .fmp12)?",
    "105": "Layout nicht gefunden. Stimmt FM_LAYOUT exakt?",
    "102": "Feld nicht gefunden. Liegt ANr_Jahr wirklich auf dem Layout api_auftragsnr?",
    "401": "Keine passenden Datensätze gefunden.",
    "952": "Sitzung abgelaufen oder ungültig.",
  };
  return map[code ?? ""] ?? "Unbekannter FileMaker-Fehler.";
}

// Prüft den Anmeldetoken aus dem Browser bei Supabase nach.
async function istAngemeldet(req: Request) {
  const kopf = req.headers.get("Authorization") ?? "";
  const t = kopf.startsWith("Bearer ") ? kopf.slice(7).trim() : "";
  if (!t) return false;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return false;
  try {
    const r = await fetchMitTimeout(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${t}` },
    }, 6000);
    return r.ok;
  } catch { return false; }
}

// Ein mehrzeiliges FileMaker-Feld in eine Liste verwandeln
function zeilenListe(wert: unknown): string[] {
  return String(wert ?? "")
    .split(/\r\n|\r|\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Welche Kategorien gelten für diese Auftragsnummer?
const STANDARD_KATEGORIEN = ["Admin", "Event", "Lager"];
function kategorienAus(roh: unknown): string[] {
  const l = zeilenListe(roh);
  if (!l.length) return [];
  if (l.length === 1) {
    const w = l[0].toLowerCase();
    if (["ja", "1", "x", "alle", "standard", "true"].includes(w)) return STANDARD_KATEGORIEN;
    if (["nein", "0", "-", "false"].includes(w)) return [];
  }
  return l;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  if (!(await istAngemeldet(req))) {
    return json({ ok: false, schritt: "anmeldung", fehler: "Nicht angemeldet." }, 401);
  }

  // ---- Gewünschtes Jahr aus der Adresse lesen, sonst das laufende ----
  const aktuellesJahr = new Date().getFullYear();
  const wunsch = new URL(req.url).searchParams.get("jahr");
  const jahr = /^\d{4}$/.test(wunsch ?? "") ? Number(wunsch) : aktuellesJahr;

  if (jahr < 2000 || jahr > aktuellesJahr + 5) {
    return json({ ok: false, schritt: "anfrage", fehler: `Jahr ${jahr} liegt ausserhalb des zulässigen Bereichs.` }, 400);
  }

  const HOST = Deno.env.get("FM_HOST");
  const DB = Deno.env.get("FM_DATABASE");
  const LAYOUT = Deno.env.get("FM_LAYOUT");
  const USER = Deno.env.get("FM_USER");
  const PASS = Deno.env.get("FM_PASSWORD");

  const fehlend = Object.entries({ FM_HOST: HOST, FM_DATABASE: DB, FM_LAYOUT: LAYOUT, FM_USER: USER, FM_PASSWORD: PASS })
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (fehlend.length) {
    return json({ ok: false, schritt: "konfiguration", fehler: `Diese Secrets fehlen: ${fehlend.join(", ")}` }, 500);
  }

  const base = `https://${HOST}/fmi/data/vLatest/databases/${encodeURIComponent(DB!)}`;
  let token: string | null = null;

  try {
    // ---- 1. Anmelden ----
    const loginRes = await fetchMitTimeout(`${base}/sessions`, {
      method: "POST",
      headers: { Authorization: basicAuth(USER!, PASS!), "Content-Type": "application/json" },
      body: "{}",
    });

    const loginBody = await loginRes.json().catch(() => null);
    token = loginBody?.response?.token ?? null;

    if (!loginRes.ok || !token) {
      const code = loginBody?.messages?.[0]?.code;
      return json({
        ok: false, schritt: "anmeldung", httpStatus: loginRes.status,
        filemakerCode: code, filemakerMeldung: loginBody?.messages?.[0]?.message,
        hinweis: erklaerung(code),
      }, 502);
    }

    // ---- 2. Suchanfrage bauen ----
    const suche = [
      { ANr_Jahr: `==${jahr}` },
      ...IMMER_DABEI.map((nr) => ({ ANr_ID: `==${nr}` })),
    ];

    const rohdaten: any[] = [];
    let gefunden: number | null = null;
    let offset = 1;
    let vollstaendig = false;

    for (let seite = 0; seite < MAX_SEITEN; seite++) {
      const recRes = await fetchMitTimeout(`${base}/layouts/${encodeURIComponent(LAYOUT!)}/_find`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: suche, limit: String(SEITENGROESSE), offset: String(offset) }),
      });

      const recBody = await recRes.json().catch(() => null);
      const code = recBody?.messages?.[0]?.code;

      // 401 = keine (weiteren) Treffer. Bei der letzten Seite völlig normal.
      if (code === "401") { vollstaendig = true; break; }

      if (!recRes.ok) {
        return json({
          ok: false, schritt: "daten-abruf", httpStatus: recRes.status,
          filemakerCode: code, filemakerMeldung: recBody?.messages?.[0]?.message,
          hinweis: erklaerung(code),
        }, 502);
      }

      const seitenDaten = recBody?.response?.data ?? [];
      gefunden = recBody?.response?.dataInfo?.foundCount ?? gefunden;
      rohdaten.push(...seitenDaten);

      if (seitenDaten.length < SEITENGROESSE) { vollstaendig = true; break; }
      offset += SEITENGROESSE;
    }

    // ---- 3. Aufräumen ----
    const gesehen = new Set<string>();
    const auftragsnummern: { id: string; name: string; jahr: string; immer: boolean; kategorien: string[]; veranstaltungen: string[] }[] = [];

    for (const satz of rohdaten) {
      const f = satz.fieldData ?? {};
      const id = String(f.ANr_ID ?? "").trim();
      if (!id || gesehen.has(id)) continue;
      gesehen.add(id);
      auftragsnummern.push({
        id,
        name: String(f.ANr_Name ?? "").trim(),
        jahr: String(f.ANr_Jahr ?? "").trim(),
        immer: IMMER_DABEI.includes(id),
        kategorien: kategorienAus(f.d_VorgabeKategorie_t),
        veranstaltungen: zeilenListe(f.Veranstaltungen),
      });
    }

    // Übergreifende zuerst, danach nach Nummer sortiert
    auftragsnummern.sort((a, b) => {
      if (a.immer !== b.immer) return a.immer ? -1 : 1;
      return a.id.localeCompare(b.id, "de", { numeric: true });
    });

    const fehlendeUebergreifend = IMMER_DABEI.filter((nr) => !gesehen.has(nr));

    return json({
      ok: true,
      jahr,
      anzahl: auftragsnummern.length,
      uebergreifend: auftragsnummern.filter((a) => a.immer).length,
      fehlendeUebergreifend,
      treffer: gefunden,
      vollstaendig,
      auftragsnummern,
    });

  } catch (e) {
    const abgebrochen = e instanceof Error && e.name === "AbortError";
    return json({
      ok: false, schritt: "netzwerk",
      fehler: abgebrochen ? `Zeitüberschreitung nach ${TIMEOUT_MS / 1000} Sekunden` : String(e),
      hinweis: abgebrochen
        ? `${HOST} hat nicht geantwortet.`
        : `Verbindung zu ${HOST} fehlgeschlagen. Prüfe Hostname, Portfreigabe und SSL-Zertifikat.`,
    }, 504);

  } finally {
    if (token) {
      try { await fetchMitTimeout(`${base}/sessions/${token}`, { method: "DELETE" }, 3000); } catch { /* egal */ }
    }
  }
});
