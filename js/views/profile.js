import {
  getParticipants,
  getMyPredictionHistory,
  getAllEliminationsWithWeeks,
  updateMyProfile,
  uploadMyAvatar,
  getProfileByUsername,
  getLeaderboard,
  getLegacyFavorites,
  getNominationCounts,
  getImmunityCounts,
  getSavedCounts,
  getVotingWeek,
  getNominationsForWeek,
} from "../data.js";
import { ACCENTS, getAccentKey, applyAccent } from "../theme.js";
import { ROOM_OPTIONS, LEGACY_ROOM_OPTIONS } from "../rooms.js";
import { h, esc, initials, clearAndAppend } from "../utils.js";

const PICK_TYPE_ICONS = {
  favorite: { icon: "fa-star", color: "#ffffff" },
  hated: { icon: "fa-skull-crossbones", color: "#ffffff" },
  surprise: { icon: "fa-bomb", color: "#ffffff" },
  disappointment: { icon: "fa-heart-crack", color: "#ffffff" },
};

function pickTypeIcon(type) {
  const style = PICK_TYPE_ICONS[type];
  if (!style) return null;
  return h("div", { class: "pick-type-icon", style: `color:${style.color}` }, h("i", { class: `fa-solid ${style.icon}` }));
}

function participantPickCard(label, participant, type, counts, currentNomination) {
  if (!participant) {
    return h("div", { class: "nominee-card", style: "cursor:default" }, [
      h("div", { class: "photo" }, h("i", { class: `fa-solid ${PICK_TYPE_ICONS[type]?.icon || "fa-user"}` })),
      h("div", { class: "info" }, [
        pickTypeIcon(type),
        h("div", { class: "muted", style: "font-size:0.7rem;text-transform:uppercase;letter-spacing:0.04em" }, label),
        h("div", { class: "name" }, "Sin definir"),
      ]),
    ]);
  }
  const photo = participant.photo_url
    ? h("div", { class: "photo", style: `background-image:url('${esc(participant.photo_url)}')` })
    : h("div", { class: "photo" }, initials(participant.name));
  const timesNominated = counts?.nomination?.[participant.id] || 0;
  const timesLeader = counts?.immunity?.[participant.id] || 0;
  const timesSaved = counts?.saved?.[participant.id] || 0;

  let weekBadge = null;
  if (participant.active && currentNomination) {
    weekBadge = currentNomination.saved
      ? h("span", { class: "badge green" }, "Salvado esta semana")
      : h("span", { class: "badge gold" }, "Nominado esta semana");
  }

  return h("div", { class: "nominee-card", style: "cursor:default" }, [
    photo,
    h("div", { class: "info" }, [
      pickTypeIcon(type),
      h("div", { class: "muted", style: "font-size:0.7rem;text-transform:uppercase;letter-spacing:0.04em" }, label),
      h("div", { class: "name" }, participant.name),
      participant.room ? h("div", { class: "room" }, participant.room) : null,
      h("div", { style: "margin-top:6px;display:flex;flex-direction:column;align-items:center;gap:4px" }, [
        participant.active
          ? h("span", { class: "badge green" }, "En la casa")
          : h("span", { class: "badge red" }, "Eliminado/a"),
        weekBadge,
      ]),
      h("div", { class: "points", style: "color:var(--cyan)" }, `Líder ${timesLeader} veces`),
      h("div", { class: "points" }, `Salvado ${timesSaved} veces`),
      h("div", { class: "points", style: "color:var(--red)" }, `Nominado ${timesNominated} veces`),
    ]),
  ]);
}

function avatarNode(profile, size) {
  const style = `width:${size}px;height:${size}px;border-radius:50%;flex-shrink:0;`;
  if (profile.avatar_url) {
    return h("div", {
      style: `${style}background:var(--bg-elev) url('${esc(profile.avatar_url)}') center/contain no-repeat;`,
    });
  }
  const theme = ACCENTS[profile.accent_color] || ACCENTS.rojo;
  return h(
    "div",
    {
      style: `${style}display:flex;align-items:center;justify-content:center;background:${theme.accent};color:${theme.text};font-weight:800;font-size:${size * 0.4}px;font-family:var(--font-display)`,
    },
    (profile.display_name || "?")[0].toUpperCase()
  );
}

function sortHistory(history) {
  return [...history].sort((a, b) => (b.weeks.week_number ?? 0) - (a.weeks.week_number ?? 0));
}

function computeStats(history, eliminatedSet) {
  const closed = sortHistory(history).filter((row) => row.weeks.status === "closed");
  const hits = closed.map((row) => eliminatedSet.has(`${row.week_id}:${row.participant_id}`));
  const totalClosed = closed.length;
  const correctCount = hits.filter(Boolean).length;
  const accuracyPct = totalClosed ? Math.round((correctCount / totalClosed) * 100) : null;

  let currentStreak = 0;
  for (const hit of hits) {
    if (hit) currentStreak++;
    else break;
  }

  let bestStreak = 0;
  let running = 0;
  for (let i = hits.length - 1; i >= 0; i--) {
    if (hits[i]) {
      running++;
      bestStreak = Math.max(bestStreak, running);
    } else {
      running = 0;
    }
  }

  return { totalClosed, correctCount, accuracyPct, currentStreak, bestStreak };
}

function buildBadges(stats, favorite) {
  const badges = [];
  if (stats.currentStreak >= 3) badges.push({ icon: "fa-fire", label: `Racha de ${stats.currentStreak}` });
  if (stats.bestStreak >= 5) badges.push({ icon: "fa-crow", label: "Ojo de águila" });
  if (stats.totalClosed >= 3 && stats.accuracyPct >= 70) badges.push({ icon: "fa-bullseye", label: "Francotirador" });
  if (favorite && favorite.active === false) badges.push({ icon: "fa-heart-crack", label: "Corazón roto" });
  return badges;
}

const ROOM_BADGE_STYLES = {
  "Sin Cuarto": { color: "#8a8a8d", icon: "fa-skull" },
  Ibiza: { color: "#2596be", icon: "fa-droplet" },
  Tulum: { color: "#2fae5a", icon: "fa-seedling" },
  Malibú: { color: "#e0574c", icon: "fa-heart" },
};

function legacyPickCard(label, fav, type) {
  if (!fav) {
    return h("div", { class: "nominee-card", style: "cursor:default" }, [
      h("div", { class: "photo" }, h("i", { class: `fa-solid ${PICK_TYPE_ICONS[type]?.icon || "fa-clock-rotate-left"}` })),
      h("div", { class: "info" }, [
        pickTypeIcon(type),
        h("div", { class: "muted", style: "font-size:0.7rem;text-transform:uppercase;letter-spacing:0.04em" }, label),
        h("div", { class: "name" }, "Sin definir"),
      ]),
    ]);
  }
  const photo = fav.photo_url
    ? h("div", { class: "photo", style: `background-image:url('${esc(fav.photo_url)}')` })
    : h("div", { class: "photo" }, initials(fav.name));
  return h("div", { class: "nominee-card", style: "cursor:default" }, [
    photo,
    h("div", { class: "info" }, [
      pickTypeIcon(type),
      h("div", { class: "muted", style: "font-size:0.7rem;text-transform:uppercase;letter-spacing:0.04em" }, label),
      h("div", { class: "name" }, fav.name),
    ]),
  ]);
}

function teamBadgeNode(room) {
  if (!room) return null;
  const style = ROOM_BADGE_STYLES[room] || { color: "#e8c05a", icon: "fa-umbrella-beach" };
  return h(
    "span",
    { class: "badge", style: `background:${style.color}26;color:${style.color};border:1px solid ${style.color};margin-top:6px` },
    [h("i", { class: `fa-solid ${style.icon}` }), ` Team ${room}`]
  );
}

const LEGACY_ROOM_BADGE_STYLES = {
  Cielo: { color: "#7dd3fc", icon: "fa-cloud" },
  Infierno: { color: "#dc2626", icon: "fa-fire-flame-curved" },
  Mar: { color: "#0279f0", icon: "fa-water" },
  Tierra: { color: "#a16207", icon: "fa-mountain" },
  Día: { color: "#eab308", icon: "fa-sun" },
  Noche: { color: "#4338ca", icon: "fa-moon" },
  Eclipse: { color: "#ff8000", icon: "fa-circle-half-stroke" },
  "Solo Wendy Guevara": { color: "#f472b6", icon: "fa-transgender" },
  "Gomita Super Buena Onda": { color: "#22c55e", icon: "fa-thumbs-up" },
};

function legacyRoomBadgeNode(value) {
  if (!value) return null;
  const style = LEGACY_ROOM_BADGE_STYLES[value] || { color: "#e8c05a", icon: "fa-clock-rotate-left" };
  return h(
    "span",
    { class: "badge", style: `background:${style.color}26;color:${style.color};border:1px solid ${style.color};margin-top:6px` },
    [h("i", { class: `fa-solid ${style.icon}` }), ` Team ${value}`]
  );
}

export async function renderProfile(container, viewerProfile) {
  await renderProfileInternal(container, viewerProfile.username);
}

export async function renderPublicProfile(container, username) {
  await renderProfileInternal(container, username);
}

export async function renderEditProfile(container, viewerProfile, onUpdate) {
  clearAndAppend(container, h("div", { class: "loading" }, "Cargando…"));

  const [participants, legacyFavorites] = await Promise.all([getParticipants(), getLegacyFavorites()]);

  const refresh = async (updatedProfile) => {
    const nextProfile = updatedProfile || viewerProfile;
    onUpdate?.(nextProfile);
    await renderEditProfile(container, nextProfile, onUpdate);
  };

  clearAndAppend(
    container,
    h("div", {}, [
      h("div", { class: "section-title" }, "Editar Perfil"),
      buildEditCard(viewerProfile, participants, legacyFavorites, refresh),
    ])
  );
}

async function renderProfileInternal(container, username) {
  clearAndAppend(container, h("div", { class: "loading" }, "Cargando…"));

  const target = await getProfileByUsername(username);
  if (!target) {
    clearAndAppend(container, h("div", { class: "empty-state" }, "No encontramos a ese jugador."));
    return;
  }

  const [participants, history, eliminations, leaderboard, legacyFavorites, nominationCounts, immunityCounts, savedCounts, votingWeek] =
    await Promise.all([
      getParticipants(),
      getMyPredictionHistory(target.id),
      getAllEliminationsWithWeeks(),
      getLeaderboard(),
      getLegacyFavorites(),
      getNominationCounts(),
      getImmunityCounts(),
      getSavedCounts(),
      getVotingWeek(),
    ]);
  const counts = { nomination: nominationCounts, immunity: immunityCounts, saved: savedCounts };
  const currentNominations = votingWeek ? await getNominationsForWeek(votingWeek.id) : [];
  const currentNominationMap = {};
  currentNominations.forEach((n) => (currentNominationMap[n.participant_id] = n));

  const eliminatedSet = new Set(eliminations.map((e) => `${e.week_id}:${e.participant_id}`));
  const rankIndex = leaderboard.findIndex((r) => r.player_id === target.id);
  const points = rankIndex >= 0 ? leaderboard[rankIndex].points : 0;
  const favorite = participants.find((p) => p.id === target.favorite_participant_id) || null;
  const hated = participants.find((p) => p.id === target.hated_participant_id) || null;
  const favT1 = legacyFavorites.find((f) => f.id === target.fav_season1_id) || null;
  const favT2 = legacyFavorites.find((f) => f.id === target.fav_season2_id) || null;
  const favT3 = legacyFavorites.find((f) => f.id === target.fav_season3_id) || null;
  const hatedT1 = legacyFavorites.find((f) => f.id === target.hated_season1_id) || null;
  const hatedT2 = legacyFavorites.find((f) => f.id === target.hated_season2_id) || null;
  const hatedT3 = legacyFavorites.find((f) => f.id === target.hated_season3_id) || null;
  const surprise = participants.find((p) => p.id === target.surprise_participant_id) || null;
  const disappointment = participants.find((p) => p.id === target.disappointment_participant_id) || null;
  const surpriseT1 = legacyFavorites.find((f) => f.id === target.surprise_season1_id) || null;
  const surpriseT2 = legacyFavorites.find((f) => f.id === target.surprise_season2_id) || null;
  const surpriseT3 = legacyFavorites.find((f) => f.id === target.surprise_season3_id) || null;
  const disappointmentT1 = legacyFavorites.find((f) => f.id === target.disappointment_season1_id) || null;
  const disappointmentT2 = legacyFavorites.find((f) => f.id === target.disappointment_season2_id) || null;
  const disappointmentT3 = legacyFavorites.find((f) => f.id === target.disappointment_season3_id) || null;
  const stats = computeStats(history, eliminatedSet);
  const badges = buildBadges(stats, favorite);
  const legacyRoomBadges = [target.legacy_room_t1, target.legacy_room_t2, target.legacy_room_t3]
    .map(legacyRoomBadgeNode)
    .filter(Boolean);

  // ---------- Encabezado ----------
  const headerCard = h(
    "div",
    { class: "card", style: "display:flex;flex-direction:column;align-items:center;text-align:center" },
    [
      avatarNode(target, 125),
      h("div", { style: "font-size:1.3rem;font-weight:700;margin-top:12px" }, target.display_name),
      h("div", { class: "muted" }, `@${target.username}`),
      target.bio ? h("div", { style: "margin-top:4px;font-style:italic" }, target.bio) : null,
      h("div", { style: "display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin-top:10px" }, [
        teamBadgeNode(target.favorite_room),
        ...legacyRoomBadges,
      ]),
      h("div", { class: "row-flex", style: "gap:18px;flex-wrap:wrap;justify-content:center;margin-top:16px" }, [
        statBlock(String(points), "puntos"),
        rankIndex >= 0 ? statBlock(`#${rankIndex + 1}`, `de ${leaderboard.length}`) : null,
        stats.accuracyPct !== null ? statBlock(`${stats.accuracyPct}%`, "acierto") : null,
      ]),
      badges.length
        ? h(
            "div",
            { style: "margin-top:12px;display:flex;flex-wrap:wrap;justify-content:center;gap:6px" },
            badges.map((b) => h("span", { class: "badge gold" }, [h("i", { class: `fa-solid ${b.icon}` }), " ", b.label]))
          )
        : null,
    ]
  );

  // ---------- Favorito / odiado ----------
  const favHatedCard = h("div", { class: "card" }, [
    h("p", { style: "margin-top:0;text-align:center" }, [h("i", { class: "fa-solid fa-calendar-days" }), " ", h("strong", {}, "Acerca de esta temporada")]),
    h("div", { class: "grid", style: "grid-template-columns:repeat(auto-fit, minmax(140px, 140px));justify-content:center" }, [
      participantPickCard("Favorito", favorite, "favorite", counts, favorite ? currentNominationMap[favorite.id] : null),
      participantPickCard("Odiado", hated, "hated", counts, hated ? currentNominationMap[hated.id] : null),
      participantPickCard("Sorpresa", surprise, "surprise", counts, surprise ? currentNominationMap[surprise.id] : null),
      participantPickCard("Decepción", disappointment, "disappointment", counts, disappointment ? currentNominationMap[disappointment.id] : null),
    ]),
  ]);

  const SEASON_DICE_ICONS = { 1: "fa-dice-one", 2: "fa-dice-two", 3: "fa-dice-three" };

  function legacySeasonCard(season, fav, hated, surprise, disappointment) {
    return h("div", { class: "card" }, [
      h("p", { style: "margin-top:0;text-align:center" }, [h("i", { class: `fa-solid ${SEASON_DICE_ICONS[season]}` }), " ", h("strong", {}, `Temporada ${season}`)]),
      h("div", { class: "grid", style: "grid-template-columns:repeat(auto-fit, minmax(140px, 140px));justify-content:center" }, [
        legacyPickCard("Favorito", fav, "favorite"),
        legacyPickCard("Odiado", hated, "hated"),
        legacyPickCard("Sorpresa", surprise, "surprise"),
        legacyPickCard("Decepción", disappointment, "disappointment"),
      ]),
    ]);
  }

  const legacySeason1Card = legacySeasonCard(1, favT1, hatedT1, surpriseT1, disappointmentT1);
  const legacySeason2Card = legacySeasonCard(2, favT2, hatedT2, surpriseT2, disappointmentT2);
  const legacySeason3Card = legacySeasonCard(3, favT3, hatedT3, surpriseT3, disappointmentT3);

  const cards = [
    headerCard,
    favHatedCard,
    legacySeason1Card,
    legacySeason2Card,
    legacySeason3Card,
    buildCompareCard(target, leaderboard),
  ];

  // ---------- Historial ----------
  const historyRows = sortHistory(history).map((row) => {
    const status = row.weeks.status;
    const key = `${row.week_id}:${row.participant_id}`;
    let resultBadge;
    if (status !== "closed") {
      resultBadge = h("span", { class: "badge gray" }, "Pendiente");
    } else if (eliminatedSet.has(key)) {
      resultBadge = h("span", { class: "badge green" }, "Acierto");
    } else {
      resultBadge = h("span", { class: "badge red" }, "Fallido");
    }
    return h("tr", {}, [
      h("td", {}, row.weeks.label || `Semana ${row.weeks.week_number}`),
      h("td", {}, row.participants?.name || "—"),
      h("td", {}, resultBadge),
    ]);
  });

  const historyCard = h("div", { class: "card table-wrap" }, [
    history.length === 0
      ? h("p", { class: "muted" }, "Todavía no hay picks para mostrar.")
      : h("table", { class: "data" }, [
          h("thead", {}, h("tr", {}, [h("th", {}, "Semana"), h("th", {}, "Pick"), h("th", {}, "Resultado")])),
          h("tbody", {}, historyRows),
        ]),
  ]);

  clearAndAppend(
    container,
    h("div", {}, [
      h("div", { class: "section-title" }, `Perfil de ${target.display_name}`),
      ...cards,
      h("div", { class: "section-title", style: "font-size:1.1rem;margin-top:24px" }, "Historial de picks"),
      historyCard,
    ])
  );
}

function statBlock(value, label) {
  return h("div", { style: "text-align:center" }, [
    h("div", { style: "font-size:1.4rem;font-weight:800;font-family:var(--font-display)" }, value),
    h("div", { class: "muted", style: "font-size:0.68rem;text-transform:uppercase" }, label),
  ]);
}

function buildCompareCard(target, leaderboard) {
  const others = leaderboard.filter((r) => r.player_id !== target.id);
  if (others.length === 0) return h("div", {});

  const select = h(
    "select",
    {},
    [h("option", { value: "" }, "Elige un jugador…")].concat(
      others.map((r) => h("option", { value: r.player_id }, r.display_name))
    )
  );
  const resultBox = h("div", { style: "margin-top:14px" });
  const errMsg = h("span", { class: "error-msg" });
  const compareBtn = h(
    "button",
    {
      class: "btn small",
      onclick: async () => {
        if (!select.value) return;
        compareBtn.disabled = true;
        errMsg.textContent = "";
        clearAndAppend(resultBox, h("div", { class: "loading" }, "Comparando…"));
        try {
          const other = others.find((r) => r.player_id === select.value);
          const [myHistory, theirHistory, eliminations] = await Promise.all([
            getMyPredictionHistory(target.id),
            getMyPredictionHistory(select.value),
            getAllEliminationsWithWeeks(),
          ]);
          const eliminatedSet = new Set(eliminations.map((e) => `${e.week_id}:${e.participant_id}`));
          renderCompareResult(resultBox, target, other, myHistory, theirHistory, eliminatedSet);
        } catch (e) {
          errMsg.textContent = "No se pudo comparar";
        } finally {
          compareBtn.disabled = false;
        }
      },
    },
    "Comparar"
  );

  return h("div", { class: "card" }, [
    h("p", { style: "margin-top:0" }, [h("i", { class: "fa-solid fa-people-arrows" }), " ", h("strong", {}, "Comparar con otro jugador")]),
    h("div", { class: "row-flex" }, [select, compareBtn, errMsg]),
    resultBox,
  ]);
}

function renderCompareResult(box, target, other, myHistory, theirHistory, eliminatedSet) {
  const byWeek = new Map();
  for (const row of myHistory) {
    byWeek.set(row.week_id, { week: row.weeks, mine: row });
  }
  for (const row of theirHistory) {
    const entry = byWeek.get(row.week_id) || { week: row.weeks, mine: null };
    entry.theirs = row;
    byWeek.set(row.week_id, entry);
  }

  const weeks = [...byWeek.values()]
    .filter((e) => e.week.status === "closed")
    .sort((a, b) => (b.week.week_number ?? 0) - (a.week.week_number ?? 0));

  if (weeks.length === 0) {
    clearAndAppend(box, h("p", { class: "muted" }, "Todavía no hay semanas cerradas para comparar."));
    return;
  }

  const rows = weeks.map((e) => {
    const mineHit = e.mine && eliminatedSet.has(`${e.mine.week_id}:${e.mine.participant_id}`);
    const theirsHit = e.theirs && eliminatedSet.has(`${e.theirs.week_id}:${e.theirs.participant_id}`);
    return h("tr", {}, [
      h("td", {}, e.week.label || `Semana ${e.week.week_number}`),
      h("td", {}, e.mine ? `${e.mine.participants?.name || "—"} ${mineHit ? "✅" : "❌"}` : "—"),
      h("td", {}, e.theirs ? `${e.theirs.participants?.name || "—"} ${theirsHit ? "✅" : "❌"}` : "—"),
    ]);
  });

  clearAndAppend(
    box,
    h("div", { class: "table-wrap" }, [
      h("table", { class: "data" }, [
        h("thead", {}, h("tr", {}, [h("th", {}, "Semana"), h("th", {}, target.display_name), h("th", {}, other.display_name)])),
        h("tbody", {}, rows),
      ]),
    ])
  );
}

function buildEditCard(profile, participants, legacyFavorites, refresh) {
  const errMsg = h("span", { class: "error-msg" });
  const successMsg = h("span", { class: "success-msg" });

  const nameInput = h("input", { type: "text", value: profile.display_name });
  const bioInput = h("textarea", { rows: "2", maxlength: "140", placeholder: "Una frase corta para tu perfil…" }, profile.bio || "");
  const avatarFile = h("input", { type: "file", accept: "image/*" });
  const removeAvatarCheckbox = h("input", { type: "checkbox" });

  function pickSelect(currentId, options) {
    return h(
      "select",
      {},
      [h("option", { value: "" }, "Sin elegir")].concat(
        options.map((p) => h("option", { value: p.id, selected: currentId === p.id ? "selected" : undefined }, p.name))
      )
    );
  }

  const favSelect = pickSelect(profile.favorite_participant_id, participants);
  const hatedSelect = pickSelect(profile.hated_participant_id, participants);
  const surpriseSelect = pickSelect(profile.surprise_participant_id, participants);
  const disappointmentSelect = pickSelect(profile.disappointment_participant_id, participants);

  const roomSelect = h(
    "select",
    {},
    [h("option", { value: "" }, "Sin elegir")].concat(
      ROOM_OPTIONS.map((r) => h("option", { value: r, selected: profile.favorite_room === r ? "selected" : undefined }, r))
    )
  );

  function legacySelect(season, currentId) {
    const options = legacyFavorites.filter((f) => f.season === season);
    return h(
      "select",
      {},
      [h("option", { value: "" }, "Sin elegir")].concat(
        options.map((f) => h("option", { value: f.id, selected: currentId === f.id ? "selected" : undefined }, f.name))
      )
    );
  }

  const t1Select = legacySelect(1, profile.fav_season1_id);
  const t2Select = legacySelect(2, profile.fav_season2_id);
  const t3Select = legacySelect(3, profile.fav_season3_id);

  const t1HatedSelect = legacySelect(1, profile.hated_season1_id);
  const t2HatedSelect = legacySelect(2, profile.hated_season2_id);
  const t3HatedSelect = legacySelect(3, profile.hated_season3_id);

  const t1SurpriseSelect = legacySelect(1, profile.surprise_season1_id);
  const t2SurpriseSelect = legacySelect(2, profile.surprise_season2_id);
  const t3SurpriseSelect = legacySelect(3, profile.surprise_season3_id);

  const t1DisappointmentSelect = legacySelect(1, profile.disappointment_season1_id);
  const t2DisappointmentSelect = legacySelect(2, profile.disappointment_season2_id);
  const t3DisappointmentSelect = legacySelect(3, profile.disappointment_season3_id);

  function legacyRoomSelect(season, currentValue) {
    const options = LEGACY_ROOM_OPTIONS[season];
    return h(
      "select",
      {},
      [h("option", { value: "" }, "Sin elegir")].concat(
        options.map((o) => h("option", { value: o, selected: currentValue === o ? "selected" : undefined }, o))
      )
    );
  }

  const t1RoomSelect = legacyRoomSelect(1, profile.legacy_room_t1);
  const t2RoomSelect = legacyRoomSelect(2, profile.legacy_room_t2);
  const t3RoomSelect = legacyRoomSelect(3, profile.legacy_room_t3);

  let selectedAccent = getAccentKey();
  const swatchWrap = h("div", { class: "swatches", style: "gap:12px" });
  Object.entries(ACCENTS).forEach(([key, theme]) => {
    const swatchBtn = h("button", {
      class: `swatch${selectedAccent === key ? " active" : ""}`,
      style: `background:${theme.accent};width:28px;height:28px`,
      title: theme.label,
      type: "button",
      onclick: () => {
        applyAccent(key);
        selectedAccent = key;
        [...swatchWrap.children].forEach((c) => c.classList.remove("active"));
        swatchBtn.classList.add("active");
      },
    });
    swatchWrap.appendChild(swatchBtn);
  });

  const saveBtn = h(
    "button",
    {
      class: "btn",
      onclick: async () => {
        errMsg.textContent = "";
        successMsg.textContent = "";
        const file = avatarFile.files[0];
        if (file && file.size > 3 * 1024 * 1024) {
          errMsg.textContent = "La foto pesa demasiado (máximo 3MB). Usa una más ligera.";
          return;
        }
        saveBtn.disabled = true;
        saveBtn.textContent = "Guardando…";
        try {
          let avatar_url;
          if (file) avatar_url = await uploadMyAvatar(profile.id, file);

          const updated = await updateMyProfile({
            display_name: nameInput.value.trim() || undefined,
            bio: bioInput.value.trim() || " ",
            avatar_url,
            clearAvatar: !file && removeAvatarCheckbox.checked,
            favorite_participant_id: favSelect.value ? Number(favSelect.value) : undefined,
            clearFavorite: !favSelect.value,
            hated_participant_id: hatedSelect.value ? Number(hatedSelect.value) : undefined,
            clearHated: !hatedSelect.value,
            surprise_participant_id: surpriseSelect.value ? Number(surpriseSelect.value) : undefined,
            clearSurprise: !surpriseSelect.value,
            disappointment_participant_id: disappointmentSelect.value ? Number(disappointmentSelect.value) : undefined,
            clearDisappointment: !disappointmentSelect.value,
            favorite_room: roomSelect.value || undefined,
            clearFavoriteRoom: !roomSelect.value,
            fav_season1_id: t1Select.value ? Number(t1Select.value) : undefined,
            clearFavSeason1: !t1Select.value,
            fav_season2_id: t2Select.value ? Number(t2Select.value) : undefined,
            clearFavSeason2: !t2Select.value,
            fav_season3_id: t3Select.value ? Number(t3Select.value) : undefined,
            clearFavSeason3: !t3Select.value,
            legacy_room_t1: t1RoomSelect.value || undefined,
            clearLegacyRoomT1: !t1RoomSelect.value,
            legacy_room_t2: t2RoomSelect.value || undefined,
            clearLegacyRoomT2: !t2RoomSelect.value,
            legacy_room_t3: t3RoomSelect.value || undefined,
            clearLegacyRoomT3: !t3RoomSelect.value,
            hated_season1_id: t1HatedSelect.value ? Number(t1HatedSelect.value) : undefined,
            clearHatedSeason1: !t1HatedSelect.value,
            hated_season2_id: t2HatedSelect.value ? Number(t2HatedSelect.value) : undefined,
            clearHatedSeason2: !t2HatedSelect.value,
            hated_season3_id: t3HatedSelect.value ? Number(t3HatedSelect.value) : undefined,
            clearHatedSeason3: !t3HatedSelect.value,
            surprise_season1_id: t1SurpriseSelect.value ? Number(t1SurpriseSelect.value) : undefined,
            clearSurpriseSeason1: !t1SurpriseSelect.value,
            surprise_season2_id: t2SurpriseSelect.value ? Number(t2SurpriseSelect.value) : undefined,
            clearSurpriseSeason2: !t2SurpriseSelect.value,
            surprise_season3_id: t3SurpriseSelect.value ? Number(t3SurpriseSelect.value) : undefined,
            clearSurpriseSeason3: !t3SurpriseSelect.value,
            disappointment_season1_id: t1DisappointmentSelect.value ? Number(t1DisappointmentSelect.value) : undefined,
            clearDisappointmentSeason1: !t1DisappointmentSelect.value,
            disappointment_season2_id: t2DisappointmentSelect.value ? Number(t2DisappointmentSelect.value) : undefined,
            clearDisappointmentSeason2: !t2DisappointmentSelect.value,
            disappointment_season3_id: t3DisappointmentSelect.value ? Number(t3DisappointmentSelect.value) : undefined,
            clearDisappointmentSeason3: !t3DisappointmentSelect.value,
            accent_color: selectedAccent,
          });
          successMsg.textContent = "¡Cambios guardados!";
          await refresh(updated);
        } catch (e) {
          errMsg.textContent = "No se pudieron guardar los cambios. Intenta de nuevo.";
          saveBtn.disabled = false;
          saveBtn.textContent = "Guardar cambios";
        }
      },
    },
    "Guardar cambios"
  );

  return h("div", { class: "card" }, [
    h("label", { style: "margin-top:0;display:block" }, "Foto de perfil"),
    h("div", { style: "margin-bottom:14px" }, [avatarFile]),
    profile.avatar_url
      ? h("label", { class: "row-flex", style: "gap:8px;align-items:center;font-weight:400;margin-bottom:14px" }, [
          removeAvatarCheckbox,
          "Borrar foto de perfil actual",
        ])
      : null,
    h("label", {}, "Nombre para mostrar"),
    h("div", { style: "margin-bottom:14px" }, [nameInput]),
    h("label", {}, "Frase de perfil"),
    h("div", { style: "margin-bottom:14px" }, [bioInput]),
    h("label", {}, "Mi favorito"),
    h("div", { style: "margin-bottom:14px" }, [favSelect]),
    h("label", {}, "Odiado"),
    h("div", { style: "margin-bottom:14px" }, [hatedSelect]),
    h("label", {}, "Sorpresa"),
    h("div", { style: "margin-bottom:14px" }, [surpriseSelect]),
    h("label", {}, "Decepción"),
    h("div", { style: "margin-bottom:14px" }, [disappointmentSelect]),
    h("label", {}, "Cuarto favorito"),
    h("div", { style: "margin-bottom:14px" }, [roomSelect]),
    h("label", {}, "Favorito de Temporada 1"),
    h("div", { style: "margin-bottom:14px" }, [t1Select]),
    h("label", {}, "Odiado de Temporada 1"),
    h("div", { style: "margin-bottom:14px" }, [t1HatedSelect]),
    h("label", {}, "Sorpresa de Temporada 1"),
    h("div", { style: "margin-bottom:14px" }, [t1SurpriseSelect]),
    h("label", {}, "Decepción de Temporada 1"),
    h("div", { style: "margin-bottom:14px" }, [t1DisappointmentSelect]),
    h("label", {}, "Team de Temporada 1"),
    h("div", { style: "margin-bottom:14px" }, [t1RoomSelect]),
    h("label", {}, "Favorito de Temporada 2"),
    h("div", { style: "margin-bottom:14px" }, [t2Select]),
    h("label", {}, "Odiado de Temporada 2"),
    h("div", { style: "margin-bottom:14px" }, [t2HatedSelect]),
    h("label", {}, "Sorpresa de Temporada 2"),
    h("div", { style: "margin-bottom:14px" }, [t2SurpriseSelect]),
    h("label", {}, "Decepción de Temporada 2"),
    h("div", { style: "margin-bottom:14px" }, [t2DisappointmentSelect]),
    h("label", {}, "Team de Temporada 2"),
    h("div", { style: "margin-bottom:14px" }, [t2RoomSelect]),
    h("label", {}, "Favorito de Temporada 3"),
    h("div", { style: "margin-bottom:14px" }, [t3Select]),
    h("label", {}, "Odiado de Temporada 3"),
    h("div", { style: "margin-bottom:14px" }, [t3HatedSelect]),
    h("label", {}, "Sorpresa de Temporada 3"),
    h("div", { style: "margin-bottom:14px" }, [t3SurpriseSelect]),
    h("label", {}, "Decepción de Temporada 3"),
    h("div", { style: "margin-bottom:14px" }, [t3DisappointmentSelect]),
    h("label", {}, "Team de Temporada 3"),
    h("div", { style: "margin-bottom:14px" }, [t3RoomSelect]),
    h("label", {}, "Color de tema"),
    h("div", { style: "margin-bottom:18px" }, [swatchWrap]),
    saveBtn,
    successMsg,
    errMsg,
  ]);
}
