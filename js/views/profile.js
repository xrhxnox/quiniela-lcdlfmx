import {
  getParticipants,
  getMyPredictionHistory,
  getAllEliminationsWithWeeks,
  updateMyProfile,
  uploadMyAvatar,
  getProfileByUsername,
  getLeaderboard,
  getLegacyFavorites,
} from "../data.js";
import { ACCENTS, getAccentKey, applyAccent } from "../theme.js";
import { ROOM_OPTIONS } from "../rooms.js";
import { h, esc, initials, clearAndAppend } from "../utils.js";

function participantPickCard(label, participant, iconClass) {
  if (!participant) {
    return h("div", { class: "nominee-card", style: "cursor:default" }, [
      h("div", { class: "photo" }, h("i", { class: `fa-solid ${iconClass}` })),
      h("div", { class: "info" }, [
        h("div", { class: "muted", style: "font-size:0.7rem;text-transform:uppercase;letter-spacing:0.04em" }, label),
        h("div", { class: "name" }, "Sin definir"),
      ]),
    ]);
  }
  const photo = participant.photo_url
    ? h("div", { class: "photo", style: `background-image:url('${esc(participant.photo_url)}')` })
    : h("div", { class: "photo" }, initials(participant.name));
  return h("div", { class: "nominee-card", style: "cursor:default" }, [
    photo,
    h("div", { class: "info" }, [
      h("div", { class: "muted", style: "font-size:0.7rem;text-transform:uppercase;letter-spacing:0.04em" }, label),
      h("div", { class: "name" }, participant.name),
      participant.room ? h("div", { class: "room" }, participant.room) : null,
      h("div", { style: "margin-top:6px" }, [
        participant.active
          ? h("span", { class: "badge green" }, "En la casa")
          : h("span", { class: "badge red" }, "Eliminado/a"),
      ]),
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

function legacyPickCard(label, fav) {
  if (!fav) {
    return h("div", { class: "nominee-card", style: "cursor:default" }, [
      h("div", { class: "photo" }, h("i", { class: "fa-solid fa-clock-rotate-left" })),
      h("div", { class: "info" }, [
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

export async function renderProfile(container, viewerProfile, onUpdate) {
  await renderProfileInternal(container, viewerProfile.username, viewerProfile, true, onUpdate);
}

export async function renderPublicProfile(container, username, viewerProfile) {
  await renderProfileInternal(container, username, viewerProfile, false, null);
}

async function renderProfileInternal(container, username, targetHint, editable, onUpdate) {
  clearAndAppend(container, h("div", { class: "loading" }, "Cargando…"));

  const target = editable ? targetHint : await getProfileByUsername(username);
  if (!target) {
    clearAndAppend(container, h("div", { class: "empty-state" }, "No encontramos a ese jugador."));
    return;
  }

  const [participants, history, eliminations, leaderboard, legacyFavorites] = await Promise.all([
    getParticipants(),
    getMyPredictionHistory(target.id),
    getAllEliminationsWithWeeks(),
    getLeaderboard(),
    getLegacyFavorites(),
  ]);

  const refresh = async (updatedProfile) => {
    const nextTarget = updatedProfile || target;
    onUpdate?.(nextTarget);
    await renderProfileInternal(container, nextTarget.username, nextTarget, editable, onUpdate);
  };

  const eliminatedSet = new Set(eliminations.map((e) => `${e.week_id}:${e.participant_id}`));
  const rankIndex = leaderboard.findIndex((r) => r.player_id === target.id);
  const points = rankIndex >= 0 ? leaderboard[rankIndex].points : 0;
  const favorite = participants.find((p) => p.id === target.favorite_participant_id) || null;
  const hated = participants.find((p) => p.id === target.hated_participant_id) || null;
  const favT1 = legacyFavorites.find((f) => f.id === target.fav_season1_id) || null;
  const favT2 = legacyFavorites.find((f) => f.id === target.fav_season2_id) || null;
  const favT3 = legacyFavorites.find((f) => f.id === target.fav_season3_id) || null;
  const stats = computeStats(history, eliminatedSet);
  const badges = buildBadges(stats, favorite);

  // ---------- Encabezado ----------
  const headerCard = h("div", { class: "card" }, [
    h("div", { class: "row-flex", style: "gap:14px;align-items:center;flex-wrap:wrap" }, [
      avatarNode(target, 125),
      h("div", {}, [
        h("div", { style: "font-size:1.3rem;font-weight:700" }, target.display_name),
        h("div", { class: "muted" }, `@${target.username}`),
        target.bio ? h("div", { style: "margin-top:4px;font-style:italic" }, target.bio) : null,
        teamBadgeNode(target.favorite_room),
      ]),
    ]),
    h("div", { class: "row-flex", style: "gap:18px;flex-wrap:wrap;margin-top:16px" }, [
      statBlock(String(points), "puntos"),
      rankIndex >= 0 ? statBlock(`#${rankIndex + 1}`, `de ${leaderboard.length}`) : null,
      stats.accuracyPct !== null ? statBlock(`${stats.accuracyPct}%`, "acierto") : null,
    ]),
    badges.length
      ? h(
          "div",
          { style: "margin-top:10px;display:flex;flex-wrap:wrap;gap:6px" },
          badges.map((b) => h("span", { class: "badge gold" }, [h("i", { class: `fa-solid ${b.icon}` }), " ", b.label]))
        )
      : null,
  ]);

  // ---------- Favorito / odiado ----------
  const favHatedCard = h("div", { class: "card" }, [
    h("div", { class: "grid", style: "grid-template-columns:repeat(auto-fill, minmax(140px, 1fr));max-width:380px" }, [
      participantPickCard("Favorito", favorite, "fa-heart"),
      participantPickCard("Odiado", hated, "fa-face-angry"),
    ]),
  ]);

  const legacyCard = h("div", { class: "card" }, [
    h("p", { style: "margin-top:0" }, [h("i", { class: "fa-solid fa-clock-rotate-left" }), " ", h("strong", {}, "Favoritos de temporadas anteriores")]),
    h("div", { class: "grid", style: "grid-template-columns:repeat(auto-fill, minmax(120px, 1fr))" }, [
      legacyPickCard("Temporada 1", favT1),
      legacyPickCard("Temporada 2", favT2),
      legacyPickCard("Temporada 3", favT3),
    ]),
  ]);

  const cards = [headerCard, favHatedCard, legacyCard];
  if (editable) cards.push(buildEditCard(target, participants, legacyFavorites, refresh));
  cards.push(buildCompareCard(target, leaderboard));

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
      h("div", { class: "section-title" }, editable ? "Mi Perfil" : `Perfil de ${target.display_name}`),
      ...cards,
      h("div", { class: "section-title", style: "font-size:1.1rem;margin-top:24px" }, editable ? "Mi historial de picks" : "Historial de picks"),
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
  const nameInput = h("input", { type: "text", value: profile.display_name });
  const errMsg = h("span", { class: "error-msg" });
  const nameBtn = h(
    "button",
    {
      class: "btn small",
      onclick: async () => {
        if (!nameInput.value.trim()) return;
        nameBtn.disabled = true;
        try {
          const updated = await updateMyProfile({ display_name: nameInput.value.trim() });
          await refresh(updated);
        } catch (e) {
          errMsg.textContent = "Error al guardar";
          nameBtn.disabled = false;
        }
      },
    },
    "Guardar"
  );

  const bioInput = h("textarea", { rows: "2", maxlength: "140", placeholder: "Una frase corta para tu perfil…" }, profile.bio || "");
  const bioBtn = h(
    "button",
    {
      class: "btn small",
      onclick: async () => {
        bioBtn.disabled = true;
        try {
          const updated = await updateMyProfile({ bio: bioInput.value.trim() || " " });
          await refresh(updated);
        } catch (e) {
          errMsg.textContent = "Error al guardar";
          bioBtn.disabled = false;
        }
      },
    },
    "Guardar"
  );

  const avatarFile = h("input", { type: "file", accept: "image/*" });
  const avatarBtn = h(
    "button",
    {
      class: "btn small",
      onclick: async () => {
        const file = avatarFile.files[0];
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) {
          errMsg.textContent = "La foto pesa demasiado (máximo 3MB). Usa una más ligera.";
          return;
        }
        avatarBtn.disabled = true;
        avatarBtn.textContent = "Subiendo…";
        try {
          const url = await uploadMyAvatar(profile.id, file);
          const updated = await updateMyProfile({ avatar_url: url });
          await refresh(updated);
        } catch (e) {
          errMsg.textContent = "No se pudo subir la foto";
          avatarBtn.disabled = false;
          avatarBtn.textContent = "Subir foto";
        }
      },
    },
    "Subir foto"
  );

  function pickSelect(currentId) {
    return h(
      "select",
      {},
      [h("option", { value: "" }, "Sin elegir")].concat(
        participants.map((p) => h("option", { value: p.id, selected: currentId === p.id ? "selected" : undefined }, p.name))
      )
    );
  }

  const favSelect = pickSelect(profile.favorite_participant_id);
  const favBtn = h(
    "button",
    {
      class: "btn small",
      onclick: async () => {
        favBtn.disabled = true;
        try {
          const value = favSelect.value;
          const updated = await updateMyProfile(value ? { favorite_participant_id: Number(value) } : { clearFavorite: true });
          await refresh(updated);
        } catch (e) {
          errMsg.textContent = "Error al guardar";
          favBtn.disabled = false;
        }
      },
    },
    "Guardar"
  );

  const hatedSelect = pickSelect(profile.hated_participant_id);
  const hatedBtn = h(
    "button",
    {
      class: "btn small",
      onclick: async () => {
        hatedBtn.disabled = true;
        try {
          const value = hatedSelect.value;
          const updated = await updateMyProfile(value ? { hated_participant_id: Number(value) } : { clearHated: true });
          await refresh(updated);
        } catch (e) {
          errMsg.textContent = "Error al guardar";
          hatedBtn.disabled = false;
        }
      },
    },
    "Guardar"
  );

  const roomSelect = h(
    "select",
    {},
    [h("option", { value: "" }, "Sin elegir")].concat(
      ROOM_OPTIONS.map((r) => h("option", { value: r, selected: profile.favorite_room === r ? "selected" : undefined }, r))
    )
  );
  const roomBtn = h(
    "button",
    {
      class: "btn small",
      onclick: async () => {
        roomBtn.disabled = true;
        try {
          const updated = await updateMyProfile({ favorite_room: roomSelect.value || null });
          await refresh(updated);
        } catch (e) {
          errMsg.textContent = "Error al guardar";
          roomBtn.disabled = false;
        }
      },
    },
    "Guardar"
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

  function legacySaveField({ season, currentId, valueKey, clearKey }) {
    const select = legacySelect(season, currentId);
    const btn = h(
      "button",
      {
        class: "btn small",
        onclick: async () => {
          btn.disabled = true;
          try {
            const value = select.value;
            const updated = await updateMyProfile(value ? { [valueKey]: Number(value) } : { [clearKey]: true });
            await refresh(updated);
          } catch (e) {
            errMsg.textContent = "Error al guardar";
            btn.disabled = false;
          }
        },
      },
      "Guardar"
    );
    return h("div", { class: "row-flex", style: "margin-bottom:14px" }, [select, btn]);
  }

  const t1Field = legacySaveField({ season: 1, currentId: profile.fav_season1_id, valueKey: "fav_season1_id", clearKey: "clearFavSeason1" });
  const t2Field = legacySaveField({ season: 2, currentId: profile.fav_season2_id, valueKey: "fav_season2_id", clearKey: "clearFavSeason2" });
  const t3Field = legacySaveField({ season: 3, currentId: profile.fav_season3_id, valueKey: "fav_season3_id", clearKey: "clearFavSeason3" });

  const swatchWrap = h("div", { class: "swatches", style: "gap:12px" });
  Object.entries(ACCENTS).forEach(([key, theme]) => {
    swatchWrap.appendChild(
      h("button", {
        class: `swatch${getAccentKey() === key ? " active" : ""}`,
        style: `background:${theme.accent};width:28px;height:28px`,
        title: theme.label,
        type: "button",
        onclick: async () => {
          applyAccent(key);
          try {
            const updated = await updateMyProfile({ accent_color: key });
            await refresh(updated);
          } catch (e) {
            errMsg.textContent = "El color se aplicó pero no se pudo guardar en tu cuenta";
          }
        },
      })
    );
  });

  return h("div", { class: "card" }, [
    h("p", { style: "margin-top:0" }, h("strong", {}, "Editar mi perfil")),
    h("label", {}, "Foto de perfil"),
    h("div", { class: "row-flex", style: "margin-bottom:14px" }, [avatarFile, avatarBtn]),
    h("label", {}, "Nombre para mostrar"),
    h("div", { class: "row-flex", style: "margin-bottom:14px" }, [nameInput, nameBtn]),
    h("label", {}, "Frase de perfil"),
    h("div", { class: "row-flex", style: "margin-bottom:14px" }, [bioInput, bioBtn]),
    h("label", {}, "Mi favorito"),
    h("div", { class: "row-flex", style: "margin-bottom:14px" }, [favSelect, favBtn]),
    h("label", {}, "El que me cae mal"),
    h("div", { class: "row-flex", style: "margin-bottom:14px" }, [hatedSelect, hatedBtn]),
    h("label", {}, "Cuarto favorito"),
    h("div", { class: "row-flex", style: "margin-bottom:14px" }, [roomSelect, roomBtn]),
    h("label", {}, "Favorito de Temporada 1"),
    t1Field,
    h("label", {}, "Favorito de Temporada 2"),
    t2Field,
    h("label", {}, "Favorito de Temporada 3"),
    t3Field,
    h("label", {}, "Color de tema"),
    swatchWrap,
    errMsg,
  ]);
}
