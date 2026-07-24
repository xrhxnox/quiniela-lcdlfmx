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

  let dragging = null; // { fromIndex, startY, rowEl }

  function clearDragStyles(el) {
    el.style.position = "";
    el.style.zIndex = "";
    el.style.opacity = "";
    el.style.transform = "";
    el.style.boxShadow = "";
  }

  function applyDragStyles(el) {
    el.style.position = "relative";
    el.style.zIndex = "5";
    el.style.opacity = "0.9";
    el.style.boxShadow = "0 6px 18px rgba(0,0,0,0.35)";
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const deltaY = e.clientY - dragging.startY;
    dragging.rowEl.style.transform = `translateY(${deltaY}px)`;

    const rowsEls = [...listWrap.firstElementChild.children];
    const hoveredIndex = rowsEls.findIndex((el) => {
      if (el === dragging.rowEl) return false;
      const rect = el.getBoundingClientRect();
      return e.clientY >= rect.top && e.clientY <= rect.bottom;
    });
    if (hoveredIndex !== -1 && hoveredIndex !== dragging.fromIndex) {
      const [moved] = order.splice(dragging.fromIndex, 1);
      order.splice(hoveredIndex, 0, moved);
      dragging.fromIndex = hoveredIndex;
      dragging.startY = e.clientY;
      renderList(hoveredIndex);
    }
  }

  function onPointerUp() {
    if (dragging) clearDragStyles(dragging.rowEl);
    dragging = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
  }

  function renderList(reacquireIndex) {
    const rows = order.map((p, i) => {
      const isFirst = i === 0;
      const handle = h("i", {
        class: "fa-solid fa-grip-lines",
        style: "cursor:grab;color:var(--text-dim);padding:4px 10px;touch-action:none",
      });
      const rowEl = h("div", { class: "list-item" }, [
        h("div", { class: "row-flex" }, [
          handle,
          h("strong", { style: "min-width:1.6em;display:inline-block" }, `${String(i + 1).padStart(2, "0")}.`),
          h("span", { class: `badge ${isFirst ? "gold" : "red"}` }, isFirst ? "Ganador" : "Eliminado"),
          photoOrInitials(p),
          p.name,
        ]),
      ]);

      handle.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        dragging = { fromIndex: i, startY: e.clientY, rowEl };
        applyDragStyles(rowEl);
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
        window.addEventListener("pointercancel", onPointerUp);
      });

      if (dragging && reacquireIndex === i) {
        dragging.rowEl = rowEl;
        applyDragStyles(rowEl);
      }

      return rowEl;
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
          " Ordena a los habitantes del que crees que GANARÁ (arriba, posición 1) al que crees que saldrá PRIMERO (abajo). Por cada posición que aciertes, +1 punto.",
        ]),
        h("p", { class: "muted", style: "font-size:0.82rem;margin-bottom:4px" }, [
          h("i", { class: "fa-solid fa-grip-lines" }),
          " Arrastra desde el ícono para reordenar.",
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

// Posición 1 = predicho ganador (nunca aparece en "eliminations"). Posiciones 2+ =
// orden de salida en reversa cronológica: el eliminado MÁS RECIENTE va en la
// posición 2, y el eliminado más antiguo (el primero en salir) va hasta el final.
function buildBlocks(eliminationsWithWeeks) {
  const weekNumbers = [...new Set(eliminationsWithWeeks.map((e) => e.weeks.week_number))].sort((a, b) => b - a);
  const blocks = [];
  let cursor = 2;
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
      rows.sort((a, b) => b.position - a.position);
      const isMe = playerId === profile.id;
      const items = rows.map((row) => {
        let hit;
        if (row.position === 1) {
          hit = !!row.participants?.is_winner;
        } else {
          const block = blockFor(row.position);
          hit = block ? block.ids.has(row.participant_id) : false;
        }
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
