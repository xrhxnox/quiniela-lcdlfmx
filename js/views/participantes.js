import {
  getParticipants,
  getNominationCounts,
  getImmunityCounts,
  getSpecialImmunityCounts,
  getSavedCounts,
  getVotingWeek,
  getImmunitiesForWeek,
} from "../data.js";
import { h, esc, initials, clearAndAppend } from "../utils.js";

export async function renderParticipantes(container) {
  clearAndAppend(container, h("div", { class: "loading" }, "Cargando…"));
  const [participants, counts, leaderCounts, immuneCounts, savedCounts, votingWeek] = await Promise.all([
    getParticipants(),
    getNominationCounts(),
    getImmunityCounts(),
    getSpecialImmunityCounts(),
    getSavedCounts(),
    getVotingWeek(),
  ]);
  const currentImmunities = votingWeek ? await getImmunitiesForWeek(votingWeek.id) : [];
  const currentLeaderIds = new Set(currentImmunities.filter((i) => i.is_leader).map((i) => i.participant_id));
  const currentImmuneIds = new Set(currentImmunities.filter((i) => !i.is_leader).map((i) => i.participant_id));

  if (participants.length === 0) {
    clearAndAppend(container, h("div", { class: "empty-state" }, "El admin todavía no ha agregado participantes."));
    return;
  }

  const roomOf = (p) => p.room || "Sin Cuarto";
  const rooms = [...new Set(participants.map(roomOf))].sort((a, b) => a.localeCompare(b));

  const sorted = [...participants].sort((a, b) => (a.active === b.active ? a.name.localeCompare(b.name) : a.active ? -1 : 1));

  const gridWrap = h("div", {});
  const filterWrap = h("div", {});

  let activeRoom = null;

  function renderGrid() {
    const filtered = activeRoom ? sorted.filter((p) => roomOf(p) === activeRoom) : sorted;
    const cards = filtered.map((p) => {
      const photo = p.photo_url
        ? h("div", { class: "photo", style: `background-image:url('${esc(p.photo_url)}')` })
        : h("div", { class: "photo" }, initials(p.name));
      return h("div", { class: "nominee-card", style: "cursor:default" }, [
        photo,
        h("div", { class: "info" }, [
          h("div", { class: "name" }, p.name),
          p.room ? h("div", { class: "room" }, "Cuarto: " + p.room) : null,
          h("div", { style: "margin-top:6px;display:flex;flex-direction:column;align-items:center;gap:4px" }, [
            p.is_winner
              ? h("span", { class: "badge gold" }, "GANADOR")
              : p.active
              ? h("span", { class: "badge green" }, "En la casa")
              : h("span", { class: "badge red" }, "Eliminado/a"),
            p.is_infiltrado
              ? h("span", { class: "badge", style: "background:#a742f526;color:#a742f5;border:1px solid #a742f5" }, "INFILTRADO")
              : null,
            currentLeaderIds.has(p.id) ? h("span", { class: "badge gold" }, [h("i", { class: "fa-solid fa-crown" }), " Líder"]) : null,
            currentImmuneIds.has(p.id) ? h("span", { class: "badge green" }, [h("i", { class: "fa-solid fa-shield-halved" }), " Inmune"]) : null,
          ]),
          h("div", { class: "points" }, `Líder ${leaderCounts[p.id] || 0} veces`),
          h("div", { class: "points" }, `Inmune ${immuneCounts[p.id] || 0} veces`),
          h("div", { class: "points" }, `Salvado ${savedCounts[p.id] || 0} veces`),
          h("div", { class: "points" }, `Nominado ${counts[p.id] || 0} veces`),
        ]),
      ]);
    });
    clearAndAppend(
      gridWrap,
      cards.length ? h("div", { class: "grid" }, cards) : h("div", { class: "empty-state" }, "Nadie en este cuarto.")
    );
  }

  function renderFilterBar() {
    const chip = (label, value) =>
      h(
        "button",
        {
          class: `btn small${activeRoom === value ? "" : " secondary"}`,
          onclick: () => {
            activeRoom = value;
            renderFilterBar();
            renderGrid();
          },
        },
        label
      );
    clearAndAppend(
      filterWrap,
      h("div", { style: "display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px" }, [chip("Todos", null), ...rooms.map((r) => chip(r, r))])
    );
  }

  renderFilterBar();
  renderGrid();

  clearAndAppend(
    container,
    h("div", {}, [h("div", { class: "section-title" }, "Habitantes"), filterWrap, gridWrap])
  );
}
