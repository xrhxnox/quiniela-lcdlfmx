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
} from "../data.js";
import { h, esc, initials, clearAndAppend } from "../utils.js";

const STATUS_LABEL = { draft: "Borrador", voting_open: "Votación abierta", closed: "Cerrada" };
const STATUS_BADGE = { draft: "gray", voting_open: "green", closed: "red" };
const ROOM_OPTIONS = ["Ibiza", "Tulum", "Malibú"];

function roomSelect(currentValue) {
  const options = [...ROOM_OPTIONS];
  if (currentValue && !options.includes(currentValue)) options.push(currentValue);
  return h(
    "select",
    { style: "max-width:140px" },
    [h("option", { value: "" }, "Sin cuarto")].concat(
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
          addBtn.textContent = "Agregar participante";
        }
      },
    },
    "Agregar participante"
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
    const saveBtn = h(
      "button",
      {
        class: "btn small secondary",
        onclick: async () => {
          await updateParticipant(p.id, { name: nameField.value.trim(), room: roomField.value || null });
          await renderParticipantsAdmin(sub);
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
          if (!confirm(`¿Eliminar a ${p.name} de la lista de participantes?`)) return;
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
        p.active ? h("span", { class: "badge green" }, "activo") : h("span", { class: "badge red" }, "eliminado"),
      ]),
      h("div", { class: "row-flex" }, [saveBtn, toggleBtn, delBtn]),
    ]);
  });

  clearAndAppend(
    sub,
    h("div", {}, [
      addForm,
      h("div", { class: "card" }, items.length ? items : [h("p", { class: "muted" }, "Sin participantes todavía.")]),
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
              await updateWeek(week.id, { elimination_date: e.target.value });
            },
          }),
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
// MAIN
// ============================================================
export async function renderAdmin(container) {
  const tabsBar = h("div", { class: "row-flex", style: "margin-bottom:16px;flex-wrap:wrap" });
  const sub = h("div", {});
  clearAndAppend(container, h("div", {}, [h("div", { class: "section-title" }, "Panel de administración"), tabsBar, sub]));

  const tabs = [
    { key: "weeks", label: "Semanas", render: renderWeeksAdmin },
    { key: "participants", label: "Participantes", render: renderParticipantsAdmin },
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
