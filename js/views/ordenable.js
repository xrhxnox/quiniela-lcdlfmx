import { h, esc, initials, clearAndAppend } from "../utils.js";

// =========================================================
// Lista arrastrable para armar un orden de participantes.
// =========================================================
// Nació dentro de El Oráculo y ahora también la usa la semana final en Votar.
// Las dos ordenan gente, pero con sentidos opuestos: en El Oráculo la posición 1
// es el ganador, y en la final es el primero en salir. Por eso el texto de cada
// fila, el encabezado y el guardado se inyectan desde fuera; la mecánica de
// arrastrar es lo único compartido.

export function photoOrInitials(p) {
  if (p.photo_url) {
    return h("div", {
      class: "avatar-sm",
      style: `background-image:url('${esc(p.photo_url)}')`,
    });
  }
  return h("div", { class: "avatar-sm" }, initials(p.name));
}

export function renderOrderableList(container, options) {
  const {
    participants,
    existingOrder = [],
    title,
    intro = [],
    rowBadge,
    saveLabel = "Guardar mi orden",
    savedMessage = "¡Orden guardado!",
    onSave,
  } = options;

  // Se respeta lo que el jugador ya había guardado y se anexa al final a quien
  // haya entrado después (o a quien nunca ordenó).
  let order;
  if (existingOrder.length > 0) {
    order = existingOrder.map((row) => participants.find((p) => p.id === row.participant_id)).filter(Boolean);
    const orderedIds = new Set(order.map((p) => p.id));
    participants.forEach((p) => {
      if (!orderedIds.has(p.id)) order.push(p);
    });
  } else {
    order = [...participants];
  }

  const errMsg = h("div", { class: "error-msg" });
  const successMsg = h("div", { class: "success-msg" });
  const listWrap = h("div", { class: "card" });

  let dragging = null; // { fromIndex, startY, rowEl }

  function clearDragStyles(el) {
    el.style.position = "";
    el.style.zIndex = "";
    el.style.opacity = "";
    el.style.transform = "";
    el.style.boxShadow = "";
  }

  function applyDragStyles(el) {
    el.style.position = "relative";
    el.style.zIndex = "5";
    el.style.opacity = "0.9";
    el.style.boxShadow = "0 6px 18px rgba(0,0,0,0.35)";
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const deltaY = e.clientY - dragging.startY;
    dragging.rowEl.style.transform = `translateY(${deltaY}px)`;

    const rowsEls = [...listWrap.firstElementChild.children];
    const hoveredIndex = rowsEls.findIndex((el) => {
      if (el === dragging.rowEl) return false;
      const rect = el.getBoundingClientRect();
      return e.clientY >= rect.top && e.clientY <= rect.bottom;
    });
    if (hoveredIndex !== -1 && hoveredIndex !== dragging.fromIndex) {
      const [moved] = order.splice(dragging.fromIndex, 1);
      order.splice(hoveredIndex, 0, moved);
      dragging.fromIndex = hoveredIndex;
      dragging.startY = e.clientY;
      renderList(hoveredIndex);
    }
  }

  function onPointerUp() {
    if (dragging) clearDragStyles(dragging.rowEl);
    dragging = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
  }

  function renderList(reacquireIndex) {
    const rows = order.map((p, i) => {
      const handle = h("i", {
        class: "fa-solid fa-grip-lines",
        style: "cursor:grab;color:var(--text-dim);padding:4px 10px;touch-action:none",
      });
      const rowEl = h("div", { class: "list-item" }, [
        h("div", { class: "row-flex" }, [
          handle,
          h("strong", { style: "min-width:1.6em;display:inline-block" }, `${String(i + 1).padStart(2, "0")}.`),
          rowBadge(i, order.length),
          photoOrInitials(p),
          p.name,
        ]),
      ]);

      handle.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        dragging = { fromIndex: i, startY: e.clientY, rowEl };
        applyDragStyles(rowEl);
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
        window.addEventListener("pointercancel", onPointerUp);
      });

      if (dragging && reacquireIndex === i) {
        dragging.rowEl = rowEl;
        applyDragStyles(rowEl);
      }

      return rowEl;
    });
    clearAndAppend(listWrap, h("div", {}, rows));
  }
  renderList();

  const saveBtn = h(
    "button",
    {
      class: "btn",
      onclick: async () => {
        errMsg.textContent = "";
        successMsg.textContent = "";
        saveBtn.disabled = true;
        saveBtn.textContent = "Guardando…";
        try {
          await onSave(order.map((p) => p.id));
          successMsg.textContent = savedMessage;
        } catch (e) {
          errMsg.textContent = "No se pudo guardar. " + (e.message || "Intenta de nuevo.");
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = saveLabel;
        }
      },
    },
    saveLabel
  );

  clearAndAppend(
    container,
    h("div", {}, [
      h("div", { class: "section-title" }, title),
      h("div", { class: "card" }, [
        ...intro,
        h("p", { class: "muted", style: "font-size:0.82rem;margin-bottom:0" }, [
          h("i", { class: "fa-solid fa-grip-lines" }),
          " Arrastra desde el ícono para reordenar.",
        ]),
      ]),
      listWrap,
      h("div", { style: "margin-top:16px;display:flex;gap:10px;align-items:center" }, [saveBtn, successMsg, errMsg]),
    ])
  );
}
