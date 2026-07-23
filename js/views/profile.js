import { getParticipants, getMyPredictionHistory, getAllEliminationsWithWeeks, updateMyProfile } from "../data.js";
import { ACCENTS, getAccentKey, applyAccent } from "../theme.js";
import { h, esc, initials, clearAndAppend } from "../utils.js";

function photoOrInitials(p) {
  if (!p) return h("div", { class: "avatar-sm" }, "?");
  if (p.photo_url) return h("div", { class: "avatar-sm", style: `background-image:url('${esc(p.photo_url)}')` });
  return h("div", { class: "avatar-sm" }, initials(p.name));
}

export async function renderProfile(container, profile, onUpdate) {
  clearAndAppend(container, h("div", { class: "loading" }, "Cargando…"));

  const [participants, history, eliminations] = await Promise.all([
    getParticipants(),
    getMyPredictionHistory(profile.id),
    getAllEliminationsWithWeeks(),
  ]);

  const eliminatedSet = new Set(eliminations.map((e) => `${e.week_id}:${e.participant_id}`));
  const favorite = participants.find((p) => p.id === profile.favorite_participant_id) || null;

  // ---------- Nombre ----------
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
          const updated = await updateMyProfile({ display_name: nameInput.value.trim() });
          nameMsg.textContent = "Guardado";
          onUpdate?.(updated);
        } catch (e) {
          nameMsg.textContent = "Error al guardar";
        } finally {
          nameBtn.disabled = false;
        }
      },
    },
    "Guardar nombre"
  );

  const nameCard = h("div", { class: "card" }, [
    h("p", { style: "margin-top:0" }, [h("strong", {}, "Usuario: "), `@${profile.username}`]),
    h("label", {}, "Nombre para mostrar"),
    h("div", { class: "row-flex" }, [nameInput, nameBtn, nameMsg]),
  ]);

  // ---------- Favorito ----------
  const favSelect = h(
    "select",
    {},
    [h("option", { value: "" }, "Sin favorito")].concat(
      participants.map((p) => h("option", { value: p.id, selected: profile.favorite_participant_id === p.id ? "selected" : undefined }, p.name))
    )
  );
  const favMsg = h("span", { class: "success-msg" });
  const favPreview = h("div", { class: "row-flex", style: "margin-top:10px" }, favorite ? [photoOrInitials(favorite), h("span", {}, favorite.name)] : [h("span", { class: "muted" }, "Aún no eliges favorito")]);
  const favBtn = h(
    "button",
    {
      class: "btn small",
      onclick: async () => {
        favBtn.disabled = true;
        try {
          const value = favSelect.value;
          const updated = await updateMyProfile(
            value ? { favorite_participant_id: Number(value) } : { clearFavorite: true }
          );
          favMsg.textContent = "Guardado";
          onUpdate?.(updated);
          const newFav = participants.find((p) => p.id === updated.favorite_participant_id);
          clearAndAppend(favPreview, h("div", { class: "row-flex" }, newFav ? [photoOrInitials(newFav), h("span", {}, newFav.name)] : [h("span", { class: "muted" }, "Sin favorito")]));
        } catch (e) {
          favMsg.textContent = "Error al guardar";
        } finally {
          favBtn.disabled = false;
        }
      },
    },
    "Guardar favorito"
  );

  const favCard = h("div", { class: "card" }, [
    h("p", { style: "margin-top:0", class: "muted" }, "Tu participante favorito de la casa"),
    h("div", { class: "row-flex" }, [favSelect, favBtn, favMsg]),
    favPreview,
  ]);

  // ---------- Color de énfasis ----------
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
            const updated = await updateMyProfile({ accent_color: key });
            onUpdate?.(updated);
          } catch (e) {
            /* el color ya se aplicó localmente aunque falle guardarlo */
          }
        },
      })
    );
  });

  const accentCard = h("div", { class: "card" }, [
    h("p", { style: "margin-top:0", class: "muted" }, "Color de énfasis"),
    swatchWrap,
  ]);

  // ---------- Historial ----------
  const historyRows = history.map((h_) => {
    const status = h_.weeks.status;
    const key = `${h_.week_id}:${h_.participant_id}`;
    let resultBadge;
    if (status !== "closed") {
      resultBadge = h("span", { class: "badge gray" }, "Pendiente");
    } else if (eliminatedSet.has(key)) {
      resultBadge = h("span", { class: "badge green" }, "Acertaste");
    } else {
      resultBadge = h("span", { class: "badge red" }, "Fallaste");
    }
    return h("tr", {}, [
      h("td", {}, h_.weeks.label || `Semana ${h_.weeks.week_number}`),
      h("td", {}, h_.participants?.name || "—"),
      h("td", {}, resultBadge),
    ]);
  });

  const historyCard = h("div", { class: "card table-wrap" }, [
    history.length === 0
      ? h("p", { class: "muted" }, "Todavía no has votado en ninguna semana.")
      : h("table", { class: "data" }, [
          h("thead", {}, h("tr", {}, [h("th", {}, "Semana"), h("th", {}, "Tu pick"), h("th", {}, "Resultado")])),
          h("tbody", {}, historyRows),
        ]),
  ]);

  clearAndAppend(
    container,
    h("div", {}, [
      h("div", { class: "section-title" }, "Mi Perfil"),
      nameCard,
      favCard,
      accentCard,
      h("div", { class: "section-title", style: "font-size:1.1rem;margin-top:24px" }, "Mi historial de picks"),
      historyCard,
    ])
  );
}
