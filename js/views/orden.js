import {
  getParticipants,
  getMyEliminationOrder,
  saveEliminationOrder,
  isOraculoLocked,
  getAllEliminationOrders,
  getEliminationOrderScores,
  getAllEliminationsWithWeeks,
  getOraculoAutoFilledPlayerIds,
} from "../data.js";
import { h, esc, initials, clearAndAppend } from "../utils.js";
import { renderOrderableList, photoOrInitials } from "./ordenable.js";
import { getShow, isGranja } from "../shows.js";


function renderBuildPhase(container, profile, participants, existingOrder) {
  renderOrderableList(container, {
    participants,
    existingOrder,
    title: "El Oráculo",
    rowBadge: (i) =>
      h("span", { class: `badge status-badge ${i === 0 ? "gold" : "red"}` }, i === 0 ? "Ganador" : "Eliminado"),
    savedMessage: "¡Orden guardado! Puedes seguir reordenando hasta que el admin cierre El Oráculo.",
    onSave: (ids) => saveEliminationOrder(profile.id, ids),
    intro: [
      h("p", { style: "margin-top:0" }, [
        h("i", { class: "fa-solid fa-hat-wizard" }),
        ` Ordena a los ${getShow().memberPlural.toLowerCase()} del que crees que GANARÁ (arriba, posición 1) al que crees que saldrá PRIMERO (abajo). Por cada posición que aciertes, +1 punto.`,
      ]),
      h(
        "p",
        { class: "muted", style: "font-size:0.82rem;margin-bottom:4px" },
        "El admin cierra El Oráculo cuando decide — después de eso ya no se puede cambiar hasta que lo reinicie."
      ),
    ],
  });
}

// Quien reingresó a la casa ocupa MÁS DE UN cupo en el orden: ya salió una vez
// y va a volver a salir (o a ganar). Por eso aparece repetido en la lista y el
// total de cupos deja de ser el número de personas.
function oraculoSlots(participants) {
  const slots = [];
  participants
    .filter((p) => !p.is_infiltrado)
    .forEach((p) => {
      for (let i = 0; i <= (p.reentries || 0); i++) slots.push(p);
    });
  return slots;
}

// Posición 1 = predicho ganador (nunca aparece en "eliminations"). Posiciones 2+ =
// orden de salida en reversa: posición = totalParticipants + 1 - lugar cronológico
// real de salida. Así, el primero en salir SIEMPRE cae en la última posición desde
// el momento en que se confirma, sin importar cuántas eliminaciones falten para el
// resto de la temporada (misma fórmula que la vista SQL elimination_order_score).
function buildBlocks(eliminationsWithWeeks, totalParticipants) {
  // Normalmente un bloque es una semana entera y el orden dentro da igual. En la
  // semana final sí se conoce el orden exacto, así que cada salida forma su
  // propio bloque. Misma regla que la vista elimination_order_score.
  const keyOf = (e) => `${e.weeks.week_number}|${e.weeks.is_final ? e.exit_order ?? 0 : 0}`;
  const keys = [...new Set(eliminationsWithWeeks.map(keyOf))].sort((a, b) => {
    const [aw, ao] = a.split("|").map(Number);
    const [bw, bo] = b.split("|").map(Number);
    return aw - bw || ao - bo;
  });
  const blocks = [];
  let fwdCursor = 1;
  keys.forEach((k) => {
    const ids = eliminationsWithWeeks.filter((e) => keyOf(e) === k).map((e) => e.participant_id);
    const fwdStart = fwdCursor;
    const fwdEnd = fwdCursor + ids.length - 1;
    blocks.push({ start: totalParticipants - fwdEnd + 1, end: totalParticipants - fwdStart + 1, ids: new Set(ids) });
    fwdCursor += ids.length;
  });
  return blocks;
}

function orderThumb(participant, status, position) {
  const borderColor = status === "hit" ? "var(--green)" : status === "miss" ? "var(--red)" : "var(--line)";
  const tint = status === "hit" ? "rgba(47,174,90,0.5)" : status === "miss" ? "rgba(227,6,19,0.5)" : null;
  const photo = participant?.photo_url
    ? `background-image:${tint ? `linear-gradient(${tint},${tint}),` : ""}url('${esc(participant.photo_url)}');background-size:cover;background-position:center;`
    : `background:var(--photo-bg);display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:800;color:var(--text-dim);`;
  return h("div", { style: "display:flex;flex-direction:column;align-items:center;gap:3px;flex-shrink:0" }, [
    h(
      "div",
      { style: `width:52px;height:52px;border-radius:50%;border:3px solid ${borderColor};${photo}`, title: participant?.name || "—" },
      participant?.photo_url ? null : initials(participant?.name || "?")
    ),
    h("span", { class: "muted", style: "font-size:0.62rem" }, `${position}`),
  ]);
}

function renderRevealPhase(container, profile, allOrders, scores, eliminationsWithWeeks, totalParticipants, autoFilledIds) {
  // Los infiltrados no participan en El Oráculo (no pueden ganar la temporada):
  // no se muestran en el listado de nadie ni cuentan para el puntaje.
  const eligibleOrders = allOrders.filter((row) => !row.participants?.is_infiltrado);
  // Las salidas revertidas por exilio no ocupan lugar (liberan su posición), y
  // las marcadas como "regalo" no se comparan contra el orden de nadie.
  const eligibleEliminations = eliminationsWithWeeks.filter(
    (e) => !e.participants?.is_infiltrado && !e.reverted_by_exile && !e.gift_all
  );
  const giftedExits = eliminationsWithWeeks.filter((e) => e.gift_all && !e.participants?.is_infiltrado);
  // Cada salida "regalo" se dibuja en su lugar cronológico dentro de la fila:
  // después de las salidas reales que ocurrieron antes que ella. No tiene
  // número de posición, así que se marca con "✕".
  const giftInserts = giftedExits
    .map((g) => ({
      participants: g.participants,
      afterCount: eligibleEliminations.filter((e) => e.weeks.week_number < g.weeks.week_number).length,
    }))
    .sort((a, b) => a.afterCount - b.afterCount);
  const blocks = buildBlocks(eligibleEliminations, totalParticipants);
  const blockFor = (position) => blocks.find((b) => position >= b.start && position <= b.end) || null;
  const minResolvedPosition = totalParticipants - eligibleEliminations.length + 1;
  const winnerExists = eligibleOrders.some((r) => r.participants?.is_winner);

  const byPlayer = new Map();
  eligibleOrders.forEach((row) => {
    if (!byPlayer.has(row.player_id)) byPlayer.set(row.player_id, { player: row.profiles, rows: [] });
    byPlayer.get(row.player_id).rows.push(row);
  });

  const scoreMap = {};
  scores.forEach((s) => (scoreMap[s.player_id] = s.points));

  const playerCards = [...byPlayer.entries()]
    .sort((a, b) => (scoreMap[b[0]] || 0) - (scoreMap[a[0]] || 0))
    .map(([playerId, { player, rows }]) => {
      rows.sort((a, b) => b.position - a.position);
      const isMe = playerId === profile.id;
      const items = [];
      rows.forEach((row, idx) => {
        // Antes de esta posición van las salidas "regalo" que ocurrieron en ese punto
        giftInserts
          .filter((g) => g.afterCount === idx)
          .forEach((g) => items.push(orderThumb(g.participants, "hit", "✕")));

        let status;
        if (row.position === 1) {
          status = !winnerExists ? "pending" : row.participants?.is_winner ? "hit" : "miss";
        } else if (row.position >= minResolvedPosition) {
          const block = blockFor(row.position);
          status = block && block.ids.has(row.participant_id) ? "hit" : "miss";
        } else {
          status = "pending";
        }
        items.push(orderThumb(row.participants, status, row.position));
      });
      // Regalos que caen después de la última posición mostrada
      giftInserts
        .filter((g) => g.afterCount >= rows.length)
        .forEach((g) => items.push(orderThumb(g.participants, "hit", "✕")));
      return h("div", { class: "card" }, [
        h("div", { style: "display:flex;justify-content:space-between;align-items:center;margin-bottom:10px" }, [
          h("div", {}, [
            h("strong", {}, player?.display_name || "—"),
            isMe ? h("span", { class: "badge gold", style: "margin-left:6px" }, "Tú") : null,
          ]),
          h("span", { class: "badge green" }, `${scoreMap[playerId] || 0} pts`),
        ]),
        autoFilledIds?.has(playerId)
          ? h("p", { class: "muted", style: "font-size:0.72rem;margin:0 0 8px" }, [
              h("i", { class: "fa-solid fa-shuffle" }),
              " No realizó El Oráculo. Elegido en orden alfabético.",
            ])
          : null,
        h("div", { style: "display:flex;gap:10px;overflow-x:auto;padding:2px 2px 6px" }, items),
      ]);
    });

  clearAndAppend(
    container,
    h("div", {}, [
      h("div", { class: "section-title" }, "El Oráculo"),
      h("div", { class: "card" }, [
        h("p", { style: "margin-top:0;margin-bottom:0" }, [
          h("i", { class: "fa-solid fa-lock", style: "color:var(--accent)" }),
          " La predicción de orden ya está cerrada. Aquí está lo que predijo cada quien y los puntos que llevan.",
        ]),
        giftedExits.length
          ? h("p", { class: "muted", style: "font-size:0.78rem;margin:10px 0 0" }, [
              h("strong", { style: "color:var(--text)" }, "✕ "),
              giftedExits.map((e) => e.participants.name).join(", "),
              giftedExits.length === 1 ? " salió " : " salieron ",
              isGranja()
                ? "de forma imprevista. Como nadie pudo preverlo, no ocupa lugar en el orden y suma +1 a todos."
                : "de la casa después de volver del exilio. Como nadie pudo preverlo, no ocupa lugar en el orden y suma +1 a todos.",
            ])
          : null,
      ]),
      playerCards.length
        ? h("div", {}, playerCards)
        : h("div", { class: "empty-state" }, "Nadie registró un orden antes de que se cerrara El Oráculo."),
    ])
  );
}

export async function renderOrdenSalida(container, profile) {
  clearAndAppend(container, h("div", { class: "loading" }, "Cargando…"));
  const locked = await isOraculoLocked();

  if (!locked) {
    const [participants, existingOrder] = await Promise.all([getParticipants(), getMyEliminationOrder(profile.id)]);
    renderBuildPhase(container, profile, oraculoSlots(participants), existingOrder);
    return;
  }

  const [allOrders, scores, eliminationsWithWeeks, participants, autoFilledIds] = await Promise.all([
    getAllEliminationOrders(),
    getEliminationOrderScores(),
    getAllEliminationsWithWeeks(),
    getParticipants(),
    getOraculoAutoFilledPlayerIds(),
  ]);
  const totalParticipants = oraculoSlots(participants).length;
  renderRevealPhase(container, profile, allOrders, scores, eliminationsWithWeeks, totalParticipants, autoFilledIds);
}
