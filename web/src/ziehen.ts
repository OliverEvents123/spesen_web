// ziehen.ts
// Reihenfolge per Ziehen ändern (Konten): am Griff packen, ziehen,
// loslassen. Mit Maus und Finger (Pointer Events); mit der Tastatur auf dem
// Griff Pfeil hoch / runter.
//
// Markup: die Zeilen stehen im selben Elternelement und tragen
// data-zeile="<Schlüssel>", darin ein Griff mit data-zieh="<Liste>".
// Während des Ziehens bewegen sich die Zeilen nur per transform — das DOM
// gehört React und bleibt unangetastet. Beim Loslassen geht die neue
// Reihenfolge der Schlüssel an "fertig".

type Fertig = (liste: string, reihenfolge: string[]) => void;

export function ziehenEinrichten(wurzel: HTMLElement, fertig: Fertig) {
  let zug: null | {
    liste: string; griff: HTMLElement; zeile: HTMLElement; zeilen: HTMLElement[];
    mitten: number[]; hoehe: number; start: number; von: number; nach: number; id: number;
  } = null;

  const zeilenVon = (zeile: HTMLElement) =>
    [...zeile.parentElement.children].filter((x) => x.hasAttribute("data-zeile")) as HTMLElement[];

  // Neue Reihenfolge: Zeile "von" an Stelle "nach"
  const melden = (liste: string, zeilen: HTMLElement[], von: number, nach: number) => {
    if (von === nach) return;
    const schluessel = zeilen.map((z) => z.dataset.zeile);
    const [weg] = schluessel.splice(von, 1);
    schluessel.splice(nach, 0, weg);
    fertig(liste, schluessel);
  };

  const aufraeumen = () => {
    if (!zug) return;
    zug.zeilen.forEach((z) => { z.style.transform = ""; z.classList.remove("zieht"); });
    document.body.classList.remove("zieht-gerade");
  };

  function runter(e: PointerEvent) {
    const griff = (e.target as HTMLElement).closest("[data-zieh]") as HTMLElement;
    if (!griff || !wurzel.contains(griff) || e.button > 0) return;
    const zeile = griff.closest("[data-zeile]") as HTMLElement;
    if (!zeile) return;
    e.preventDefault();
    const zeilen = zeilenVon(zeile);
    const von = zeilen.indexOf(zeile);
    zug = {
      liste: griff.dataset.zieh, griff, zeile, zeilen, von, nach: von, id: e.pointerId, start: e.clientY,
      mitten: zeilen.map((z) => { const r = z.getBoundingClientRect(); return r.top + r.height / 2; }),
      hoehe: zeile.getBoundingClientRect().height
    };
    griff.setPointerCapture(e.pointerId);
    zeile.classList.add("zieht");
    document.body.classList.add("zieht-gerade");
  }

  function bewegen(e: PointerEvent) {
    if (!zug || e.pointerId !== zug.id) return;
    const z = zug;
    const dy = e.clientY - z.start;
    z.zeile.style.transform = `translateY(${dy}px)`;
    // Ziel: so viele andere Zeilen, wie ihre Mitte über der gezogenen liegt
    const y = z.mitten[z.von] + dy;
    z.nach = z.mitten.filter((m, i) => i !== z.von && m < y).length;
    // Die anderen rücken nach
    z.zeilen.forEach((zl, i) => {
      if (i === z.von) return;
      const schieben = z.von < z.nach && i > z.von && i <= z.nach ? -z.hoehe
                     : z.von > z.nach && i >= z.nach && i < z.von ? z.hoehe : 0;
      zl.style.transform = schieben ? `translateY(${schieben}px)` : "";
    });
  }

  function los(e: PointerEvent) {
    if (!zug || e.pointerId !== zug.id) return;
    const { liste, zeilen, von, nach } = zug;
    aufraeumen();
    zug = null;
    if (e.type !== "pointercancel") melden(liste, zeilen, von, nach);
  }

  // Tastatur: Pfeil hoch / runter auf dem Griff
  function taste(e: KeyboardEvent) {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    const griff = (e.target as HTMLElement).closest("[data-zieh]") as HTMLElement;
    if (!griff || !wurzel.contains(griff)) return;
    const zeile = griff.closest("[data-zeile]") as HTMLElement;
    if (!zeile) return;
    e.preventDefault();
    const zeilen = zeilenVon(zeile);
    const von = zeilen.indexOf(zeile);
    const nach = Math.max(0, Math.min(zeilen.length - 1, von + (e.key === "ArrowUp" ? -1 : 1)));
    melden(griff.dataset.zieh, zeilen, von, nach);
  }

  wurzel.addEventListener("pointerdown", runter);
  wurzel.addEventListener("pointermove", bewegen);
  wurzel.addEventListener("pointerup", los);
  wurzel.addEventListener("pointercancel", los);
  wurzel.addEventListener("keydown", taste);
  return () => {
    wurzel.removeEventListener("pointerdown", runter);
    wurzel.removeEventListener("pointermove", bewegen);
    wurzel.removeEventListener("pointerup", los);
    wurzel.removeEventListener("pointercancel", los);
    wurzel.removeEventListener("keydown", taste);
  };
}
