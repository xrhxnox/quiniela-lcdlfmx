import {
  getParticipants,
  createParticipant,
  updateParticipant,
  deleteParticipant,
  uploadParticipantPhoto,
  getWeeks,
  createWeek,
  updateWeek,
  deleteWeek,
  getNominationsForWeek,
  setNomination,
  setNominationSaved,
  removeNomination,
  getImmunitiesForWeek,
  addImmunity,
  removeImmunity,
  confirmEliminations,
  getAllProfiles,
  setProfileRole,
  updateProfileDisplayName,
  getLegacyFavorites,
  createLegacyFavorite,
  updateLegacyFavorite,
  deleteLegacyFavorite,
  getSecretAssignments,
  assignSecretHabitantesRandomly,
  reassignSecretHabitante,
  markParticipantAsWinner,
} from "../data.js";
import { h, esc, initials, clearAndAppend } from "../utils.js";
import { ROOM_OPTIONS } from "../rooms.js";

const STATUS_LABEL = { draft: "Borrador", voting_open: "Votación abierta", closed: "Cerrada" };
const STATUS_BADGE = { draft: "gray", voting_open: "green", closed: "red" };

function toLocalTimeInputValue(isoString) {
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function roomSelect(currentValue) {
  const options = [...ROOM_OPTIONS];
  if (currentValue && !options.includes(currentValue)) options.push(currentValue);
  return h(
    "select",
    { style: "max-width:140px" },
    [h("option", { value: "" }, "Elige...")].concat(
      options.map((r) => h("option", { value: r, selected: currentValue === r ? "selected" : undefined }, r))
    )
  );
}

// ============================================================
// PARTICIPANTES
// ============================================================
async function renderParticipantsAdmin(sub) {
  clearAndAppend(sub, h("div", { class: "loading" }, "Cargando…"));
  const participants = await getParticipants();

  const nameInput = h("input", { type: "text", placeholder: "Nombre" });
  const roomInput = roomSelect("");
  const fileInput = h("input", { type: "file", accept: "image/*" });
  const addErr = h("div", { class: "error-msg" });
  const addBtn = h(
    "button",
    {
      class: "btn small",
      onclick: async () => {
        if (!nameInput.value.trim()) {
          addErr.textContent = "El nombre es obligatorio.";
          return;
        }
        addBtn.disabled = true;
        addBtn.textContent = "Guardando…";
        try {
          let photo_url = null;
          if (fileInput.files[0]) photo_url = await uploadParticipantPhoto(fileInput.files[0]);
          await createParticipant({ name: nameInput.value.trim(), room: roomInput.value || null, photo_url });
          await renderParticipantsAdmin(sub);
        } catch (e) {
          addErr.textContent = "No se pudo guardar. " + (e.message || "");
        } finally {
          addBtn.disabled = false;
          addBtn.textContent = "Agregar habitante";
        }
      },
    },
    "Agregar habitante"
  );

  const addForm = h("div", { class: "card" }, [
    h("div", { class: "field-row" }, [
      h("div", {}, [h("label", {}, "Nombre"), nameInput]),
      h("div", {}, [h("label", {}, "Cuarto"), roomInput]),
      h("div", {}, [h("label", {}, "Foto"), fileInput]),
    ]),
    addBtn,
    addErr,
  ]);

  const items = participants.map((p) => {
    const nameField = h("input", { type: "text", value: p.name, style: "max-width:160px" });
    const roomField = roomSelect(p.room);
    const photoField = h("input", { type: "file", accept: "image/*", style: "max-width:160px" });
    const itemErr = h("div", { class: "error-msg" });
    const saveBtn = h(
      "button",
      {
        class: "btn small secondary",
        onclick: async () => {
          itemErr.textContent = "";
          saveBtn.disabled = true;
          saveBtn.textContent = "Guardando…";
          try {
            const fields = { name: nameField.value.trim(), room: roomField.value || null };
            if (photoField.files[0]) fields.photo_url = await uploadParticipantPhoto(photoField.files[0]);
            await updateParticipant(p.id, fields);
            await renderParticipantsAdmin(sub);
          } catch (e) {
            itemErr.textContent = "No se pudo guardar. " + (e.message || "");
            saveBtn.disabled = false;
            saveBtn.textContent = "Guardar";
          }
        },
      },
      "Guardar"
    );
    const toggleBtn = h(
      "button",
      {
        class: "btn small secondary",
        onclick: async () => {
          await updateParticipant(p.id, { active: !p.active });
          await renderParticipantsAdmin(sub);
        },
      },
      p.active ? "Marcar eliminado" : "Marcar activo"
    );
    const delBtn = h(
      "button",
      {
        class: "btn small danger",
        onclick: async () => {
          if (!confirm(`¿Eliminar a ${p.name} de la lista de habitantes?`)) return;
          await deleteParticipant(p.id);
          await renderParticipantsAdmin(sub);
        },
      },
      "Borrar"
    );
    const avatar = p.photo_url
      ? h("div", { class: "avatar-sm", style: `background-image:url('${esc(p.photo_url)}')` })
      : h("div", { class: "avatar-sm" }, initials(p.name));

    return h("div", { class: "list-item" }, [
      h("div", { class: "row-flex" }, [
        avatar,
        nameField,
        roomField,
        photoField,
        p.active ? h("span", { class: "badge green" }, "activo") : h("span", { class: "badge red" }, "eliminado"),
      ]),
      h("div", { class: "row-flex" }, [saveBtn, toggleBtn, delBtn]),
      itemErr,
    ]);
  });

  clearAndAppend(
    sub,
    h("div", {}, [
      addForm,
      h("div", { class: "card" }, items.length ? items : [h("p", { class: "muted" }, "Sin habitantes todavía.")]),
    ])
  );
}

// ============================================================
// SEMANAS
// ============================================================
async function renderWeekDetail(container, week, allParticipants) {
  const [nominations, immunities] = await Promise.all([
    getNominationsForWeek(week.id),
    getImmunitiesForWeek(week.id),
  ]);
  const nominatedIds = new Set(nominations.map((n) => n.participant_id));
  const immuneIds = new Set(immunities.map((i) => i.participant_id));

  const refresh = async () => {
    const fresh = await getWeeks();
    const updated = fresh.find((w) => w.id === week.id);
    await renderWeekDetail(container, updated, allParticipants);
  };

  // --- Nominados ---
  const nomineeChips = nominations.map((n) =>
    h("span", { class: `chip-select${n.saved ? " saved" : ""}` }, [
      `${n.participants.name} (${n.points}pts)`,
      n.saved ? h("span", { class: "badge green", style: "margin:0 2px" }, "Salvado") : null,
      h(
        "button",
        {
          title: n.saved ? "Quitar salvación" : "Marcar salvación",
          onclick: async () => {
            await setNominationSaved(week.id, n.participant_id, !n.saved);
            await refresh();
          },
        },
        h("i", { class: `fa-solid ${n.saved ? "fa-rotate-left" : "fa-shield-halved"}` })
      ),
      h(
        "button",
        {
          title: "Quitar de nominados",
          onclick: async () => {
            await removeNomination(week.id, n.participant_id);
            await refresh();
          },
        },
        h("i", { class: "fa-solid fa-xmark" })
      ),
    ])
  );

  const nomineeSelect = h(
    "select",
    {},
    [h("option", { value: "" }, "Elige participante…")].concat(
      allParticipants
        .filter((p) => p.active && !nominatedIds.has(p.id))
        .map((p) => h("option", { value: p.id }, p.name))
    )
  );
  const pointsInput = h("input", { type: "number", value: "0", style: "max-width:90px" });
  const addNomBtn = h(
    "button",
    {
      class: "btn small",
      onclick: async () => {
        if (!nomineeSelect.value) return;
        await setNomination(week.id, Number(nomineeSelect.value), Number(pointsInput.value) || 0);
        await refresh();
      },
    },
    "Nominar"
  );

  // --- Inmunes ---
  const immuneChips = immunities.map((i) =>
    h("span", { class: "chip-select" }, [
      i.participants.name,
      h(
        "button",
        {
          onclick: async () => {
            await removeImmunity(week.id, i.participant_id);
            await refresh();
          },
        },
        h("i", { class: "fa-solid fa-xmark" })
      ),
    ])
  );
  const immuneSelect = h(
    "select",
    {},
    [h("option", { value: "" }, "Elige participante…")].concat(
      allParticipants.filter((p) => p.active && !immuneIds.has(p.id)).map((p) => h("option", { value: p.id }, p.name))
    )
  );
  const addImmuneBtn = h(
    "button",
    {
      class: "btn small",
      onclick: async () => {
        if (!immuneSelect.value) return;
        await addImmunity(week.id, Number(immuneSelect.value));
        await refresh();
      },
    },
    "Marcar como líder"
  );

  // --- Estado / acciones ---
  const openVotingBtn = h(
    "button",
    {
      class: "btn small",
      onclick: async () => {
        await updateWeek(week.id, { status: "voting_open" });
        await refresh();
      },
    },
    "Abrir votación"
  );

  const elimCheckboxes = nominations.map((n) => {
    const cb = h("input", { type: "checkbox", value: n.participant_id, id: `elim-${n.participant_id}` });
    return h("label", { style: "display:flex;align-items:center;gap:6px;margin:4px 0" }, [cb, n.participants.name]);
  });
  const confirmErr = h("div", { class: "error-msg" });
  const confirmBtn = h(
    "button",
    {
      class: "btn small danger",
      onclick: async () => {
        const checked = elimCheckboxes
          .map((label) => label.firstChild)
          .filter((cb) => cb.checked)
          .map((cb) => Number(cb.value));
        if (checked.length === 0) {
          confirmErr.textContent = "Selecciona al menos un eliminado.";
          return;
        }
        if (!confirm("Esto cerrará la semana y marcará al/los eliminado/s. ¿Confirmar?")) return;
        await confirmEliminations(week.id, checked);
        await refresh();
      },
    },
    "Confirmar eliminación y cerrar semana"
  );

  const deleteWeekBtn = h(
    "button",
    {
      class: "btn small secondary",
      onclick: async () => {
        if (!confirm(`¿Borrar ${week.label || "Semana " + week.week_number} por completo?`)) return;
        await deleteWeek(week.id);
        container.parentElement.removeChild(container);
      },
    },
    "Borrar semana"
  );

  const actionBlock = [];
  if (week.status === "draft") actionBlock.push(h("div", {}, [openVotingBtn]));
  if (week.status === "voting_open") {
    actionBlock.push(
      h("div", {}, [
        h("p", { class: "muted", style: "font-size:0.82rem;margin-bottom:4px" }, "Confirmar quién fue eliminado:"),
        ...elimCheckboxes,
        confirmBtn,
        confirmErr,
      ])
    );
  }
  if (week.status === "closed") {
    actionBlock.push(h("p", { class: "badge red" }, "Semana cerrada"));
  }

  clearAndAppend(
    container,
    h("div", { class: "card" }, [
      h("div", { class: "week-card-header" }, [
        h("strong", {}, week.label || `Semana ${week.week_number}`),
        h("span", { class: `badge ${STATUS_BADGE[week.status]}` }, STATUS_LABEL[week.status]),
      ]),
      h("div", { class: "field-row", style: "margin:10px 0" }, [
        h("div", {}, [
          h("label", {}, "Fecha nominados"),
          h("input", {
            type: "date",
            value: week.nomination_date || "",
            onchange: async (e) => {
              await updateWeek(week.id, { nomination_date: e.target.value });
            },
          }),
        ]),
        h("div", {}, [
          h("label", {}, "Fecha eliminación"),
          h("input", {
            type: "date",
            value: week.elimination_date || "",
            onchange: async (e) => {
              const fields = { elimination_date: e.target.value };
              if (week.voting_closes_at && e.target.value) {
                const time = toLocalTimeInputValue(week.voting_closes_at);
                fields.voting_closes_at = new Date(`${e.target.value}T${time}:00`).toISOString();
              }
              await updateWeek(week.id, fields);
              await refresh();
            },
          }),
        ]),
        h("div", {}, [
          h("label", {}, "Cierre automático de votación (mismo día, 6–8 PM)"),
          week.elimination_date
            ? h("input", {
                type: "time",
                min: "18:00",
                max: "20:59",
                step: "60",
                value: week.voting_closes_at ? toLocalTimeInputValue(week.voting_closes_at) : "",
                onchange: async (e) => {
                  if (!e.target.value) {
                    await updateWeek(week.id, { voting_closes_at: null });
                    return;
                  }
                  const [hh, mm] = e.target.value.split(":").map(Number);
                  const clampedHour = Math.min(20, Math.max(18, hh));
                  const clampedMinute = clampedHour === 20 ? Math.min(59, mm) : mm;
                  const clamped = `${String(clampedHour).padStart(2, "0")}:${String(clampedMinute).padStart(2, "0")}`;
                  e.target.value = clamped;
                  const iso = new Date(`${week.elimination_date}T${clamped}:00`).toISOString();
                  await updateWeek(week.id, { voting_closes_at: iso });
                },
              })
            : h("p", { class: "muted", style: "font-size:0.82rem;margin:6px 0 0" }, "Define primero la fecha de eliminación."),
        ]),
      ]),
      h("p", { style: "margin:10px 0 4px" }, h("strong", {}, "Nominados")),
      h("div", {}, nomineeChips.length ? nomineeChips : [h("span", { class: "muted" }, "Ninguno todavía")]),
      h("div", { class: "row-flex", style: "margin-top:8px" }, [nomineeSelect, pointsInput, addNomBtn]),
      h("p", { style: "margin:14px 0 4px" }, h("strong", {}, "Líder de la semana (inmunidad)")),
      h("div", {}, immuneChips.length ? immuneChips : [h("span", { class: "muted" }, "Ninguno todavía")]),
      h("div", { class: "row-flex", style: "margin-top:8px" }, [immuneSelect, addImmuneBtn]),
      h("div", { style: "margin-top:16px" }, actionBlock),
      h("div", { style: "margin-top:10px" }, [deleteWeekBtn]),
    ])
  );
}

async function renderWeeksAdmin(sub) {
  clearAndAppend(sub, h("div", { class: "loading" }, "Cargando…"));
  const [weeks, participants] = await Promise.all([getWeeks(), getParticipants()]);

  const numInput = h("input", { type: "number", placeholder: "# semana", style: "max-width:100px" });
  const labelInput = h("input", { type: "text", placeholder: "Etiqueta (opcional)" });
  const newWeekErr = h("div", { class: "error-msg" });
  const newWeekBtn = h(
    "button",
    {
      class: "btn small",
      onclick: async () => {
        if (!numInput.value) {
          newWeekErr.textContent = "Indica el número de semana.";
          return;
        }
        try {
          await createWeek({ week_number: Number(numInput.value), label: labelInput.value.trim() || null });
          await renderWeeksAdmin(sub);
        } catch (e) {
          newWeekErr.textContent = "No se pudo crear (¿ese número ya existe?).";
        }
      },
    },
    "Crear semana"
  );

  const newWeekForm = h("div", { class: "card" }, [
    h("div", { class: "field-row" }, [h("div", {}, [h("label", {}, "Número"), numInput]), h("div", {}, [h("label", {}, "Etiqueta"), labelInput])]),
    newWeekBtn,
    newWeekErr,
  ]);

  const list = h("div", {}, []);
  clearAndAppend(sub, h("div", {}, [newWeekForm, list]));

  for (const w of weeks) {
    const weekContainer = h("div", {});
    list.appendChild(weekContainer);
    renderWeekDetail(weekContainer, w, participants);
  }
}

// ============================================================
// USUARIOS
// ============================================================
async function renderUsersAdmin(sub) {
  clearAndAppend(sub, h("div", { class: "loading" }, "Cargando…"));
  const profiles = await getAllProfiles();

  const items = profiles.map((p) => {
    const nameField = h("input", { type: "text", value: p.display_name, style: "max-width:160px" });
    const saveBtn = h(
      "button",
      {
        class: "btn small secondary",
        onclick: async () => {
          await updateProfileDisplayName(p.id, nameField.value.trim());
          await renderUsersAdmin(sub);
        },
      },
      "Guardar"
    );
    const roleBtn = h(
      "button",
      {
        class: "btn small secondary",
        onclick: async () => {
          await setProfileRole(p.id, p.role === "admin" ? "player" : "admin");
          await renderUsersAdmin(sub);
        },
      },
      p.role === "admin" ? "Quitar admin" : "Hacer admin"
    );
    return h("div", { class: "list-item" }, [
      h("div", { class: "row-flex" }, [
        h("span", { class: "muted", style: "min-width:110px" }, `@${p.username}`),
        nameField,
        h("span", { class: `badge ${p.role === "admin" ? "gold" : "gray"}` }, p.role),
      ]),
      h("div", { class: "row-flex" }, [saveBtn, roleBtn]),
    ]);
  });

  clearAndAppend(
    sub,
    h("div", {}, [
      h("p", { class: "muted", style: "font-size:0.82rem" }, "Para crear cuentas nuevas usa el panel de Supabase (Authentication → Add user) con correo usuario@lcdlfmx.app. Aquí solo editas nombre y rol."),
      h("div", { class: "card" }, items.length ? items : [h("p", { class: "muted" }, "Sin usuarios todavía.")]),
    ])
  );
}

// ============================================================
// FAVORITOS DE TEMPORADAS ANTERIORES
// ============================================================
async function renderLegacyAdmin(sub) {
  clearAndAppend(sub, h("div", { class: "loading" }, "Cargando…"));
  const favorites = await getLegacyFavorites();

  const seasonSelect = h(
    "select",
    { style: "max-width:120px" },
    [1, 2, 3].map((s) => h("option", { value: s }, `Temporada ${s}`))
  );
  const nameInput = h("input", { type: "text", placeholder: "Nombre" });
  const fileInput = h("input", { type: "file", accept: "image/*" });
  const addErr = h("div", { class: "error-msg" });
  const addBtn = h(
    "button",
    {
      class: "btn small",
      onclick: async () => {
        if (!nameInput.value.trim()) {
          addErr.textContent = "El nombre es obligatorio.";
          return;
        }
        addBtn.disabled = true;
        addBtn.textContent = "Guardando…";
        try {
          let photo_url = null;
          if (fileInput.files[0]) photo_url = await uploadParticipantPhoto(fileInput.files[0]);
          await createLegacyFavorite({ season: Number(seasonSelect.value), name: nameInput.value.trim(), photo_url });
          await renderLegacyAdmin(sub);
        } catch (e) {
          addErr.textContent = "No se pudo guardar. " + (e.message || "");
        } finally {
          addBtn.disabled = false;
          addBtn.textContent = "Agregar";
        }
      },
    },
    "Agregar"
  );

  const addForm = h("div", { class: "card" }, [
    h("p", { style: "margin-top:0", class: "muted" }, "Estos íconos son solo para elegir como favorito en el perfil — no cuentan como habitantes de la temporada actual."),
    h("div", { class: "field-row" }, [
      h("div", {}, [h("label", {}, "Temporada"), seasonSelect]),
      h("div", {}, [h("label", {}, "Nombre"), nameInput]),
      h("div", {}, [h("label", {}, "Foto"), fileInput]),
    ]),
    addBtn,
    addErr,
  ]);

  const groups = [1, 2, 3].map((season) => {
    const items = favorites
      .filter((f) => f.season === season)
      .map((f) => {
        const nameField = h("input", { type: "text", value: f.name, style: "max-width:160px" });
        const photoField = h("input", { type: "file", accept: "image/*", style: "max-width:160px" });
        const itemErr = h("div", { class: "error-msg" });
        const saveBtn = h(
          "button",
          {
            class: "btn small secondary",
            onclick: async () => {
              itemErr.textContent = "";
              saveBtn.disabled = true;
              saveBtn.textContent = "Guardando…";
              try {
                const fields = { name: nameField.value.trim() };
                if (photoField.files[0]) fields.photo_url = await uploadParticipantPhoto(photoField.files[0]);
                await updateLegacyFavorite(f.id, fields);
                await renderLegacyAdmin(sub);
              } catch (e) {
                itemErr.textContent = "No se pudo guardar. " + (e.message || "");
                saveBtn.disabled = false;
                saveBtn.textContent = "Guardar";
              }
            },
          },
          "Guardar"
        );
        const delBtn = h(
          "button",
          {
            class: "btn small danger",
            onclick: async () => {
              if (!confirm(`¿Borrar a ${f.name} (Temporada ${f.season})?`)) return;
              await deleteLegacyFavorite(f.id);
              await renderLegacyAdmin(sub);
            },
          },
          "Borrar"
        );
        const avatar = f.photo_url
          ? h("div", { class: "avatar-sm", style: `background-image:url('${esc(f.photo_url)}')` })
          : h("div", { class: "avatar-sm" }, initials(f.name));
        return h("div", { class: "list-item" }, [
          h("div", { class: "row-flex" }, [avatar, nameField, photoField]),
          h("div", { class: "row-flex" }, [saveBtn, delBtn]),
          itemErr,
        ]);
      });
    return h("div", {}, [
      h("p", { style: "margin:14px 0 4px" }, h("strong", {}, `Temporada ${season}`)),
      h("div", { class: "card" }, items.length ? items : [h("p", { class: "muted" }, "Sin favoritos todavía.")]),
    ]);
  });

  clearAndAppend(sub, h("div", {}, [addForm, ...groups]));
}

// ============================================================
// DINÁMICAS (habitante al azar + ganador de la temporada)
// ============================================================
async function renderDynamicsAdmin(sub) {
  clearAndAppend(sub, h("div", { class: "loading" }, "Cargando…"));
  const [participants, assignments] = await Promise.all([getParticipants(), getSecretAssignments()]);

  // --- Habitante al azar ---
  const assignErr = h("div", { class: "error-msg" });
  const assignBtn = h(
    "button",
    {
      class: "btn small",
      onclick: async () => {
        assignErr.textContent = "";
        assignBtn.disabled = true;
        assignBtn.textContent = "Asignando…";
        try {
          await assignSecretHabitantesRandomly();
          await renderDynamicsAdmin(sub);
        } catch (e) {
          assignErr.textContent = "No se pudo asignar. " + (e.message || "");
          assignBtn.disabled = false;
          assignBtn.textContent = "Asignar al azar";
        }
      },
    },
    "Asignar al azar"
  );

  const assignmentRows = assignments.map((a) => {
    const select = h(
      "select",
      { style: "max-width:200px" },
      participants.map((p) =>
        h("option", { value: p.id, selected: p.id === a.participant_id ? "selected" : undefined }, p.name)
      )
    );
    const saveBtn = h(
      "button",
      {
        class: "btn small secondary",
        onclick: async () => {
          await reassignSecretHabitante(a.player_id, Number(select.value));
          await renderDynamicsAdmin(sub);
        },
      },
      "Guardar"
    );
    return h("div", { class: "list-item" }, [
      h("div", { class: "row-flex" }, [h("strong", {}, a.profiles?.display_name || "—"), select]),
      saveBtn,
    ]);
  });

  const secretCard = h("div", { class: "card" }, [
    h("p", { style: "margin-top:0" }, [h("i", { class: "fa-solid fa-shuffle" }), " ", h("strong", {}, "Habitante al azar")]),
    h(
      "p",
      { class: "muted", style: "font-size:0.82rem" },
      "Le asigna un habitante al azar a cada jugador que todavía no tenga uno (sin repetir, salvo que haya más jugadores que habitantes). Si a alguien se le asigna el habitante que termina ganando la temporada, se lleva +3 puntos."
    ),
    h("div", { style: "margin-bottom:14px" }, [assignBtn, assignErr]),
    assignmentRows.length ? h("div", {}, assignmentRows) : h("p", { class: "muted" }, "Nadie tiene asignación todavía."),
  ]);

  // --- Ganador de la temporada ---
  const winnerRows = participants.map((p) => {
    const btn = h(
      "button",
      {
        class: `btn small${p.is_winner ? "" : " secondary"}`,
        onclick: async () => {
          await markParticipantAsWinner(p.id);
          await renderDynamicsAdmin(sub);
        },
      },
      p.is_winner ? [h("i", { class: "fa-solid fa-crown" }), " Ganador/a"] : "Marcar como ganador/a"
    );
    const avatar = p.photo_url
      ? h("div", { class: "avatar-sm", style: `background-image:url('${esc(p.photo_url)}')` })
      : h("div", { class: "avatar-sm" }, initials(p.name));
    return h("div", { class: "list-item" }, [
      h("div", { class: "row-flex" }, [avatar, p.name, p.is_winner ? h("span", { class: "badge gold" }, "Ganador/a") : null]),
      btn,
    ]);
  });

  const winnerCard = h("div", { class: "card" }, [
    h("p", { style: "margin-top:0" }, [h("i", { class: "fa-solid fa-crown" }), " ", h("strong", {}, "Ganador/a de la temporada")]),
    h("p", { class: "muted", style: "font-size:0.82rem" }, "Márcalo aquí cuando la final termine de definirse."),
    h("div", {}, winnerRows.length ? winnerRows : [h("p", { class: "muted" }, "Sin habitantes todavía.")]),
  ]);

  clearAndAppend(sub, h("div", {}, [secretCard, winnerCard]));
}

// ============================================================
// MAIN
// ============================================================
export async function renderAdmin(container) {
  const tabsBar = h("div", { class: "row-flex", style: "margin-bottom:16px;flex-wrap:wrap" });
  const sub = h("div", {});
  clearAndAppend(container, h("div", {}, [h("div", { class: "section-title" }, "Panel de administración"), tabsBar, sub]));

  const tabs = [
    { key: "weeks", label: "Semanas", render: renderWeeksAdmin },
    { key: "participants", label: "Habitantes", render: renderParticipantsAdmin },
    { key: "legacy", label: "Favoritos históricos", render: renderLegacyAdmin },
    { key: "dynamics", label: "Dinámicas", render: renderDynamicsAdmin },
    { key: "users", label: "Usuarios", render: renderUsersAdmin },
  ];

  function setActive(key) {
    [...tabsBar.children].forEach((btn) => btn.classList.toggle("btn", true));
    [...tabsBar.children].forEach((btn) => btn.classList.toggle("secondary", btn.dataset.key !== key));
  }

  tabs.forEach((t) => {
    const btn = h("button", { class: "btn small secondary", "data-key": t.key, onclick: () => { setActive(t.key); t.render(sub); } }, t.label);
    tabsBar.appendChild(btn);
  });

  setActive("weeks");
  await tabs[0].render(sub);
}
