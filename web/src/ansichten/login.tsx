// login.tsx — Anmeldung

import { useState } from "react";
import { S, sb } from "../zustand";
import { st, NETZTEXT, istNetzfehler } from "../grundlagen";
import { nachAnmeldung, zeigeLogin } from "../daten";

export function Login() {
  const [laeuft, setLaeuft] = useState(false);

  async function anmelden(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    setLaeuft(true);
    let data, error;
    try {
      ({ data, error } = await sb.auth.signInWithPassword({
        email: (f.elements.namedItem("mail") as HTMLInputElement).value.trim(),
        password: (f.elements.namedItem("pw") as HTMLInputElement).value }));
    } catch {
      setLaeuft(false); return zeigeLogin(NETZTEXT);
    }
    if (error) {
      setLaeuft(false);
      return zeigeLogin(istNetzfehler(error) ? NETZTEXT
                        : "Anmeldung fehlgeschlagen. E-Mail oder Passwort stimmt nicht.");
    }
    await nachAnmeldung(data.session);
  }

  return (
    <div className="mitte"><div className="karte">
      <h1 style={st("margin:0 0 4px;font-size:24px")}>Spesen</h1>
      <p style={st("margin:0 0 18px;color:var(--grau);font-size:14px")}>Bitte anmelden</p>
      {S.loginMeldung && <div className="fehler">{S.loginMeldung}</div>}
      <form onSubmit={anmelden}>
        <label htmlFor="mail">E-Mail</label>
        <input id="mail" name="mail" type="email" inputMode="email" autoComplete="username" required
               style={st("margin-bottom:12px")} />
        <label htmlFor="pw">Passwort</label>
        <input id="pw" name="pw" type="password" autoComplete="current-password" required
               style={st("margin-bottom:18px")} />
        <button className="knopf" type="submit" disabled={laeuft}>{laeuft ? "Moment …" : "Anmelden"}</button>
      </form>
    </div></div>);
}
