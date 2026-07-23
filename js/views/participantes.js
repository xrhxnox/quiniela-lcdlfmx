import { getParticipants, getNominationCounts, getImmunityCounts, getSavedCounts } from "../data.js";
import { h, esc, initials, clearAndAppend } from "../utils.js";

export async function renderParticipantes(container) {
  clearAndAppend(container, h("div", { class: "loading" }, "Cargando…"));
  const [participants, counts, leaderCounts, savedCounts] = await Promise.all([
    getParticipants(),
    getNominationCounts(),
    getImmunityCounts(),
    getSavedCounts(),
  ]);

  if (participants.length === 0) {
    clearAndAppend(container, h("div", { class: "empty-state" }, "El admin todavía no ha agregado participantes."));
    return;
  }

  const sorted = [...participants].sort((a, b) => (a.active === b.active ? a.name.localeCompare(b.name) : a.active ? -1 : 1));

  const cards = sorted.map((p) => {
    const photo = p.photo_url
      ? h("div", { class: "photo", style: `background-image:url('${esc(p.photo_url)}')` })
      : h("div", { class: "photo" }, initials(p.name));
    return h("div", { class: "nominee-card", style: "cursor:default" }, [
      photo,
      h("div", { class: "info" }, [
        h("div", { class: "name" }, p.name),
        p.room ? h("div", { class: "room" }, "Cuarto: " + p.room) : null,
        h("div", { style: "margin-top:6px" }, [
          p.active
            ? h("span", { class: "badge green" }, "En la casa")
            : h("span", { class: "badge red" }, "Eliminado/a"),
        ]),
        h("div", { class: "points" }, `Líder ${leaderCounts[p.id] || 0} veces`),
        h("div", { class: "points" }, `Salvado ${savedCounts[p.id] || 0} veces`),
        h("div", { class: "points" }, `Nominado ${counts[p.id] || 0} veces`),
      ]),
    ]);
  });

  clearAndAppend(
    container,
    h("div", {}, [h("div", { class: "section-title" }, "Habitantes"), h("div", { class: "grid" }, cards)])
  );
}
