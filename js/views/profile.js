import {
  getParticipants,
  getMyPredictionHistory,
  getAllEliminationsWithWeeks,
  updateMyProfile,
  getProfileByUsername,
  getLeaderboard,
} from "../data.js";
import { ACCENTS, getAccentKey, applyAccent } from "../theme.js";
import { ROOM_OPTIONS } from "../rooms.js";
import { h, esc, initials, clearAndAppend } from "../utils.js";

function photoOrInitials(p) {
  if (!p) return h("div", { class: "avatar-sm" }, "?");
  if (p.photo_url) return h("div", { class: "avatar-sm", style: `background-image:url('${esc(p.photo_url)}')` });
  return h("div", { class: "avatar-sm" }, initials(p.name));
}

function bigPhotoOrInitials(p) {
  if (!p) return null;
  if (p.photo_url) return h("div", { class: "photo", style: `background-image:url('${esc(p.photo_url)}');width:90px;height:90px;border-radius:12px` });
  return h("div", { class: "photo", style: "width:90px;height:90px;border-radius:12px;font-size:1.4rem" }, initials(p.name));
}

function participantPickCard(label, participant, iconClass) {
  return h("div", { class: "row-flex", style: "gap:14px;align-items:center" }, [
    bigPhotoOrInitials(participant) || h("div", { class: "photo", style: "width:90px;height:90px;border-radius:12px;font-size:1.2rem" }, h("i", { class: `fa-solid ${iconClass}` })),
    h("div", {}, [
      h("div", { class: "muted", style: "font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em" }, label),
      h("div", { style: "font-weight:700;font-size:1.05rem" }, participant ? participant.name : "Sin definir"),
    ]),
  ]);
}

export async function renderProfile(container, viewerProfile) {
  await renderProfileInternal(container, viewerProfile.username, viewerProfile, true);
}

export async function renderPublicProfile(container, username, viewerProfile) {
  await renderProfileInternal(container, username, viewerProfile, false);
}

async function renderProfileInternal(container, username, viewerProfile, editable) {
  clearAndAppend(container, h("div", { class: "loading" }, "Cargando…"));

  const target = editable ? viewerProfile : await getProfileByUsername(username);
  if (!target) {
    clearAndAppend(container, h("div", { class: "empty-state" }, "No encontramos a ese jugador."));
    return;
  }

  const [participants, history, eliminations, leaderboard] = await Promise.all([
    getParticipants(),
    getMyPredictionHistory(target.id),
    getAllEliminationsWithWeeks(),
    getLeaderboard(),
  ]);

  const eliminatedSet = new Set(eliminations.map((e) => `${e.week_id}:${e.participant_id}`));
  const points = leaderboard.find((r) => r.player_id === target.id)?.points ?? 0;
  const favorite = participants.find((p) => p.id === target.favorite_participant_id) || null;
  const hated = participants.find((p) => p.id === target.hated_participant_id) || null;
  const accentTheme = ACCENTS[target.accent_color] || ACCENTS.rojo;

  // ---------- Encabezado ----------
  const headerCard = h("div", { class: "card" }, [
    h("div", { class: "row-flex", style: "justify-content:space-between;flex-wrap:wrap;gap:10px" }, [
      h("div", {}, [
        h("div", { class: "row-flex" }, [
          h("span", { style: `display:inline-block;width:14px;height:14px;border-radius:50%;background:${accentTheme.accent}` }),
          h("span", { style: "font-size:1.3rem;font-weight:700" }, target.display_name),
        ]),
        h("div", { class: "muted" }, `@${target.username}`),
      ]),
      h("div", { style: "text-align:center" }, [
        h("div", { style: "font-size:1.6rem;font-weight:800;font-family:var(--font-display)" }, String(points)),
        h("div", { class: "muted", style: "font-size:0.7rem;text-transform:uppercase" }, "puntos"),
      ]),
    ]),
    target.favorite_room
      ? h("p", { style: "margin-bottom:0" }, [h("i", { class: "fa-solid fa-house" }), ` Cuarto favorito: `, h("strong", {}, target.favorite_room)])
      : null,
  ]);

  // ---------- Favorito / odiado ----------
  const favHatedCard = h("div", { class: "card" }, [
    h("div", { class: "field-row" }, [
      h("div", {}, participantPickCard("Favorito", favorite, "fa-heart")),
      h("div", {}, participantPickCard("Le cae mal", hated, "fa-face-angry")),
    ]),
  ]);

  const cards = [headerCard, favHatedCard];

  if (editable) {
    cards.push(buildEditCard(target, participants));
  }

  // ---------- Historial ----------
  const historyRows = history.map((row) => {
    const status = row.weeks.status;
    const key = `${row.week_id}:${row.participant_id}`;
    let resultBadge;
    if (status !== "closed") {
      resultBadge = h("span", { class: "badge gray" }, "Pendiente");
    } else if (eliminatedSet.has(key)) {
      resultBadge = h("span", { class: "badge green" }, "Acertó");
    } else {
      resultBadge = h("span", { class: "badge red" }, "Falló");
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

function buildEditCard(profile, participants) {
  const nameInput = h("input", { type: "text", value: profile.display_name });
  const nameMsg = h("span", { class: "success-msg" });
  const nameBtn = h(
    "button",
    {
      class: "btn small",
      onclick: async () => {
        if (!nameInput.value.trim()) return;
        nameBtn.disabled = true;
        try {
          await updateMyProfile({ display_name: nameInput.value.trim() });
          nameMsg.textContent = "Guardado. Recarga la página para verlo reflejado arriba.";
        } catch (e) {
          nameMsg.textContent = "Error al guardar";
        } finally {
          nameBtn.disabled = false;
        }
      },
    },
    "Guardar nombre"
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
  const favMsg = h("span", { class: "success-msg" });
  const favBtn = h(
    "button",
    {
      class: "btn small",
      onclick: async () => {
        favBtn.disabled = true;
        try {
          const value = favSelect.value;
          await updateMyProfile(value ? { favorite_participant_id: Number(value) } : { clearFavorite: true });
          favMsg.textContent = "Guardado. Recarga la página para verlo reflejado arriba.";
        } catch (e) {
          favMsg.textContent = "Error al guardar";
        } finally {
          favBtn.disabled = false;
        }
      },
    },
    "Guardar"
  );

  const hatedSelect = pickSelect(profile.hated_participant_id);
  const hatedMsg = h("span", { class: "success-msg" });
  const hatedBtn = h(
    "button",
    {
      class: "btn small",
      onclick: async () => {
        hatedBtn.disabled = true;
        try {
          const value = hatedSelect.value;
          await updateMyProfile(value ? { hated_participant_id: Number(value) } : { clearHated: true });
          hatedMsg.textContent = "Guardado. Recarga la página para verlo reflejado arriba.";
        } catch (e) {
          hatedMsg.textContent = "Error al guardar";
        } finally {
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
  const roomMsg = h("span", { class: "success-msg" });
  const roomBtn = h(
    "button",
    {
      class: "btn small",
      onclick: async () => {
        roomBtn.disabled = true;
        try {
          await updateMyProfile({ favorite_room: roomSelect.value || null });
          roomMsg.textContent = "Guardado. Recarga la página para verlo reflejado arriba.";
        } catch (e) {
          roomMsg.textContent = "Error al guardar";
        } finally {
          roomBtn.disabled = false;
        }
      },
    },
    "Guardar"
  );

  const swatchWrap = h("div", { class: "swatches", style: "gap:12px" });
  Object.entries(ACCENTS).forEach(([key, theme]) => {
    swatchWrap.appendChild(
      h("button", {
        class: `swatch${getAccentKey() === key ? " active" : ""}`,
        style: `background:${theme.accent};width:28px;height:28px`,
        title: theme.label,
        type: "button",
        onclick: async (ev) => {
          applyAccent(key);
          [...swatchWrap.children].forEach((c) => c.classList.remove("active"));
          ev.currentTarget.classList.add("active");
          try {
            await updateMyProfile({ accent_color: key });
          } catch (e) {
            /* el color ya se aplicó localmente aunque falle guardarlo */
          }
        },
      })
    );
  });

  return h("div", { class: "card" }, [
    h("p", { style: "margin-top:0" }, h("strong", {}, "Editar mi perfil")),
    h("label", {}, "Nombre para mostrar"),
    h("div", { class: "row-flex", style: "margin-bottom:14px" }, [nameInput, nameBtn, nameMsg]),
    h("label", {}, "Mi favorito"),
    h("div", { class: "row-flex", style: "margin-bottom:14px" }, [favSelect, favBtn, favMsg]),
    h("label", {}, "El que me cae mal"),
    h("div", { class: "row-flex", style: "margin-bottom:14px" }, [hatedSelect, hatedBtn, hatedMsg]),
    h("label", {}, "Cuarto favorito"),
    h("div", { class: "row-flex", style: "margin-bottom:14px" }, [roomSelect, roomBtn, roomMsg]),
    h("label", {}, "Color de énfasis"),
    swatchWrap,
  ]);
}
