import {
  getVotingWeek,
  getLatestClosedWeek,
  getNominationsForWeek,
  getImmunitiesForWeek,
  getEliminationsForWeek,
  getMyPrediction,
  submitPrediction,
} from "../data.js";
import { h, esc, initials, fmtDate, clearAndAppend } from "../utils.js";

function photoOrInitials(p) {
  if (p.photo_url) {
    return h("div", { class: "photo", style: `background-image:url('${esc(p.photo_url)}')` });
  }
  return h("div", { class: "photo" }, initials(p.name));
}

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return days > 0 ? `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s` : `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
}

function countdownNode(closesAt, onClosed) {
  const closesAtMs = new Date(closesAt).getTime();
  const el = h("p", { style: "margin:0" });
  let fired = false;
  const render = () => {
    el.innerHTML = "";
    const remaining = closesAtMs - Date.now();
    if (remaining <= 0) {
      el.append(h("i", { class: "fa-solid fa-lock" }), " Votación cerrada");
      if (!fired) {
        fired = true;
        onClosed?.();
      }
      return false;
    }
    el.append(h("i", { class: "fa-solid fa-hourglass-half" }), " Cierra en: ", h("strong", { style: "color:var(--accent)" }, formatCountdown(remaining)));
    return true;
  };
  const tick = () => {
    if (!el.isConnected) return;
    if (render()) setTimeout(tick, 1000);
  };
  render();
  setTimeout(tick, 1000);
  return el;
}

async function renderVotingWeek(container, week, profile) {
  const [nominations, immunities, myPred] = await Promise.all([
    getNominationsForWeek(week.id),
    getImmunitiesForWeek(week.id),
    getMyPrediction(week.id, profile.id),
  ]);

  let selected = myPred ? myPred.participant_id : null;
  if (selected && nominations.find((n) => n.participant_id === selected)?.saved) {
    selected = null;
  }

  const pickedName = myPred ? nominations.find((n) => n.participant_id === myPred.participant_id)?.participants?.name : null;
  const statusMsg = h(
    "div",
    { class: "success-msg" },
    myPred ? `Ya tienes un pick guardado: ${pickedName || "—"}. Puedes cambiarlo mientras la votación siga abierta.` : ""
  );
  const errMsg = h("div", { class: "error-msg" });

  const cards = nominations.map((n) => {
    const p = n.participants;
    const card = h(
      "div",
      {
        class: `nominee-card${selected === p.id ? " selected" : ""}${n.saved ? " saved" : ""}`,
        onclick: n.saved
          ? null
          : () => {
              selected = p.id;
              [...cardsWrap.children].forEach((c) => c.classList.remove("selected"));
              card.classList.add("selected");
            },
      },
      [
        h("div", { class: "check" }, h("i", { class: "fa-solid fa-check" })),
        n.saved ? h("div", { class: "saved-flag" }, [h("i", { class: "fa-solid fa-shield-halved" }), " Salvado"]) : null,
        photoOrInitials(p),
        h("div", { class: "info" }, [
          h("div", { class: "name" }, p.name),
          p.room ? h("div", { class: "room" }, p.room) : null,
          h("div", { class: "points" }, `${n.points} pts de nominación`),
        ]),
      ]
    );
    return card;
  });

  const cardsWrap = h("div", { class: "grid" }, cards);

  const immuneBlock =
    immunities.length > 0
      ? h("p", { class: "muted", style: "font-size:0.82rem" }, [
          h("i", { class: "fa-solid fa-shield-halved" }),
          " Líder de la semana / inmunes: ",
          h("strong", {}, immunities.map((i) => i.participants.name).join(", ")),
        ])
      : null;

  const submitBtn = h(
    "button",
    {
      class: "btn",
      onclick: async () => {
        if (!selected) {
          errMsg.textContent = "Elige a quién crees que va a salir eliminado.";
          return;
        }
        errMsg.textContent = "";
        submitBtn.disabled = true;
        submitBtn.textContent = "Guardando…";
        try {
          await submitPrediction(week.id, profile.id, selected);
          const name = nominations.find((n) => n.participant_id === selected)?.participants?.name;
          statusMsg.textContent = `¡Pick guardado: ${name || "—"}! Puedes cambiarlo hasta que cierre la votación.`;
        } catch (e) {
          errMsg.textContent = "No se pudo guardar tu pick. Intenta de nuevo.";
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = "Guardar mi pick";
        }
      },
    },
    "Guardar mi pick"
  );

  const countdown = week.voting_closes_at
    ? countdownNode(week.voting_closes_at, () => {
        submitBtn.disabled = true;
        submitBtn.textContent = "Votación cerrada";
        cardsWrap.style.pointerEvents = "none";
        cardsWrap.style.opacity = "0.6";
      })
    : null;

  clearAndAppend(
    container,
    h("div", {}, [
      h("div", { class: "section-title" }, week.label || `Semana ${week.week_number}`),
      h("div", { class: "card" }, [
        h("p", {}, [
          h("i", { class: "fa-solid fa-calendar-days" }),
          " Eliminación: ",
          h("strong", {}, week.elimination_date ? fmtDate(week.elimination_date) : "por confirmar"),
          ...(week.voting_closes_at
            ? [
                " · ",
                h("strong", {}, new Date(week.voting_closes_at).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" })),
              ]
            : []),
        ]),
        countdown,
        immuneBlock,
        h("p", { class: "muted", style: "font-size:0.82rem" }, "Elige entre los nominados quién crees que será eliminado. Si le atinas, sumas 1 punto."),
      ]),
      nominations.length === 0
        ? h("div", { class: "empty-state" }, "Aún no hay nominados publicados para esta semana.")
        : h("div", {}, [cardsWrap, h("div", { style: "margin-top:16px;display:flex;gap:10px;align-items:center" }, [submitBtn, statusMsg, errMsg])]),
    ])
  );
}

async function renderClosedWeek(container, week, profile) {
  const [eliminations, myPred] = await Promise.all([
    getEliminationsForWeek(week.id),
    getMyPrediction(week.id, profile.id),
  ]);
  const eliminatedIds = eliminations.map((e) => e.participant_id);
  const hit = myPred && eliminatedIds.includes(myPred.participant_id);

  const resultCards = eliminations.map((e) =>
    h("div", { class: "nominee-card eliminated-result" }, [
      photoOrInitials(e.participants),
      h("div", { class: "info" }, [h("div", { class: "name" }, e.participants.name), h("div", { class: "room" }, "Eliminado/a")]),
    ])
  );

  clearAndAppend(
    container,
    h("div", {}, [
      h("div", { class: "section-title" }, week.label || `Semana ${week.week_number}`),
      h("div", { class: "card", style: "text-align:center" }, [
        h("p", {}, eliminations.length ? "Resultado de esta semana:" : "Aún no se ha confirmado quién salió."),
        eliminations.length
          ? h("div", { class: "grid", style: "grid-template-columns:repeat(auto-fit, minmax(150px, 150px));justify-content:center" }, resultCards)
          : null,
        myPred
          ? h("p", { style: "margin-top:12px" }, [
              "Tu pick fue ",
              h("strong", {}, myPred.participant_id ? "guardado" : "—"),
              ". ",
              hit
                ? h("span", { class: "badge green" }, "¡Le atinaste! +1 punto")
                : h("span", { class: "badge red" }, "No le atinaste esta vez"),
            ])
          : h("p", { class: "muted", style: "margin-top:12px" }, "No registraste un pick esta semana."),
      ]),
      h("p", { class: "muted" }, "El líder de la semana se publica el lunes, los nominados el miércoles y la salvación el viernes. ¡Vuelve pronto!"),
    ])
  );
}

export async function renderHome(container, profile) {
  clearAndAppend(container, h("div", { class: "loading" }, "Cargando…"));
  const votingWeek = await getVotingWeek();
  if (votingWeek) {
    await renderVotingWeek(container, votingWeek, profile);
    return;
  }
  const closedWeek = await getLatestClosedWeek();
  if (closedWeek) {
    await renderClosedWeek(container, closedWeek, profile);
    return;
  }
  clearAndAppend(
    container,
    h("div", { class: "empty-state" }, [
      h("img", { src: "assets/logo.png", class: "brand-logo", style: "max-width:220px;margin:0 auto 36px" }),
      h("p", {}, "Todavía no hay semanas abiertas. El líder de la semana se anuncia los lunes y los nominados se publican los miércoles."),
    ])
  );
}
