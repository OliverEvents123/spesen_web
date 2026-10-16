// App.tsx
// Wählt den Bildschirm nach S.ansicht und leitet alle Klicks und Eingaben
// an aktionen.ts weiter (ein Verteiler für die ganze App, über data-akt).

import { useEffect, useRef, useSyncExternalStore } from "react";
import { S, abonnieren, aktuellerStand } from "./zustand";
import { IST_TEST } from "./konfig";
import { klick, aenderung, eingabe } from "./aktionen";
import { Login } from "./ansichten/login";
import { MeineBelege, Uebersicht } from "./ansichten/uebersicht";
import { Erfassen, KontoWahl, AuftragWahl } from "./ansichten/erfassen";
import { Profil, Passwort, Favoriten, FavForm, Freigabe } from "./ansichten/profil";
import { Benutzer, Konten, Geraete, Kostenstellen } from "./ansichten/verwaltung";

function Bildschirm() {
  if (!S.gestartet) return <div className="leer" style={{ paddingTop: 80 }}>Lade …</div>;
  if (!S.session)   return <Login />;

  switch (S.ansicht) {
    case "erfassen":    return S.neu ? <Erfassen /> : <MeineBelege />;
    case "kontoWahl":   return <KontoWahl />;
    case "auftragWahl": return <AuftragWahl />;
    // User haben keine Übersicht — nur ihre Belege
    case "uebersicht":  return S.istPruefer ? <Uebersicht /> : <MeineBelege />;
    case "freigabe":    return <Freigabe />;
    case "profil":      return <Profil />;
    case "passwort":    return <Passwort />;
    case "favoriten":   return <Favoriten />;
    case "favForm":     return S.favEdit ? <FavForm /> : <Favoriten />;
    case "benutzer": case "benForm":  return <Benutzer />;
    case "konten":   case "kontoForm": return <Konten />;
    case "geraete":  case "geraetForm": return <Geraete />;
    case "kst":      return <Kostenstellen />;
  }
  return <MeineBelege />;
}

export function App() {
  // Bei jedem render() aus zustand.ts neu zeichnen
  useSyncExternalStore(abonnieren, aktuellerStand);
  const wurzel = useRef<HTMLDivElement>(null);

  // Ein Verteiler für alle Klicks und Eingaben — wie in der alten app.js
  useEffect(() => {
    const el = wurzel.current;
    const beiKlick = (e: MouseEvent) => {
      const ziel = (e.target as HTMLElement).closest("[data-akt]") as HTMLElement;
      if (!ziel || !el.contains(ziel) || (ziel as HTMLButtonElement).disabled) return;
      klick(ziel);
    };
    const beiAenderung = (e: Event) => aenderung(e.target as HTMLInputElement);
    const beiEingabe   = (e: Event) => eingabe(e.target as HTMLInputElement);
    el.addEventListener("click", beiKlick);
    el.addEventListener("change", beiAenderung);
    el.addEventListener("input", beiEingabe);
    return () => {
      el.removeEventListener("click", beiKlick);
      el.removeEventListener("change", beiAenderung);
      el.removeEventListener("input", beiEingabe);
    };
  }, []);

  return (
    <div ref={wurzel} className={"app" + (IST_TEST ? " mit-band" : "")}>
      {IST_TEST &&
        <div className="testband">TESTUMGEBUNG · eigene Testdatenbank, nicht die echten Belege</div>}
      <Bildschirm />
    </div>);
}
