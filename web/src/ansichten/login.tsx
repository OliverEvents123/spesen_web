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
    <div className="anmeldung">
      <div className="oben"><div>
        <span className="zeichen">TP</span>
        <h1>TIT-PIT Spesen</h1>
        <span style={st("color:#9ba1bb")}>Belege fotografieren, kontieren, abrechnen.</span>
      </div></div>
      <form className="karte" onSubmit={anmelden}>
        {S.loginMeldung && <div className="fehler">{S.loginMeldung}</div>}
        <div className="feld"><label htmlFor="mail">E-Mail</label>
          <input id="mail" name="mail" type="email" inputMode="email" autoComplete="username" required /></div>
        <div className="feld"><label htmlFor="pw">Passwort</label>
          <input id="pw" name="pw" type="password" autoComplete="current-password" required /></div>
        <button className="k1" type="submit" disabled={laeuft}>{laeuft ? "Moment …" : "Anmelden"}</button>
      </form>
      <p className="kn mu" style={st("margin:18px 28px;text-align:center;line-height:1.45")}>
        Passwort vergessen? Der Admin setzt dir ein neues.</p>
    </div>);
}
