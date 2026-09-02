import {
  getVotingWeek,
  getLatestClosedWeek,
  getNominationsForWeek,
  getImmunitiesForWeek,
  getEliminationsForWeek,
  getMyPrediction,
  submitPrediction,
  getParticipants,
  getNominationVotesForWeek,
  getWeeks,
  getAllGranjaDynamics,
} from "../data.js";
import { h, esc, initials, fmtDate, clearAndAppend } from "../utils.js";
import { getShow, isGranja } from "../shows.js";

// Renglón con icono, del mismo estilo que los de Capataz e Inmune.
function infoLine(icon, children, size = "0.82rem") {
  return h("p", { class: "muted", style: `font-size:${size};margin:4px 0` }, [
    h("i", { class: `fa-solid ${icon}`, style: "color:var(--accent)" }),
    " ",
    ...children,
  ]);
}

// Duelo, traición y El Legado de una semana, ya resueltos a nombres.
function granjaDynamicLines(weekId, dyn, nameOf, size) {
  if (!dyn) return [];
  const out = [];

  const duel = dyn.duels.find((d) => d.week_id === weekId);
  if (duel) {
    const versus = `${nameOf(duel.participant_a_id)} vs ${nameOf(duel.participant_b_id)}`;
    out.push(
      infoLine("fa-hand-fist", [
        " Duelo: ",
        h("strong", {}, versus),
        ...(duel.loser_id ? [" · perdió ", h("strong", {}, nameOf(duel.loser_id))] : []),
      ], size)
    );
  }

  const bet = dyn.betrayals.find((b) => b.week_id === weekId);
  if (bet) {
    out.push(
      infoLine("fa-user-secret", [
        " Traición: ",
        ...(bet.traitor_id ? [h("strong", {}, nameOf(bet.traitor_id)), " sacó de riesgo a "] : ["salió de riesgo "]),
        h("strong", {}, nameOf(bet.out_participant_id)),
        " y metió a ",
        h("strong", {}, nameOf(bet.in_participant_id)),
      ], size)
    );
  }

  const leg = dyn.legacies.find((l) => l.week_id === weekId);
  if (leg) {
    out.push(
      infoLine("fa-ghost", [
        " El Legado: ",
        h("strong", {}, nameOf(leg.from_participant_id)),
        " nominó a ",
        h("strong", {}, nameOf(leg.to_participant_id)),
      ], size)
    );
  }

  return out;
}

function officialVoteButton() {
  return h(
    "a",
    {
      href: "https://www.lacasadelosfamososmexico.tv/vota",
      target: "_blank",
      rel: "noopener noreferrer",
      class: "btn",
      style: "display:inline-flex;align-items:center;gap:8px;text-decoration:none",
    },
    [h("i", { class: "fa-solid fa-arrow-up-right-from-square" }), "Vota en la página oficial"]
  );
}

async function buildHistoryCards() {
  const [weeks, allParticipants, dyn] = await Promise.all([
    getWeeks(),
    getParticipants(),
    isGranja() ? getAllGranjaDynamics() : Promise.resolve(null),
  ]);
  const nameOfP = (id) => allParticipants.find((x) => x.id === id)?.name || "—";
  if (weeks.length === 0) return [h("div", { class: "empty-state" }, "Todavía no hay semanas registradas.")];
  const participantById = new Map(allParticipants.map((p) => [p.id, p]));

  const perWeek = await Promise.all(
    weeks.map(async (week) => {
      const [nominations, immunities, eliminations] = await Promise.all([
        getNominationsForWeek(week.id),
        getImmunitiesForWeek(week.id),
        getEliminationsForWeek(week.id),
      ]);
      return { week, nominations, immunities, eliminations };
    })
  );

  return perWeek.map(({ week, nominations, immunities, eliminations }) => {
    const leaders = immunities.filter((i) => i.is_leader).map((i) => i.participants.name);
    const immunes = immunities.filter((i) => !i.is_leader).map((i) => i.participants.name);
    const eliminatedNames = eliminations.map((e) => e.participants.name);

    const nomineeChips = nominations.map((n) =>
      h(
        "span",
        { class: `badge ${n.saved ? "green" : "gray"}`, style: "margin:2px 4px 2px 0;display:inline-block" },
        `${n.participants.name} (${n.points}pts)${n.saved ? " · Salvado" : ""}`
      )
    );

    // La Salvación: quién terminó con ella y cómo. A quién salvó ya sale en los
    // chips de nominados con la marca "Salvado".
    const salvationHolder = participantById.get(week.salvation_participant_id);

    return h("div", { class: "card" }, [
      h("p", { style: "margin-top:0" }, h("strong", {}, week.label || `Semana ${week.week_number}`)),
      leaders.length
        ? h("p", { class: "muted", style: "font-size:0.78rem;margin:4px 0" }, [
            h("i", { class: "fa-solid fa-crown", style: "color:var(--accent)" }),
            ` ${getShow().leaderLabel}: `,
            leaders.join(", "),
          ])
        : null,
      immunes.length
        ? h("p", { class: "muted", style: "font-size:0.78rem;margin:4px 0" }, [
            h("i", { class: "fa-solid fa-shield-halved", style: "color:var(--accent)" }),
            " Inmune: ",
            immunes.join(", "),
          ])
        : null,
      salvationHolder
        ? h("p", { class: "muted", style: "font-size:0.78rem;margin:4px 0" }, [
            h("i", {
              class: `fa-solid ${week.salvation_mode === "robo" ? "fa-sack-dollar" : "fa-hand-holding-heart"}`,
              style: "color:var(--accent)",
            }),
            " Salvación: ",
            salvationHolder.name,
            isGranja() ? " se salvó" : week.salvation_mode === "robo" ? " (se la robó)" : " (la conservó)",
          ])
        : null,
      ...granjaDynamicLines(week.id, dyn, nameOfP, "0.78rem"),
      h("div", { style: "margin:6px 0" }, [
        h("span", { class: "muted", style: "font-size:0.78rem" }, nomineeChips.length ? "Nominados: " : "Sin nominados registrados."),
        ...nomineeChips,
      ]),
      h("p", { style: "margin:4px 0 0" }, [
        h("span", { class: `badge ${eliminatedNames.length ? "red" : "gray"}` }, eliminatedNames.length ? "Eliminado/a" : "Sin confirmar"),
        ...(eliminatedNames.length ? [" ", h("strong", {}, eliminatedNames.join(", "))] : []),
      ]),
    ]);
  });
}

function buildHistoryToggle() {
  const wrap = h("div", { style: "display:none;margin-top:16px" });
  let loaded = false;
  const btn = h(
    "button",
    {
      class: "btn secondary",
      onclick: async () => {
        const isHidden = wrap.style.display === "none";
        if (isHidden && !loaded) {
          clearAndAppend(wrap, h("div", { class: "loading" }, "Cargando…"));
          wrap.style.display = "block";
          const cards = await buildHistoryCards();
          clearAndAppend(wrap, h("div", {}, cards));
          loaded = true;
        } else {
          wrap.style.display = isHidden ? "block" : "none";
        }
        btn.textContent = wrap.style.display === "none" ? "Ver Historial" : "Ocultar Historial";
      },
    },
    "Ver Historial"
  );
  return { btn, wrap };
}

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
      el.append(h("i", { class: "fa-solid fa-lock", style: "color:var(--accent)" }), " Votación cerrada");
      if (!fired) {
        fired = true;
        onClosed?.();
      }
      return false;
    }
    el.append(h("i", { class: "fa-solid fa-hourglass-half", style: "color:var(--accent)" }), " Cierra en: ", h("strong", { style: "color:var(--accent)" }, formatCountdown(remaining)));
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
  const [nominations, immunities, myPred, allParticipants, nominationVotes, dyn] = await Promise.all([
    getNominationsForWeek(week.id),
    getImmunitiesForWeek(week.id),
    getMyPrediction(week.id, profile.id),
    getParticipants(),
    getNominationVotesForWeek(week.id),
    isGranja() ? getAllGranjaDynamics() : Promise.resolve(null),
  ]);

  let selected = myPred ? myPred.participant_id : null;
  if (selected && nominations.find((n) => n.participant_id === selected)?.saved) {
    selected = null;
  }

  const pickedName = myPred ? nominations.find((n) => n.participant_id === myPred.participant_id)?.participants?.name : null;
  const statusMsg = h(
    "div",
    { class: "success-msg", style: "margin-top:10px" },
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
          !isGranja() && p.room ? h("div", { class: "room" }, p.room) : null,
          h("div", { class: "points" }, `${n.points} pts de nominación`),
        ]),
      ]
    );
    return card;
  });

  const cardsWrap = h("div", { class: "grid" }, cards);

  // --- Ver Nominaciones (quién nominó a quién) ---
  const participantById = {};
  allParticipants.forEach((p) => (participantById[p.id] = p));
  const votesByNominator = {};
  nominationVotes.forEach((v) => {
    if (!votesByNominator[v.nominator_id]) votesByNominator[v.nominator_id] = [];
    votesByNominator[v.nominator_id].push(v.nominee_id);
  });
  const nominationCards = allParticipants
    .filter((p) => p.active)
    .map((p) => {
      const nomineeNames = (votesByNominator[p.id] || []).map((id) => participantById[id]?.name).filter(Boolean);
      return h("div", { class: "nominee-card", style: "cursor:default" }, [
        photoOrInitials(p),
        h("div", { class: "info" }, [
          h("div", { class: "name" }, p.name),
          h(
            "div",
            { class: "muted", style: "font-size:0.72rem;margin-top:4px" },
            nomineeNames.length
              ? [h("div", {}, "Nominó a:"), ...nomineeNames.map((n) => h("div", {}, n))]
              : "Sin nominar"
          ),
        ]),
      ]);
    });
  const nominationsWrap = h("div", { style: "display:none;margin-top:16px" }, [h("div", { class: "grid" }, nominationCards)]);
  const toggleNominationsBtn = h(
    "button",
    {
      class: "btn secondary",
      onclick: () => {
        const isHidden = nominationsWrap.style.display === "none";
        nominationsWrap.style.display = isHidden ? "block" : "none";
        toggleNominationsBtn.textContent = isHidden ? "Ocultar Nominaciones" : "Ver Nominaciones";
      },
    },
    "Ver Nominaciones"
  );

  const leaders = immunities.filter((i) => i.is_leader);
  const immunes = immunities.filter((i) => !i.is_leader);

  const leaderBlock =
    leaders.length > 0
      ? h("p", { class: "muted", style: "font-size:0.82rem" }, [
          h("i", { class: "fa-solid fa-crown", style: "color:var(--accent)" }),
          ` ${getShow().leaderLabel} de la semana: `,
          h("strong", {}, leaders.map((i) => i.participants.name).join(", ")),
        ])
      : null;

  // La Salvación de la semana: quién terminó con ella, si se la robaron al
  // líder, y a quién salvó. El salvado ya trae su marca en la reja de abajo,
  // pero aquí se nombra para que la historia se lea completa de un vistazo.
  const salvationHolder = allParticipants.find((x) => x.id === week.salvation_participant_id);
  const savedName = nominations.find((n) => n.saved)?.participants?.name;
  const salvationBlock = salvationHolder
    ? h("p", { class: "muted", style: "font-size:0.82rem" }, [
        h("i", {
          class: `fa-solid ${week.salvation_mode === "robo" ? "fa-sack-dollar" : "fa-hand-holding-heart"}`,
          style: "color:var(--accent)",
        }),
        " Salvación: ",
        h("strong", {}, salvationHolder.name),
        // En La Granja la gana un nominado y se salva a sí mismo, así que no
        // hay modo ni "salvó a": la frase se acaba en su nombre.
        ...(isGranja()
          ? [" se salvó"]
          : [
              week.salvation_mode === "robo" ? ` se la robó al ${getShow().leaderLabel.toLowerCase()}` : " la conservó",
              ...(savedName ? [" y salvó a ", h("strong", {}, savedName)] : []),
            ]),
      ])
    : null;

  const immuneBlock =
    immunes.length > 0
      ? h("p", { class: "muted", style: "font-size:0.82rem" }, [
          h("i", { class: "fa-solid fa-shield-halved", style: "color:var(--accent)" }),
          " Inmune: ",
          h("strong", {}, immunes.map((i) => i.participants.name).join(", ")),
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

  const { btn: historyBtn, wrap: historyWrap } = buildHistoryToggle();

  clearAndAppend(
    container,
    h("div", {}, [
      h("div", { class: "section-title" }, week.label || `Semana ${week.week_number}`),
      h("div", { class: "card" }, [
        h("p", {}, [
          h("i", { class: "fa-solid fa-calendar-days", style: "color:var(--accent)" }),
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
        leaderBlock,
        immuneBlock,
        salvationBlock,
        ...granjaDynamicLines(week.id, dyn, (id) => allParticipants.find((x) => x.id === id)?.name || "—"),
        h("p", { class: "muted", style: "font-size:0.82rem" }, "Elige entre los nominados quién crees que será eliminado. Si le atinas, sumas 1 punto."),
        h("div", { style: "margin-top:10px" }, [officialVoteButton()]),
      ]),
      nominations.length === 0
        ? h("div", { class: "empty-state" }, "Aún no hay nominados publicados para esta semana.")
        : h("div", {}, [
            cardsWrap,
            h("div", { style: "margin-top:16px;display:flex;flex-direction:column;align-items:center;gap:6px" }, [submitBtn, statusMsg, errMsg]),
            h("div", { style: "margin-top:10px;display:flex;justify-content:center;gap:10px;flex-wrap:wrap" }, [toggleNominationsBtn, historyBtn]),
            nominationsWrap,
          ]),
      nominations.length === 0
        ? h("div", { style: "margin-top:16px;display:flex;justify-content:center" }, [historyBtn])
        : null,
      historyWrap,
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
  const resultBadge = !myPred
    ? h("span", { class: "badge gold" }, "No votaste")
    : hit
    ? h("span", { class: "badge green" }, "¡Le atinaste! +1 punto")
    : h("span", { class: "badge red" }, "No le atinaste esta vez");

  const resultCards = eliminations.map((e) =>
    h("div", { class: "nominee-card eliminated-result" }, [
      photoOrInitials(e.participants),
      h("div", { class: "info" }, [h("div", { class: "name" }, e.participants.name), h("div", { class: "room" }, "Eliminado/a")]),
    ])
  );

  const { btn: historyBtn, wrap: historyWrap } = buildHistoryToggle();

  clearAndAppend(
    container,
    h("div", {}, [
      h("div", { class: "section-title" }, week.label || `Semana ${week.week_number}`),
      h("div", { class: "card", style: "text-align:center" }, [
        h("p", {}, eliminations.length ? "Resultado de esta semana:" : "Aún no se ha confirmado quién salió."),
        eliminations.length
          ? h("div", { class: "grid", style: "grid-template-columns:repeat(auto-fit, minmax(150px, 150px));justify-content:center" }, resultCards)
          : null,
        eliminations.length ? h("div", { style: "margin-top:12px" }, [resultBadge]) : null,
        h("div", { style: "margin-top:14px;display:flex;justify-content:center;gap:10px;flex-wrap:wrap" }, [historyBtn]),
      ]),
      historyWrap,
      h("p", { class: "muted" }, getShow().scheduleHint),
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
  const { btn: historyBtn, wrap: historyWrap } = buildHistoryToggle();
  clearAndAppend(
    container,
    h("div", {}, [
      h("div", { class: "empty-state" }, [
        h("img", { src: getShow().logo, class: "brand-logo", style: "max-width:220px;margin:0 auto 36px" }),
        h("p", {}, getShow().emptyHint),
        h("div", { style: "margin-top:14px;display:flex;justify-content:center;gap:10px;flex-wrap:wrap" }, [historyBtn]),
      ]),
      historyWrap,
    ])
  );
}
