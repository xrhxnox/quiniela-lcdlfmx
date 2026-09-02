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
  getNominationVotesForWeek,
  addNominationVote,
  removeNominationVote,
  getImmunitiesForWeek,
  addImmunity,
  removeImmunity,
  confirmEliminations,
  getEliminationsForWeek,
  getExilesForWeek,
  getGranjaWeekDynamics,
  saveGranjaDuel,
  removeGranjaDuel,
  saveGranjaBetrayal,
  removeGranjaBetrayal,
  saveGranjaLegacy,
  removeGranjaLegacy,
  addExile,
  removeExile,
  setEliminationOraculoMode,
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
  clearSecretAssignment,
  resetSecretAssignments,
  markParticipantAsWinner,
  clearWinner,
  isOraculoLocked,
  setOraculoLocked,
  resetOraculo,
  fillMissingOraculoPredictionsAlphabetically,
} from "../data.js";
import { h, esc, initials, clearAndAppend } from "../utils.js";
import { ROOM_OPTIONS } from "../rooms.js";
import { getShow, isGranja } from "../shows.js";

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
    const roomField = isGranja() ? null : roomSelect(p.room);
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
    const infiltradoBtn = h(
      "button",
      {
        class: "btn small secondary",
        onclick: async () => {
          await updateParticipant(p.id, { is_infiltrado: !p.is_infiltrado });
          await renderParticipantsAdmin(sub);
        },
      },
      p.is_infiltrado ? "Quitar infiltrado" : "Marcar infiltrado"
    );
    const exiliadoBtn = h(
      "button",
      {
        class: "btn small secondary",
        onclick: async () => {
          await updateParticipant(p.id, { is_exiliado: !p.is_exiliado });
          await renderParticipantsAdmin(sub);
        },
      },
      p.is_exiliado ? "Quitar exilio" : "Marcar exiliado"
    );
    const abandonoBtn = h(
      "button",
      {
        class: "btn small secondary",
        onclick: async () => {
          await updateParticipant(p.id, { is_abandono: !p.is_abandono });
          await renderParticipantsAdmin(sub);
        },
      },
      p.is_abandono ? "Quitar abandono" : "Marcar abandono"
    );
    const peonBtn = h(
      "button",
      {
        class: "btn small secondary",
        onclick: async () => {
          await updateParticipant(p.id, { is_peon: !p.is_peon });
          await renderParticipantsAdmin(sub);
        },
      },
      p.is_peon ? "Quitar peón" : "Marcar peón"
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
        !isGranja() && p.is_infiltrado
          ? h("span", { class: "badge", style: "background:#a742f526;color:#a742f5;border:1px solid #a742f5" }, "infiltrado")
          : null,
        !isGranja() && p.is_exiliado ? h("span", { class: "badge black" }, "exiliado") : null,
        p.is_abandono ? h("span", { class: "badge red" }, "abandono") : null,
        isGranja() && p.is_peon ? h("span", { class: "badge", style: "background:#b0896826;color:#c99f7d;border:1px solid #b08968" }, "peón") : null,
      ]),
      h("div", { class: "row-flex" }, [
        saveBtn,
        toggleBtn,
        isGranja() ? null : infiltradoBtn,
        isGranja() ? null : exiliadoBtn,
        abandonoBtn,
        isGranja() ? peonBtn : null,
        delBtn,
      ]),
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
  const [nominations, immunities, nominationVotes, weekEliminations, weekExiles, dynamics] = await Promise.all([
    getNominationsForWeek(week.id),
    getImmunitiesForWeek(week.id),
    getNominationVotesForWeek(week.id),
    getEliminationsForWeek(week.id),
    getExilesForWeek(week.id),
    isGranja() ? getGranjaWeekDynamics(week.id) : Promise.resolve({ duel: null, betrayal: null, legacy: null }),
  ]);
  const nominatedIds = new Set(nominations.map((n) => n.participant_id));
  const immuneIds = new Set(immunities.map((i) => i.participant_id));
  const participantById = {};
  allParticipants.forEach((p) => (participantById[p.id] = p));

  const refresh = async () => {
    const fresh = await getWeeks();
    const updated = fresh.find((w) => w.id === week.id);
    await renderWeekDetail(container, updated, allParticipants);
  };

  // --- Nominados ---
  const nomineeChips = nominations.map((n) =>
    h("span", { class: `chip-select${n.saved ? " saved" : ""}` }, [
      `${n.participants.name} (${n.points}pts)`,
      n.saved ? h("span", { class: "badge", style: "margin:0 2px;background:#3b82f626;color:#3b82f6;border:1px solid #3b82f6" }, "Salvado") : null,
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

  // --- Líder de la semana ---
  const leaders = immunities.filter((i) => i.is_leader);
  const leaderChips = leaders.map((i) =>
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
  const leaderSelect = h(
    "select",
    {},
    [h("option", { value: "" }, "Elige participante…")].concat(
      allParticipants.filter((p) => p.active && !immuneIds.has(p.id)).map((p) => h("option", { value: p.id }, p.name))
    )
  );
  const addLeaderBtn = h(
    "button",
    {
      class: "btn small",
      onclick: async () => {
        if (!leaderSelect.value) return;
        await addImmunity(week.id, Number(leaderSelect.value), true);
        await refresh();
      },
    },
    `Marcar como ${getShow().leaderLabel.toLowerCase()}`
  );

  // --- Inmune (separado del líder) ---
  const immunesOnly = immunities.filter((i) => !i.is_leader);
  const immuneChips = immunesOnly.map((i) =>
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
        await addImmunity(week.id, Number(immuneSelect.value), false);
        await refresh();
      },
    },
    "Marcar como inmune"
  );

  // --- La Salvación ---
  // El líder tiene la salvación y salva a un nominado, pero en la dinámica otro
  // habitante puede robársela para salvarse él o salvar a alguien más. Por eso
  // son dos datos distintos: quién terminó con ella y a quién salvó. Robarla
  // solo le quita la salvación al líder, no su inmunidad, así que esto nunca
  // toca immunities.
  const saveSalvation = async (fields) => {
    await updateWeek(week.id, fields);
    await refresh();
  };
  const salvationSelect = h(
    "select",
    {
      style: "max-width:220px",
      onchange: async (e) => {
        const pid = e.target.value ? Number(e.target.value) : null;
        // Al elegir a alguien sin modo previo se asume "la conservó el líder";
        // al dejarlo vacío se limpia el modo para no dejar el dato a medias.
        await saveSalvation({
          salvation_participant_id: pid,
          salvation_mode: pid ? week.salvation_mode || "conservo" : null,
        });
      },
    },
    [h("option", { value: "" }, "Nadie / sin registro")].concat(
      allParticipants.map((p) => h("option", { value: p.id }, p.name))
    )
  );
  salvationSelect.value = week.salvation_participant_id ?? "";
  const salvationModeBtn = (mode, label) =>
    h(
      "button",
      {
        class: `btn small${week.salvation_mode === mode ? "" : " secondary"}`,
        disabled: week.salvation_participant_id ? undefined : "",
        onclick: () => saveSalvation({ salvation_mode: mode }),
      },
      label
    );

  // A quién salvó. No es una columna nueva: enciende el mismo flag "saved" de
  // nominations que ya usa el botón del escudo y alimenta "Salvado N veces".
  // Solo puede haber un salvado por semana, así que se comporta como radio.
  const savedNomination = nominations.find((n) => n.saved);
  const salvationSavedSelect = h(
    "select",
    {
      style: "max-width:220px",
      onchange: async (e) => {
        const pid = e.target.value ? Number(e.target.value) : null;
        for (const n of nominations) {
          if (n.saved && n.participant_id !== pid) await setNominationSaved(week.id, n.participant_id, false);
        }
        if (pid) await setNominationSaved(week.id, pid, true);
        await refresh();
      },
    },
    [h("option", { value: "" }, "Nadie todavía")].concat(
      nominations.map((n) => h("option", { value: n.participant_id }, n.participants.name))
    )
  );
  salvationSavedSelect.value = savedNomination?.participant_id ?? "";

  // --- Enviados al exilio ---
  // Ir al exilio no es salir del juego, por eso es su propia lista y no toca
  // eliminations ni el estado "active" del habitante.
  const exiledIds = new Set(weekExiles.map((e) => e.participant_id));
  const exileChips = weekExiles.map((e) =>
    h("span", { class: "chip-select" }, [
      e.participants.name,
      h(
        "button",
        {
          onclick: async () => {
            await removeExile(week.id, e.participant_id);
            await refresh();
          },
        },
        h("i", { class: "fa-solid fa-xmark" })
      ),
    ])
  );
  const exileSelect = h(
    "select",
    {},
    [h("option", { value: "" }, "Elige participante…")].concat(
      allParticipants.filter((p) => !exiledIds.has(p.id)).map((p) => h("option", { value: p.id }, p.name))
    )
  );
  const addExileBtn = h(
    "button",
    {
      class: "btn small",
      onclick: async () => {
        if (!exileSelect.value) return;
        await addExile(week.id, Number(exileSelect.value));
        await refresh();
      },
    },
    "Mandar al exilio"
  );

  // --- Duelo, traición y El Legado (solo La Granja) ---
  // Son tres tarjetas con la misma forma: unos selects y un botón que guarda.
  // Se arman aquí pero solo se pintan si el show activo es La Granja.
  const pSelect = (selectedId, { incluirVacio = "Elige…", soloActivos = false } = {}) => {
    const el = h(
      "select",
      { style: "max-width:190px" },
      [h("option", { value: "" }, incluirVacio)].concat(
        allParticipants.filter((p) => !soloActivos || p.active).map((p) => h("option", { value: p.id }, p.name))
      )
    );
    el.value = selectedId ?? "";
    return el;
  };
  const nameOf = (id) => participantById[id]?.name || "—";
  const dynErr = h("div", { class: "error-msg" });
  const saveDyn = async (fn) => {
    dynErr.textContent = "";
    try {
      await fn();
      await refresh();
    } catch (e) {
      dynErr.textContent = "No se pudo guardar. " + (e.message || "");
    }
  };

  // Duelo: el perdedor tiene que ser uno de los dos que se enfrentaron.
  const duel = dynamics.duel;
  const duelA = pSelect(duel?.participant_a_id);
  const duelB = pSelect(duel?.participant_b_id);
  const duelLoser = pSelect(duel?.loser_id, { incluirVacio: "¿Quién perdió?" });
  const duelSaveBtn = h(
    "button",
    {
      class: "btn small",
      onclick: () =>
        saveDyn(async () => {
          if (!duelA.value || !duelB.value) throw new Error("Elige a los dos del duelo.");
          if (duelA.value === duelB.value) throw new Error("Tienen que ser dos granjeros distintos.");
          if (duelLoser.value && ![duelA.value, duelB.value].includes(duelLoser.value))
            throw new Error("El perdedor tiene que ser uno de los dos.");
          await saveGranjaDuel(week.id, {
            participant_a_id: Number(duelA.value),
            participant_b_id: Number(duelB.value),
            loser_id: duelLoser.value ? Number(duelLoser.value) : null,
          });
        }),
    },
    "Guardar duelo"
  );
  const duelClearBtn = h(
    "button",
    { class: "btn small secondary", onclick: () => saveDyn(() => removeGranjaDuel(week.id)) },
    "Quitar duelo"
  );

  // Traición: sale un nominado, entra uno que no lo estaba.
  const bet = dynamics.betrayal;
  const betTraitor = pSelect(bet?.traitor_id ?? week.salvation_participant_id, { incluirVacio: "¿Quién traicionó?" });
  const betOut = pSelect(bet?.out_participant_id, { incluirVacio: "Sale de riesgo…" });
  const betIn = pSelect(bet?.in_participant_id, { incluirVacio: "Entra a riesgo…" });
  const betSaveBtn = h(
    "button",
    {
      class: "btn small",
      onclick: () =>
        saveDyn(async () => {
          if (!betOut.value || !betIn.value) throw new Error("Elige a quién sale y a quién entra.");
          if (betOut.value === betIn.value) throw new Error("Tienen que ser dos granjeros distintos.");
          await saveGranjaBetrayal(week.id, {
            traitor_id: betTraitor.value ? Number(betTraitor.value) : null,
            out_participant_id: Number(betOut.value),
            in_participant_id: Number(betIn.value),
          });
        }),
    },
    "Guardar traición"
  );
  const betClearBtn = h(
    "button",
    { class: "btn small secondary", onclick: () => saveDyn(() => removeGranjaBetrayal(week.id)) },
    "Quitar traición"
  );

  // El Legado: lo deja el eliminado de ESTA semana y pega en la siguiente.
  const leg = dynamics.legacy;
  const legFrom = pSelect(leg?.from_participant_id ?? weekEliminations[0]?.participant_id, { incluirVacio: "¿Quién salió?" });
  const legTo = pSelect(leg?.to_participant_id, { incluirVacio: "¿A quién nomina?" });
  const legSaveBtn = h(
    "button",
    {
      class: "btn small",
      onclick: () =>
        saveDyn(async () => {
          if (!legFrom.value || !legTo.value) throw new Error("Elige quién deja el legado y a quién nomina.");
          if (legFrom.value === legTo.value) throw new Error("No puede nominarse a sí mismo.");
          await saveGranjaLegacy(week.id, {
            from_participant_id: Number(legFrom.value),
            to_participant_id: Number(legTo.value),
          });
        }),
    },
    "Guardar legado"
  );
  const legClearBtn = h(
    "button",
    { class: "btn small secondary", onclick: () => saveDyn(() => removeGranjaLegacy(week.id)) },
    "Quitar legado"
  );

  const granjaDynamicsBlock = () => [
    h("p", { style: "margin:14px 0 4px" }, h("strong", {}, "Duelo (martes)")),
    h(
      "p",
      { class: "muted", style: "font-size:0.82rem;margin-bottom:6px" },
      "Los dos que se enfrentaron y quién perdió. Al guardarlo, el perdedor se agrega solo a Nominados — quitar el duelo después ya no lo saca de ahí."
    ),
    h("div", { class: "row-flex" }, [duelA, duelB, duelLoser, duelSaveBtn, duel ? duelClearBtn : null]),
    duel?.loser_id
      ? h("p", { class: "muted", style: "font-size:0.82rem;margin:6px 0 0" }, `Perdió ${nameOf(duel.loser_id)}.`)
      : null,

    h("p", { style: "margin:14px 0 4px" }, h("strong", {}, "Traición (viernes)")),
    h(
      "p",
      { class: "muted", style: "font-size:0.82rem;margin-bottom:6px" },
      "Quien se quedó con la salvación intercambia a un nominado por uno que no lo está. Al guardarlo el cambio se aplica de verdad en Nominados: sale uno y entra el otro."
    ),
    h("div", { class: "row-flex" }, [betTraitor, betOut, betIn, betSaveBtn, bet ? betClearBtn : null]),

    h("p", { style: "margin:14px 0 4px" }, h("strong", {}, "El Legado")),
    h(
      "p",
      { class: "muted", style: "font-size:0.82rem;margin-bottom:6px" },
      "El voto que deja el eliminado de esta semana. Su efecto cae en la semana siguiente, así que aquí solo se registra: acuérdate de nominar a esa persona cuando armes la próxima."
    ),
    h("div", { class: "row-flex" }, [legFrom, legTo, legSaveBtn, leg ? legClearBtn : null]),
    dynErr,
  ];

  // --- Quién nominó a quién ---
  const votesByNominator = {};
  nominationVotes.forEach((v) => {
    if (!votesByNominator[v.nominator_id]) votesByNominator[v.nominator_id] = [];
    votesByNominator[v.nominator_id].push(v.nominee_id);
  });
  const activeParticipants = allParticipants.filter((p) => p.active);
  const voteRows = activeParticipants.map((nominator) => {
    const nomineeIds = votesByNominator[nominator.id] || [];
    const chips = nomineeIds.map((nomineeId) =>
      h("span", { class: "chip-select" }, [
        participantById[nomineeId]?.name || "—",
        h(
          "button",
          {
            onclick: async () => {
              await removeNominationVote(week.id, nominator.id, nomineeId);
              await refresh();
            },
          },
          h("i", { class: "fa-solid fa-xmark" })
        ),
      ])
    );
    const select = h(
      "select",
      { style: "max-width:200px" },
      [h("option", { value: "" }, "Elige a quién nominó…")].concat(
        activeParticipants
          .filter((p) => p.id !== nominator.id && !nomineeIds.includes(p.id))
          .map((p) => h("option", { value: p.id }, p.name))
      )
    );
    const addVoteBtn = h(
      "button",
      {
        class: "btn small secondary",
        onclick: async () => {
          if (!select.value) return;
          await addNominationVote(week.id, nominator.id, Number(select.value));
          await refresh();
        },
      },
      "Agregar"
    );
    return h("div", { class: "list-item" }, [
      h("div", { class: "row-flex" }, [h("strong", {}, nominator.name)]),
      h("div", {}, chips.length ? chips : [h("span", { class: "muted" }, "No ha nominado a nadie todavía")]),
      h("div", { class: "row-flex", style: "margin-top:6px" }, [select, addVoteBtn]),
    ]);
  });

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

    // --- Cómo cuenta cada eliminación para El Oráculo (Exilio) ---
    if (weekEliminations.length > 0) {
      const modeRows = weekEliminations.map((e) => {
        const mode = e.reverted_by_exile ? "reverted" : e.gift_all ? "gift" : "normal";
        const setMode = async (m) => {
          await setEliminationOraculoMode(week.id, e.participant_id, {
            reverted_by_exile: m === "reverted",
            gift_all: m === "gift",
          });
          await refresh();
        };
        const optBtn = (m, label) =>
          h("button", { class: `btn small${mode === m ? "" : " secondary"}`, onclick: () => setMode(m) }, label);
        return h("div", { class: "list-item" }, [
          h("div", { class: "row-flex" }, [
            h("strong", {}, e.participants.name),
            mode === "reverted" ? h("span", { class: "badge black" }, "regresó del exilio") : null,
            mode === "gift" ? h("span", { class: "badge green" }, "+1 a todos") : null,
          ]),
          h("div", { class: "row-flex", style: "margin-top:6px" }, [
            optBtn("normal", "Salida normal"),
            // El exilio es de La Casa: en La Granja nadie vuelve, así que esa
            // opción no se ofrece. "Regalar punto a todos" sí sirve en ambos.
            isGranja() ? null : optBtn("reverted", "Regresó del exilio"),
            optBtn("gift", "Regalar punto a todos"),
          ]),
        ]);
      });
      actionBlock.push(
        h("div", { style: "margin-top:14px" }, [
          h("p", { style: "margin:0 0 4px" }, h("strong", {}, "El Oráculo — cómo cuenta esta eliminación")),
          h(
            "p",
            { class: "muted", style: "font-size:0.82rem;margin-bottom:6px" },
            isGranja()
              ? 'Solo afecta a El Oráculo; el pick semanal cuenta igual en los dos casos. "Regalar punto a todos" se usa cuando la salida no se pudo prever de ninguna forma: en vez de compararla contra el orden de cada quien, suma +1 a todos.'
              : 'Solo afecta a El Oráculo; el pick semanal cuenta igual en los tres casos. "Regresó del exilio" libera su posición porque su salida no fue definitiva. "Regalar punto a todos" se usa cuando alguien que volvió sale de verdad: nadie pudo preverlo, así que suma +1 a todos.'
          ),
          h("div", {}, modeRows),
        ])
      );
    }
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
      h("p", { style: "margin:14px 0 4px" }, h("strong", {}, `${getShow().leaderLabel} de la semana (inmunidad)`)),
      h("div", {}, leaderChips.length ? leaderChips : [h("span", { class: "muted" }, "Ninguno todavía")]),
      h("div", { class: "row-flex", style: "margin-top:8px" }, [leaderSelect, addLeaderBtn]),
      h("p", { style: "margin:14px 0 4px" }, h("strong", {}, `Inmune (separado del ${getShow().leaderLabel.toLowerCase()})`)),
      h("div", {}, immuneChips.length ? immuneChips : [h("span", { class: "muted" }, "Ninguno todavía")]),
      h("div", { class: "row-flex", style: "margin-top:8px" }, [immuneSelect, addImmuneBtn]),
      h("p", { style: "margin:14px 0 4px" }, h("strong", {}, "La Salvación")),
      h(
        "p",
        { class: "muted", style: "font-size:0.82rem;margin-bottom:6px" },
        `El ${getShow().leaderLabel.toLowerCase()} salva a un nominado, salvo que alguien más le robe la salvación. Primero registra quién terminó con ella (el ${getShow().leaderLabel.toLowerCase()} si nadie la robó) y luego a quién salvó — puede haberse salvado a sí mismo. Que se la roben no le quita la inmunidad al ${getShow().leaderLabel.toLowerCase()}: eso se sigue marcando arriba, aparte.`
      ),
      h("div", { class: "row-flex" }, [
        salvationSelect,
        salvationModeBtn("conservo", `La conservó el ${getShow().leaderLabel.toLowerCase()}`),
        salvationModeBtn("robo", "Se la robaron"),
      ]),
      h("div", { class: "row-flex", style: "margin-top:8px" }, [
        h("span", { class: "muted", style: "font-size:0.82rem" }, "Salvó a:"),
        nominations.length
          ? salvationSavedSelect
          : h("span", { class: "muted", style: "font-size:0.82rem" }, "Agrega nominados primero."),
      ]),
      ...(isGranja()
        ? []
        : [
            h("p", { style: "margin:14px 0 4px" }, h("strong", {}, "Enviados al exilio")),
            h(
              "p",
              { class: "muted", style: "font-size:0.82rem;margin-bottom:6px" },
              "Quiénes fueron mandados al exilio esta semana. No es una eliminación: siguen en el juego y pueden volver a la casa. Mandarlos aquí los marca como exiliados en Habitantes; si regresan, quítales la marca desde esa pestaña."
            ),
            h("div", {}, exileChips.length ? exileChips : [h("span", { class: "muted" }, "Nadie todavía")]),
            h("div", { class: "row-flex", style: "margin-top:8px" }, [exileSelect, addExileBtn]),
          ]),
      ...(isGranja() ? granjaDynamicsBlock() : []),
      h("p", { style: "margin:14px 0 4px" }, h("strong", {}, "¿Quién nominó a quién?")),
      h(
        "p",
        { class: "muted", style: "font-size:0.82rem;margin-bottom:6px" },
        "Para cada habitante activo, registra a quién nominó (puede ser a más de uno). Esto se ve en Votar con el botón \"Ver Nominaciones\"."
      ),
      h("div", {}, voteRows.length ? voteRows : [h("span", { class: "muted" }, "No hay habitantes activos.")]),
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
    getShow().legacySeasons.map((s) => h("option", { value: s }, `Temporada ${s}`))
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

  const groups = getShow().legacySeasons.map((season) => {
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
        const peonBtn = h(
      "button",
      {
        class: "btn small secondary",
        onclick: async () => {
          await updateParticipant(p.id, { is_peon: !p.is_peon });
          await renderParticipantsAdmin(sub);
        },
      },
      p.is_peon ? "Quitar peón" : "Marcar peón"
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
  const [participants, assignments, oraculoLocked, profiles] = await Promise.all([
    getParticipants(),
    getSecretAssignments(),
    isOraculoLocked(),
    getAllProfiles(),
  ]);

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

  const resetBtn = h(
    "button",
    {
      class: "btn small danger",
      onclick: async () => {
        if (!confirm("¿Borrar TODAS las asignaciones de habitante al azar? Podrás volver a asignar desde cero.")) return;
        assignErr.textContent = "";
        resetBtn.disabled = true;
        resetBtn.textContent = "Reiniciando…";
        try {
          await resetSecretAssignments();
          await renderDynamicsAdmin(sub);
        } catch (e) {
          assignErr.textContent = "No se pudo reiniciar. " + (e.message || "");
          resetBtn.disabled = false;
          resetBtn.textContent = "Reiniciar todo";
        }
      },
    },
    "Reiniciar todo"
  );

  const sorteoEligible = participants.filter((p) => !p.is_infiltrado);
  const assignmentRows = assignments.map((a) => {
    const select = h(
      "select",
      { style: "max-width:200px" },
      sorteoEligible.map((p) =>
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
    const blankBtn = h(
      "button",
      {
        class: "btn small danger",
        onclick: async () => {
          if (!confirm(`¿Dejar en blanco la asignación de ${a.profiles?.display_name || "este jugador"}?`)) return;
          await clearSecretAssignment(a.player_id);
          await renderDynamicsAdmin(sub);
        },
      },
      "Dejar en blanco"
    );
    return h("div", { class: "list-item" }, [
      h("div", { class: "row-flex" }, [h("strong", {}, a.profiles?.display_name || "—"), select]),
      h("div", { class: "row-flex" }, [saveBtn, blankBtn]),
    ]);
  });

  const assignedPlayerIds = new Set(assignments.map((a) => a.player_id));
  const unassignedPlayers = profiles.filter((p) => !assignedPlayerIds.has(p.id));
  const unassignedRows = unassignedPlayers.map((player) => {
    const select = h(
      "select",
      { style: "max-width:200px" },
      [h("option", { value: "" }, "Elige habitante…")].concat(
        sorteoEligible.map((p) => h("option", { value: p.id }, p.name))
      )
    );
    const err = h("div", { class: "error-msg" });
    const assignPlayerBtn = h(
      "button",
      {
        class: "btn small",
        onclick: async () => {
          if (!select.value) {
            err.textContent = "Elige un habitante primero.";
            return;
          }
          await reassignSecretHabitante(player.id, Number(select.value));
          await renderDynamicsAdmin(sub);
        },
      },
      "Asignar"
    );
    return h("div", { class: "list-item" }, [
      h("div", { class: "row-flex" }, [h("strong", {}, player.display_name), select]),
      h("div", { class: "row-flex" }, [assignPlayerBtn]),
      err,
    ]);
  });

  const secretCard = h("div", { class: "card" }, [
    h("p", { style: "margin-top:0" }, [h("i", { class: "fa-solid fa-shuffle" }), " ", h("strong", {}, "Habitante al azar")]),
    h(
      "p",
      { class: "muted", style: "font-size:0.82rem" },
      "Le asigna un habitante al azar a cada jugador que todavía no tenga uno (sin repetir, salvo que haya más jugadores que habitantes). Si a alguien se le asigna el habitante que termina ganando la temporada, se lleva +3 puntos. Los habitantes marcados como Infiltrado quedan fuera de este sorteo."
    ),
    h("div", { style: "margin-bottom:14px" }, [assignBtn, resetBtn, assignErr]),
    assignmentRows.length ? h("div", {}, assignmentRows) : h("p", { class: "muted" }, "Nadie tiene asignación todavía."),
    unassignedRows.length
      ? h("div", { style: "margin-top:14px" }, [
          h("p", { class: "muted", style: "font-size:0.82rem;margin-bottom:6px" }, "Jugadores sin asignación (elige uno manualmente o usa \"Asignar al azar\"):"),
          h("div", {}, unassignedRows),
        ])
      : null,
  ]);

  // --- Ganador de la temporada ---
  const winnerRows = participants.map((p) => {
    const btn = h(
      "button",
      {
        class: `btn small${p.is_winner ? "" : " secondary"}`,
        onclick: async () => {
          if (p.is_winner) {
            await clearWinner();
          } else {
            await markParticipantAsWinner(p.id);
          }
          await renderDynamicsAdmin(sub);
        },
      },
      p.is_winner ? [h("i", { class: "fa-solid fa-crown" }), " Ganador/a (quitar)"] : "Marcar como ganador/a"
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

  // --- El Oráculo ---
  const oraculoErr = h("div", { class: "error-msg" });
  const lockToggleBtn = h(
    "button",
    {
      class: "btn small",
      onclick: async () => {
        if (!oraculoLocked) {
          if (
            !confirm(
              "Al cerrar El Oráculo, a quien no haya guardado ninguna predicción se le pondrá el orden estándar (alfabético) automáticamente. ¿Continuar?"
            )
          )
            return;
          await fillMissingOraculoPredictionsAlphabetically();
        }
        await setOraculoLocked(!oraculoLocked);
        await renderDynamicsAdmin(sub);
      },
    },
    oraculoLocked ? "Abrir El Oráculo" : "Cerrar El Oráculo"
  );
  const resetOraculoBtn = h(
    "button",
    {
      class: "btn small danger",
      onclick: async () => {
        if (!confirm("¿Reiniciar El Oráculo? Se borrarán TODAS las predicciones de todos los jugadores y se reabrirá para que vuelvan a armar su orden desde cero.")) return;
        oraculoErr.textContent = "";
        resetOraculoBtn.disabled = true;
        resetOraculoBtn.textContent = "Reiniciando…";
        try {
          await resetOraculo();
          await renderDynamicsAdmin(sub);
        } catch (e) {
          oraculoErr.textContent = "No se pudo reiniciar. " + (e.message || "");
          resetOraculoBtn.disabled = false;
          resetOraculoBtn.textContent = "Reiniciar todo";
        }
      },
    },
    "Reiniciar todo"
  );
  const oraculoCard = h("div", { class: "card" }, [
    h("p", { style: "margin-top:0" }, [
      h("i", { class: "fa-solid fa-hat-wizard" }),
      " ",
      h("strong", {}, "El Oráculo"),
      " ",
      oraculoLocked ? h("span", { class: "badge red" }, "Cerrado") : h("span", { class: "badge green" }, "Abierto"),
    ]),
    h(
      "p",
      { class: "muted", style: "font-size:0.82rem" },
      "Mientras esté abierto, los jugadores pueden armar/editar su predicción de orden de salida. Ciérralo cuando ya no debas dejar cambios, o reinícialo (borra todas las predicciones) si necesitas que todos vuelvan a empezar de cero, por ejemplo tras una revelación grande del programa."
    ),
    h("div", {}, [lockToggleBtn, resetOraculoBtn, oraculoErr]),
  ]);

  clearAndAppend(sub, h("div", {}, [secretCard, winnerCard, oraculoCard]));
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
