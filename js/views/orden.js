import {
  getParticipants,
  getMyEliminationOrder,
  saveEliminationOrder,
  hasFirstWeekStarted,
  getAllEliminationOrders,
  getEliminationOrderScores,
  getAllEliminationsWithWeeks,
} from "../data.js";
import { h, esc, initials, clearAndAppend } from "../utils.js";

function photoOrInitials(p) {
  if (p.photo_url) {
    return h("div", { class: "photo", style: `background-image:url('${esc(p.photo_url)}')` });
  }
  return h("div", { class: "photo" }, initials(p.name));
}

function renderBuildPhase(container, profile, participants, existingOrder) {
  let order;
  if (existingOrder.length > 0) {
    order = existingOrder.map((row) => participants.find((p) => p.id === row.participant_id)).filter(Boolean);
    const orderedIds = new Set(order.map((p) => p.id));
    participants.forEach((p) => {
      if (!orderedIds.has(p.id)) order.push(p);
    });
  } else {
    order = [...participants];
  }

  const errMsg = h("div", { class: "error-msg" });
  const successMsg = h("div", { class: "success-msg" });
  const listWrap = h("div", { class: "card" });

  function renderList() {
    const rows = order.map((p, i) => {
      const isLast = i === order.length - 1;
      return h("div", { class: "list-item" }, [
        h("div", { class: "row-flex" }, [
          h("strong", {}, `${i + 1}.`),
          h("span", { class: `badge ${isLast ? "gold" : "red"}` }, isLast ? "Ganador" : "Eliminado"),
          photoOrInitials(p),
          p.name,
        ]),
        h("div", { class: "row-flex" }, [
          h(
            "button",
            {
              class: "btn small secondary",
              disabled: i === 0 ? "disabled" : undefined,
              onclick: () => {
                [order[i - 1], order[i]] = [order[i], order[i - 1]];
                renderList();
              },
            },
            h("i", { class: "fa-solid fa-arrow-up" })
          ),
          h(
            "button",
            {
              class: "btn small secondary",
              disabled: i === order.length - 1 ? "disabled" : undefined,
              onclick: () => {
                [order[i + 1], order[i]] = [order[i], order[i + 1]];
                renderList();
              },
            },
            h("i", { class: "fa-solid fa-arrow-down" })
          ),
        ]),
      ]);
    });
    clearAndAppend(listWrap, h("div", {}, rows));
  }
  renderList();

  const saveBtn = h(
    "button",
    {
      class: "btn",
      onclick: async () => {
        errMsg.textContent = "";
        saveBtn.disabled = true;
        saveBtn.textContent = "Guardando…";
        try {
          await saveEliminationOrder(profile.id, order.map((p) => p.id));
          successMsg.textContent = "¡Orden guardado! Puedes seguir reordenando hasta que se confirme la primera eliminación.";
        } catch (e) {
          errMsg.textContent = "No se pudo guardar. Intenta de nuevo.";
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = "Guardar mi orden";
        }
      },
    },
    "Guardar mi orden"
  );

  clearAndAppend(
    container,
    h("div", {}, [
      h("div", { class: "section-title" }, "Orden de Salida"),
      h("div", { class: "card" }, [
        h("p", { style: "margin-top:0" }, [
          h("i", { class: "fa-solid fa-list-ol" }),
          " Ordena a los habitantes del que crees que saldrá PRIMERO al que crees que ganará. Por cada posición que aciertes, +1 punto.",
        ]),
        h(
          "p",
          { class: "muted", style: "font-size:0.82rem;margin-bottom:0" },
          "Se bloquea en cuanto se publique la Semana 1 (se abra la votación) — después de eso ya no se puede cambiar."
        ),
      ]),
      listWrap,
      h("div", { style: "margin-top:16px;display:flex;gap:10px;align-items:center" }, [saveBtn, successMsg, errMsg]),
    ])
  );
}

function buildBlocks(eliminationsWithWeeks) {
  const weekNumbers = [...new Set(eliminationsWithWeeks.map((e) => e.weeks.week_number))].sort((a, b) => a - b);
  const blocks = [];
  let cursor = 1;
  weekNumbers.forEach((wn) => {
    const ids = eliminationsWithWeeks.filter((e) => e.weeks.week_number === wn).map((e) => e.participant_id);
    blocks.push({ start: cursor, end: cursor + ids.length - 1, ids: new Set(ids) });
    cursor += ids.length;
  });
  return blocks;
}

function orderThumb(participant, hit, position) {
  const borderColor = hit ? "var(--green)" : "var(--red)";
  const photo = participant?.photo_url
    ? `background-image:url('${esc(participant.photo_url)}');background-size:cover;background-position:center;`
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

function renderRevealPhase(container, profile, allOrders, scores, eliminationsWithWeeks) {
  const blocks = buildBlocks(eliminationsWithWeeks);
  const blockFor = (position) => blocks.find((b) => position >= b.start && position <= b.end) || null;

  const byPlayer = new Map();
  allOrders.forEach((row) => {
    if (!byPlayer.has(row.player_id)) byPlayer.set(row.player_id, { player: row.profiles, rows: [] });
    byPlayer.get(row.player_id).rows.push(row);
  });

  const scoreMap = {};
  scores.forEach((s) => (scoreMap[s.player_id] = s.points));

  const playerCards = [...byPlayer.entries()]
    .sort((a, b) => (scoreMap[b[0]] || 0) - (scoreMap[a[0]] || 0))
    .map(([playerId, { player, rows }]) => {
      rows.sort((a, b) => a.position - b.position);
      const isMe = playerId === profile.id;
      const items = rows.map((row) => {
        const block = blockFor(row.position);
        const hit = block ? block.ids.has(row.participant_id) : false;
        return orderThumb(row.participants, hit, row.position);
      });
      return h("div", { class: "card" }, [
        h("div", { style: "display:flex;justify-content:space-between;align-items:center;margin-bottom:10px" }, [
          h("div", {}, [
            h("strong", {}, player?.display_name || "—"),
            isMe ? h("span", { class: "badge gold", style: "margin-left:6px" }, "Tú") : null,
          ]),
          h("span", { class: "badge green" }, `${scoreMap[playerId] || 0} pts`),
        ]),
        h("div", { style: "display:flex;gap:10px;overflow-x:auto;padding:2px 2px 6px" }, items),
      ]);
    });

  clearAndAppend(
    container,
    h("div", {}, [
      h("div", { class: "section-title" }, "Orden de Salida"),
      h("div", { class: "card" }, [
        h("p", { style: "margin-top:0;margin-bottom:0" }, [
          h("i", { class: "fa-solid fa-lock" }),
          " La predicción de orden ya está cerrada. Aquí está lo que predijo cada quien y los puntos que llevan.",
        ]),
      ]),
      playerCards.length
        ? h("div", {}, playerCards)
        : h("div", { class: "empty-state" }, "Nadie registró un orden antes de la primera eliminación."),
    ])
  );
}

export async function renderOrdenSalida(container, profile) {
  clearAndAppend(container, h("div", { class: "loading" }, "Cargando…"));
  const started = await hasFirstWeekStarted();

  if (!started) {
    const [participants, existingOrder] = await Promise.all([getParticipants(), getMyEliminationOrder(profile.id)]);
    renderBuildPhase(container, profile, participants, existingOrder);
    return;
  }

  const [allOrders, scores, eliminationsWithWeeks] = await Promise.all([
    getAllEliminationOrders(),
    getEliminationOrderScores(),
    getAllEliminationsWithWeeks(),
  ]);
  renderRevealPhase(container, profile, allOrders, scores, eliminationsWithWeeks);
}
