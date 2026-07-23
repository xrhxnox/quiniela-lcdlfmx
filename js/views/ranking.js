import { getLeaderboard } from "../data.js";
import { h, clearAndAppend } from "../utils.js";

export async function renderRanking(container) {
  clearAndAppend(container, h("div", { class: "loading" }, "Cargando…"));
  const rows = await getLeaderboard();

  if (rows.length === 0) {
    clearAndAppend(container, h("div", { class: "empty-state" }, "Aún no hay jugadores registrados."));
    return;
  }

  const body = rows.map((r, i) =>
    h("tr", { class: `rank-row${i === 0 ? " top1" : ""}` }, [
      h("td", {}, [`${i + 1} `, i === 0 ? h("i", { class: "fa-solid fa-crown" }) : null]),
      h("td", {}, r.display_name),
      h("td", { class: "num" }, String(r.points)),
    ])
  );

  clearAndAppend(
    container,
    h("div", {}, [
      h("div", { class: "section-title" }, "Ranking"),
      h("div", { class: "card table-wrap" }, [
        h("table", { class: "data" }, [
          h("thead", {}, h("tr", {}, [h("th", {}, "#"), h("th", {}, "Jugador"), h("th", {}, "Puntos")])),
          h("tbody", {}, body),
        ]),
      ]),
    ])
  );
}
