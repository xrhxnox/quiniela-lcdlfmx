import { getAllEliminationsWithWeeks } from "../data.js";
import { h, esc, initials, fmtDate, clearAndAppend } from "../utils.js";

export async function renderEliminados(container) {
  clearAndAppend(container, h("div", { class: "loading" }, "Cargando…"));
  const rows = await getAllEliminationsWithWeeks();

  if (rows.length === 0) {
    clearAndAppend(container, h("div", { class: "empty-state" }, "Todavía no hay eliminados registrados."));
    return;
  }

  const body = rows.map((r) => {
    const avatar = r.participants.photo_url
      ? h("div", { class: "avatar-sm", style: `background-image:url('${esc(r.participants.photo_url)}')` })
      : h("div", { class: "avatar-sm" }, initials(r.participants.name));
    return h("tr", {}, [
      h("td", {}, r.weeks.label || `Semana ${r.weeks.week_number}`),
      h("td", {}, h("div", { class: "row-flex" }, [avatar, h("span", {}, r.participants.name)])),
      h("td", {}, r.weeks.elimination_date ? fmtDate(r.weeks.elimination_date) : "—"),
    ]);
  });

  clearAndAppend(
    container,
    h("div", {}, [
      h("div", { class: "section-title" }, "Eliminados por semana"),
      h("div", { class: "card table-wrap" }, [
        h("table", { class: "data" }, [
          h("thead", {}, h("tr", {}, [h("th", {}, "Semana"), h("th", {}, "Eliminado/a"), h("th", {}, "Fecha")])),
          h("tbody", {}, body),
        ]),
      ]),
    ])
  );
}
