import {
  getParticipants,
  getWeeks,
  getParticipantHistory,
  getNominationCounts,
  getImmunityCounts,
  getSpecialImmunityCounts,
  getSavedCounts,
} from "../data.js";
import { h, esc, initials, clearAndAppend, fmtDate } from "../utils.js";

// Insignias de estado, con los mismos colores e iconos que la reja de Habitantes
// para que se lean igual en las dos pantallas.
const badge = (text, icon, style, cls = "badge status-badge") =>
  h("span", { class: cls, style }, [h("i", { class: `fa-solid ${icon}` }), " " + text]);

const ORANGE = "background:#ff7a1a26;color:#ff7a1a;border:1px solid #ff7a1a";
const BLUE = "background:#3b82f626;color:#3b82f6;border:1px solid #3b82f6";
const PURPLE = "background:#a742f526;color:#a742f5;border:1px solid #a742f5";
const TEAL = "background:#14b8a626;color:#14b8a6;border:1px solid #14b8a6";

// Estado global de hoy (lo que ya mostraba la tarjeta en la reja).
function currentStatusBadges(p) {
  const out = [];
  if (p.is_winner) out.push(badge("Ganador", "fa-trophy", null, "badge gold status-badge"));
  else if (p.active) out.push(badge("En la casa", "fa-house", null, "badge green status-badge"));
  else out.push(badge("Eliminado/a", "fa-skull", null, "badge red status-badge"));
  if (p.is_infiltrado) out.push(badge("Infiltrado", "fa-glasses", PURPLE));
  if (p.is_exiliado) out.push(badge("Exiliado/a", "fa-bug", null, "badge black status-badge"));
  return out;
}

// Estado en UNA semana concreta. Puede devolver más de una insignia (por
// ejemplo nominado y luego salvado), y solo cae en "En la casa" si no pasó
// nada más esa semana.
function weekStatusBadges(week, hist, participantId) {
  const weekId = week.id;
  const out = [];
  const elim = hist.eliminations.find((e) => e.week_id === weekId);
  const imm = hist.immunities.find((i) => i.week_id === weekId);
  const nom = hist.nominations.find((n) => n.week_id === weekId);
  const exile = hist.exiles.find((x) => x.week_id === weekId);

  if (imm?.is_leader) out.push(badge("Líder", "fa-award", ORANGE));
  else if (imm) out.push(badge("Inmune", "fa-shield-halved", ORANGE));
  if (nom) {
    // Los puntos que le dieron esa semana. Si no hay (0), se omiten en vez de
    // mostrar un "0 puntos" que solo significa que no se capturaron.
    const pts = Number(nom.points) || 0;
    out.push(
      badge(
        pts > 0 ? `Nominado · ${pts} punto${pts === 1 ? "" : "s"}` : "Nominado",
        "fa-triangle-exclamation",
        null,
        "badge gold status-badge"
      )
    );
    if (nom.saved) out.push(badge("Salvado", "fa-hand-holding-heart", BLUE));
  }
  // La Salvación: solo se marca en la ficha de quien terminó con ella. A quién
  // salvó ya se ve arriba con la insignia "Salvado".
  if (week.salvation_participant_id === participantId) {
    out.push(
      week.salvation_mode === "robo"
        ? badge("Robó la salvación", "fa-hand-sparkles", TEAL)
        : badge("Conservó la salvación", "fa-hand-holding-heart", TEAL)
    );
  }
  if (exile) out.push(badge("Al exilio", "fa-bug", null, "badge black status-badge"));
  if (elim) {
    // Una salida revertida por exilio no fue definitiva: se marca distinto para
    // que no parezca que la temporada se le acabó ahí.
    out.push(
      elim.reverted_by_exile
        ? badge("Salió y volvió", "fa-rotate-left", null, "badge black status-badge")
        : badge("Eliminado/a", "fa-skull", null, "badge red status-badge")
    );
  }
  if (out.length === 0) out.push(badge("En la casa", "fa-house", null, "badge green status-badge"));
  return out;
}

// Foto chica con nombre, para las listas de "nominó a" / "lo nominaron".
function personChip(participant) {
  if (!participant) return null;
  const photo = participant.photo_url
    ? h("span", {
        style: `width:26px;height:26px;border-radius:50%;flex-shrink:0;background:url('${esc(
          participant.photo_url
        )}') center/cover no-repeat`,
      })
    : h(
        "span",
        {
          style:
            "width:26px;height:26px;border-radius:50%;flex-shrink:0;background:var(--photo-bg);display:flex;align-items:center;justify-content:center;font-size:0.6rem;font-weight:800",
        },
        initials(participant.name)
      );
  return h(
    "a",
    {
      href: `#/habitante/${participant.id}`,
      style:
        "display:inline-flex;align-items:center;gap:6px;padding:3px 10px 3px 3px;border:1px solid var(--line);border-radius:999px;text-decoration:none;color:inherit;font-size:0.78rem",
    },
    [photo, h("span", {}, participant.name)]
  );
}

export async function renderHabitante(container, participantId) {
  clearAndAppend(container, h("div", { class: "loading" }, "Cargando…"));

  const [participants, weeks, hist, nomCounts, leaderCounts, immuneCounts, savedCounts] = await Promise.all([
    getParticipants(),
    getWeeks(),
    getParticipantHistory(participantId),
    getNominationCounts(),
    getImmunityCounts(),
    getSpecialImmunityCounts(),
    getSavedCounts(),
  ]);

  const byId = new Map(participants.map((p) => [p.id, p]));
  const p = byId.get(Number(participantId));
  if (!p) {
    clearAndAppend(container, h("div", { class: "empty-state" }, "No encontramos a este habitante."));
    return;
  }

  // --- Encabezado ---
  const photo = p.photo_url
    ? h("div", {
        style: `width:120px;height:120px;border-radius:50%;flex-shrink:0;border:3px solid var(--accent);background:url('${esc(
          p.photo_url
        )}') center/cover no-repeat`,
      })
    : h(
        "div",
        {
          style:
            "width:120px;height:120px;border-radius:50%;flex-shrink:0;border:3px solid var(--accent);background:var(--photo-bg);display:flex;align-items:center;justify-content:center;font-size:2.2rem;font-weight:800",
        },
        initials(p.name)
      );

  const header = h("div", { class: "card" }, [
    h("div", { style: "display:flex;gap:16px;align-items:center;flex-wrap:wrap" }, [
      photo,
      h("div", { style: "flex:1;min-width:180px" }, [
        h("div", { style: "font-family:var(--font-display);font-size:1.5rem;font-weight:700" }, p.name),
        p.room ? h("div", { class: "muted", style: "font-size:0.82rem" }, "Cuarto: " + p.room) : null,
        h(
          "div",
          { style: "display:flex;flex-wrap:wrap;gap:6px;margin-top:8px" },
          currentStatusBadges(p)
        ),
        h(
          "div",
          { class: "muted", style: "font-size:0.78rem;margin-top:10px;line-height:1.7" },
          `Líder ${leaderCounts[p.id] || 0} veces · Inmune ${immuneCounts[p.id] || 0} veces · ` +
            `Salvado ${savedCounts[p.id] || 0} veces · Nominado ${nomCounts[p.id] || 0} veces`
        ),
      ]),
    ]),
  ]);

  // --- Semana por semana ---
  // Las semanas en borrador todavía no son públicas, así que no se listan. El
  // orden es cronológico ascendente, al revés del que devuelve getWeeks().
  const visibleWeeks = weeks.filter((w) => w.status !== "draft").sort((a, b) => a.week_number - b.week_number);

  // Después de su salida definitiva ya no hay nada que contar, así que la
  // bitácora se corta ahí (una salida revertida por exilio no corta nada).
  const finalExit = hist.eliminations.find((e) => !e.reverted_by_exile);
  const exitWeek = finalExit ? weeks.find((w) => w.id === finalExit.week_id) : null;
  const timelineWeeks = exitWeek
    ? visibleWeeks.filter((w) => Number(w.week_number) <= Number(exitWeek.week_number))
    : visibleWeeks;

  const weekCards = timelineWeeks.map((w) => {
    const cast = hist.votesCast.filter((v) => v.week_id === w.id).map((v) => byId.get(v.nominee_id));
    const received = hist.votesReceived.filter((v) => v.week_id === w.id).map((v) => byId.get(v.nominator_id));

    const votesRow = (label, people) =>
      h("div", { style: "margin-top:8px" }, [
        h("div", { class: "muted", style: "font-size:0.72rem;text-transform:uppercase;letter-spacing:0.04em" }, label),
        people.length
          ? h("div", { style: "display:flex;flex-wrap:wrap;gap:6px;margin-top:4px" }, people.map(personChip))
          : h("div", { class: "muted", style: "font-size:0.78rem;margin-top:4px" }, "Sin registro"),
      ]);

    return h("div", { class: "card" }, [
      h("div", { class: "week-card-header" }, [
        h("strong", {}, w.label || `Semana ${w.week_number}`),
        w.status === "voting_open" ? h("span", { class: "badge green" }, "En curso") : null,
      ]),
      w.elimination_date
        ? h("div", { class: "muted", style: "font-size:0.75rem;margin-top:2px" }, fmtDate(w.elimination_date))
        : null,
      h("div", { style: "display:flex;flex-wrap:wrap;gap:6px;margin-top:8px" }, weekStatusBadges(w, hist, p.id)),
      votesRow("Nominó a", cast),
      votesRow("Lo/la nominaron", received),
    ]);
  });

  clearAndAppend(
    container,
    h("div", {}, [
      h(
        "a",
        { href: "#/participantes", class: "btn small secondary", style: "text-decoration:none;display:inline-block" },
        "← Habitantes"
      ),
      h("div", { class: "section-title", style: "margin-top:14px" }, "Ficha del habitante"),
      header,
      h("div", { class: "section-title", style: "margin-top:18px" }, "Semana por semana"),
      weekCards.length
        ? h("div", {}, weekCards)
        : h("div", { class: "empty-state" }, "Todavía no hay semanas registradas."),
    ])
  );
}
