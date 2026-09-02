import { getSession, getMyProfile, logout, onAuthStateChange } from "./auth.js";
import { getVotingWeek, getMyPrediction } from "./data.js";
import { renderLogin } from "./views/login.js";
import { renderHome } from "./views/home.js";
import { renderRanking } from "./views/ranking.js";
import { renderEliminados } from "./views/eliminados.js";
import { renderParticipantes } from "./views/participantes.js";
import { renderHabitante } from "./views/habitante.js";
import { renderAdmin } from "./views/admin.js";
import { renderProfile, renderPublicProfile, renderEditProfile } from "./views/profile.js";
import { renderReglas } from "./views/reglas.js";
import { renderOrdenSalida } from "./views/orden.js";
import { renderJugadores } from "./views/jugadores.js";
import { h, clearAndAppend } from "./utils.js";
import { initAccent, syncAccentFromProfile, initThemeMode, syncThemeModeFromProfile } from "./theme.js";
import { SHOWS, getShow, getShowKey, setShow } from "./shows.js";

initAccent();
initThemeMode();

const app = document.getElementById("app");
const appHeaderWrap = document.getElementById("appHeaderWrap");
const tabsEl = document.getElementById("tabs");
const userChip = document.getElementById("userChip");
const appFooter = document.getElementById("appFooter");
const showSwitchEl = document.getElementById("showSwitch");
const brandLogoEl = document.getElementById("brandLogo");

// Antes de iniciar sesión todavía no hay show elegido, así que la marca que
// se muestra es la de la app entera y no la de uno de los dos programas.
const APP_IDENTITY = {
  key: null,
  label: "TrashTV App",
  title: "TrashTV App",
  logo: "assets/logo-app.png",
};

function showIdentity() {
  const show = getShow();
  return { key: show.key, label: show.label, title: `Quiniela ${show.label}`, logo: show.logo };
}

// Marca visible: logo de la barra, título de la pestaña y pie. El favicon no
// entra: es el de la app y se queda fijo en el HTML.
function applyIdentity(identity) {
  // data-show cambia fondos y tipografía de títulos desde el CSS. El color de
  // acento no vive aquí: lo elige el jugador, y cada show guarda el suyo.
  if (identity.key) document.documentElement.setAttribute("data-show", identity.key);
  else document.documentElement.removeAttribute("data-show");
  if (brandLogoEl) {
    brandLogoEl.src = identity.logo;
    brandLogoEl.alt = identity.label;
  }
  document.title = identity.title;
  appFooter.textContent = `${identity.label} · ${new Date().getFullYear()} · Designed by Rick`;
}

applyIdentity(APP_IDENTITY);

// Botón que salta al OTRO show. No hay dos links: el show activo se guarda por
// navegador, así que el mismo URL abre el último que cada quien haya visto.
function renderShowSwitch() {
  const other = getShowKey() === "casa" ? SHOWS.granja : SHOWS.casa;
  showSwitchEl.innerHTML = "";
  showSwitchEl.appendChild(
    h(
      "button",
      {
        class: "btn small secondary",
        title: `Cambiar a ${other.label}`,
        onclick: () => {
          if (!setShow(other.key)) return;
          // El color es por show: al saltar se repinta con el del show al que
          // llegas (el guardado en el perfil, o el de arranque si no eligió).
          syncAccentFromProfile(currentProfile);
          applyIdentity(showIdentity());
          // Vuelve al inicio a propósito: una ruta como #/habitante/5 apunta a
          // un id que en el otro show es otra persona.
          if (location.hash && location.hash !== "#/") location.hash = "#/";
          else renderRoute();
        },
      },
      [h("i", { class: `fa-solid ${other.icon}` }), " IR A " + other.short]
    )
  );
}

let currentProfile = null;

const ROUTES = [
  { path: "#/", label: "Votar", icon: "fa-circle-check", render: (c) => renderHome(c, currentProfile) },
  { path: "#/participantes", label: "Habitantes", icon: "fa-house", render: renderParticipantes },
  { path: "#/eliminados", label: "Eliminados", icon: "fa-trash", render: renderEliminados },
  { path: "#/orden", label: "El Oráculo", icon: "fa-hat-wizard", render: (c) => renderOrdenSalida(c, currentProfile) },
  { path: "#/jugadores", label: "Jugadores", icon: "fa-users", render: renderJugadores },
  { path: "#/ranking", label: "Ranking", icon: "fa-trophy", render: renderRanking },
  { path: "#/reglas", label: "Reglas", icon: "fa-scroll", render: renderReglas },
  {
    path: "#/perfil",
    label: "Mi Perfil",
    icon: "fa-user",
    render: (c) => renderProfile(c, currentProfile),
  },
  {
    path: "#/editar-perfil",
    label: "Editar Perfil",
    icon: "fa-pen-to-square",
    render: (c) =>
      renderEditProfile(c, currentProfile, (updated) => {
        currentProfile = { ...currentProfile, ...updated };
        renderNav();
      }),
  },
  { path: "#/admin", label: "Admin", icon: "fa-gear", render: renderAdmin, adminOnly: true },
];

function renderNav() {
  tabsEl.innerHTML = "";
  // Ya hay sesión: a partir de aquí manda la marca del show activo.
  applyIdentity(showIdentity());
  renderShowSwitch();
  const show = getShow();
  const hash = location.hash || "#/";
  ROUTES.filter((r) => !r.adminOnly || currentProfile?.role === "admin").forEach((r) => {
    const isActive =
      hash === r.path ||
      (r.path === "#/perfil" && hash.startsWith("#/perfil/")) ||
      (r.path === "#/participantes" && hash.startsWith("#/habitante/"));
    // "Habitantes" en La Casa, "Granjeros" en La Granja.
    const label = r.path === "#/participantes" ? show.memberPlural : r.label;
    const icon = r.path === "#/participantes" ? show.icon : r.icon;
    const a = h("a", { href: r.path, class: isActive ? "active" : "" }, [
      h("i", { class: `fa-solid ${icon}` }),
      h("span", {}, label),
    ]);
    tabsEl.appendChild(a);
  });
  appHeaderWrap.style.display = "block";
  userChip.innerHTML = "";
  const voteDot = h("span", {
    class: "pulse-dot",
    title: "Comprobando tu voto…",
    style: "width:9px;height:9px;border-radius:50%;background:var(--line);",
  });
  userChip.appendChild(
    h("span", { class: "username-badge" }, [h("i", { class: "fa-solid fa-user" }), currentProfile.display_name, voteDot])
  );
  userChip.appendChild(
    h(
      "button",
      {
        class: "btn-logout",
        onclick: async () => {
          await logout();
          location.hash = "#/";
          location.reload();
        },
      },
      [h("i", { class: "fa-solid fa-right-from-bracket" }), " Salir"]
    )
  );
  updateMyVoteDot(voteDot);
}

async function updateMyVoteDot(dot) {
  try {
    const votingWeek = await getVotingWeek();
    const myPred = votingWeek ? await getMyPrediction(votingWeek.id, currentProfile.id) : null;
    const color = !votingWeek ? "#e8c05a" : myPred ? "var(--green)" : "var(--red)";
    const title = !votingWeek ? "Aún no hay votación abierta" : myPred ? "Ya votaste esta semana" : "Todavía no has votado esta semana";
    if (!dot.isConnected) return;
    dot.style.background = color;
    dot.title = title;
  } catch (e) {
    console.error(e);
  }
}

async function renderRoute() {
  const hash = location.hash || "#/";
  renderNav();

  if (hash.startsWith("#/habitante/")) {
    const participantId = decodeURIComponent(hash.slice("#/habitante/".length));
    try {
      await renderHabitante(app, participantId);
    } catch (e) {
      console.error(e);
      clearAndAppend(app, h("div", { class: "empty-state" }, "Ocurrió un error cargando este habitante."));
    }
    app.classList.remove("fade-in");
    void app.offsetWidth;
    app.classList.add("fade-in");
    return;
  }

  if (hash.startsWith("#/perfil/")) {
    const username = decodeURIComponent(hash.slice("#/perfil/".length));
    try {
      await renderPublicProfile(app, username);
    } catch (e) {
      console.error(e);
      clearAndAppend(app, h("div", { class: "empty-state" }, "Ocurrió un error cargando este perfil."));
    }
    app.classList.remove("fade-in");
    void app.offsetWidth;
    app.classList.add("fade-in");
    return;
  }

  const route = ROUTES.find((r) => r.path === hash) || ROUTES[0];
  if (route.adminOnly && currentProfile?.role !== "admin") {
    clearAndAppend(app, h("div", { class: "empty-state" }, "No tienes permiso para ver esta sección."));
    return;
  }
  try {
    await route.render(app);
  } catch (e) {
    console.error(e);
    clearAndAppend(app, h("div", { class: "empty-state" }, "Ocurrió un error cargando esta sección. Intenta recargar la página."));
  }
  app.classList.remove("fade-in");
  void app.offsetWidth;
  app.classList.add("fade-in");
}

async function boot() {
  const session = await getSession();
  if (!session) {
    appHeaderWrap.style.display = "none";
    applyIdentity(APP_IDENTITY);
    renderLogin(app, async () => {
      currentProfile = await getMyProfile();
      syncAccentFromProfile(currentProfile);
      syncThemeModeFromProfile(currentProfile);
      await renderRoute();
    });
    return;
  }
  currentProfile = await getMyProfile();
  syncAccentFromProfile(currentProfile);
  syncThemeModeFromProfile(currentProfile);
  await renderRoute();
}

window.addEventListener("hashchange", renderRoute);

onAuthStateChange((session) => {
  if (!session) {
    currentProfile = null;
    boot();
  }
});

boot();
