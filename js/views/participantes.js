import {
  getParticipants,
  getNominationCounts,
  getImmunityCounts,
  getSpecialImmunityCounts,
  getSavedCounts,
  getVotingWeek,
  getImmunitiesForWeek,
  getNominationsForWeek,
} from "../data.js";
import { h, esc, initials, clearAndAppend } from "../utils.js";
import { getShow, isGranja } from "../shows.js";

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
  const [currentImmunities, currentNominations] = votingWeek
    ? await Promise.all([getImmunitiesForWeek(votingWeek.id), getNominationsForWeek(votingWeek.id)])
    : [[], []];
  const currentLeaderIds = new Set(currentImmunities.filter((i) => i.is_leader).map((i) => i.participant_id));
  const currentImmuneIds = new Set(currentImmunities.filter((i) => !i.is_leader).map((i) => i.participant_id));
  const currentNominationMap = {};
  currentNominations.forEach((n) => (currentNominationMap[n.participant_id] = n));

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
      return h(
        "div",
        {
          class: "nominee-card",
          title: `Ver la ficha de ${p.name}`,
          onclick: () => {
            location.hash = `#/habitante/${p.id}`;
          },
        },
        [
        photo,
        h("div", { class: "info" }, [
          h("div", { class: "name" }, p.name),
          !isGranja() && p.room ? h("div", { class: "room" }, "Cuarto: " + p.room) : null,
          h("div", { style: "margin-top:6px;margin-bottom:4px;display:flex;flex-direction:column;align-items:center;gap:4px" }, [
            p.is_winner
              ? h("span", { class: "badge gold status-badge" }, [h("i", { class: "fa-solid fa-trophy" }), " GANADOR"])
              : p.active
              ? h("span", { class: "badge green status-badge" }, [
                  h("i", { class: `fa-solid ${getShow().icon}` }),
                  ` En ${getShow().homeLabel}`,
                ])
              : p.is_abandono
              ? h("span", { class: "badge red status-badge" }, [h("i", { class: "fa-solid fa-door-open" }), " Abandono"])
              : h("span", { class: "badge red status-badge" }, [h("i", { class: "fa-solid fa-skull" }), " Eliminado/a"]),
            !isGranja() && p.is_infiltrado
              ? h(
                  "span",
                  { class: "badge status-badge", style: "background:#a742f526;color:#a742f5;border:1px solid #a742f5" },
                  [h("i", { class: "fa-solid fa-glasses" }), " INFILTRADO"]
                )
              : null,
            isGranja() && p.is_peon
              ? h("span", { class: "badge status-badge", style: "background:#b0896826;color:#c99f7d;border:1px solid #b08968" }, [
                  h("i", { class: "fa-solid fa-person-digging" }),
                  " Peón",
                ])
              : null,
            !isGranja() && p.is_exiliado
              ? h("span", { class: "badge black status-badge" }, [h("i", { class: "fa-solid fa-bug" }), " EXILIADO/A"])
              : null,
            currentLeaderIds.has(p.id)
              ? h(
                  "span",
                  { class: "badge status-badge", style: "background:#ff7a1a26;color:#ff7a1a;border:1px solid #ff7a1a" },
                  [h("i", { class: "fa-solid fa-award" }), " " + getShow().leaderLabel]
                )
              : null,
            currentImmuneIds.has(p.id)
              ? h(
                  "span",
                  { class: "badge status-badge", style: "background:#ff7a1a26;color:#ff7a1a;border:1px solid #ff7a1a" },
                  [h("i", { class: "fa-solid fa-shield-halved" }), " Inmune"]
                )
              : null,
            currentNominationMap[p.id]
              ? currentNominationMap[p.id].saved
                ? h("span", { class: "badge status-badge", style: "background:#3b82f626;color:#3b82f6;border:1px solid #3b82f6" }, "Salvado")
                : h("span", { class: "badge gold status-badge" }, [h("i", { class: "fa-solid fa-triangle-exclamation" }), " Nominado"])
              : null,
          ]),
          h("div", { class: "points" }, `${getShow().leaderLabel} ${leaderCounts[p.id] || 0} veces`),
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
    setTimeout(() => {
      const cardEls = [...gridWrap.querySelectorAll(".nominee-card")];
      if (!cardEls.length) return;
      cardEls.forEach((c) => (c.style.minHeight = ""));
      const max = Math.max(...cardEls.map((c) => c.getBoundingClientRect().height));
      cardEls.forEach((c) => (c.style.minHeight = `${max}px`));
    });
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

  if (!isGranja()) renderFilterBar();
  renderGrid();

  clearAndAppend(
    container,
    h("div", {}, [h("div", { class: "section-title" }, "Habitantes"), filterWrap, gridWrap])
  );
}
