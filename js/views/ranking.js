import { getLeaderboard, getLatestClosedWeek, getPredictionsForWeek, getEliminationsForWeek } from "../data.js";
import { h, clearAndAppend } from "../utils.js";

async function buildActivityFeed() {
  const week = await getLatestClosedWeek();
  if (!week) return null;

  const [predictions, eliminations] = await Promise.all([getPredictionsForWeek(week.id), getEliminationsForWeek(week.id)]);
  if (predictions.length === 0) return null;

  const eliminatedIds = new Set(eliminations.map((e) => e.participant_id));
  const hits = predictions.filter((p) => eliminatedIds.has(p.participant_id));
  const misses = predictions.filter((p) => !eliminatedIds.has(p.participant_id));

  const nameList = (list) => list.map((p) => p.profiles?.display_name).filter(Boolean).join(", ");

  return h("div", { class: "card" }, [
    h("p", { style: "margin-top:0" }, [
      h("i", { class: "fa-solid fa-bolt" }),
      " ",
      h("strong", {}, `Actividad — ${week.label || `Semana ${week.week_number}`}`),
    ]),
    hits.length ? h("p", {}, [h("span", { class: "badge green" }, "Acertaron"), " ", nameList(hits)]) : null,
    misses.length ? h("p", { style: "margin-bottom:0" }, [h("span", { class: "badge red" }, "Fallaron"), " ", nameList(misses)]) : null,
  ]);
}

export async function renderRanking(container) {
  clearAndAppend(container, h("div", { class: "loading" }, "Cargando…"));
  const [rows, activityFeed] = await Promise.all([getLeaderboard(), buildActivityFeed()]);

  if (rows.length === 0) {
    clearAndAppend(container, h("div", { class: "empty-state" }, "Aún no hay jugadores registrados."));
    return;
  }

  const body = rows.map((r, i) =>
    h("tr", { class: `rank-row${i === 0 ? " top1" : ""}` }, [
      h("td", {}, [`${i + 1} `, i === 0 ? h("i", { class: "fa-solid fa-crown" }) : null]),
      h("td", {}, [
        h("div", { class: "player-cell" }, [
          h("span", { style: "font-weight:700" }, r.display_name),
          h("a", { href: `#/perfil/${encodeURIComponent(r.username)}`, class: "player-link" }, [
            h("i", { class: "fa-solid fa-user" }),
            " Ver perfil",
          ]),
        ]),
      ]),
      h("td", { class: "num" }, String(r.points)),
    ])
  );

  clearAndAppend(
    container,
    h("div", {}, [
      h("div", { class: "section-title" }, "Ranking"),
      activityFeed,
      h("div", { class: "card table-wrap" }, [
        h("table", { class: "data" }, [
          h("thead", {}, h("tr", {}, [h("th", {}, "#"), h("th", {}, "Jugador"), h("th", {}, "Puntos")])),
          h("tbody", {}, body),
        ]),
      ]),
    ])
  );
}
