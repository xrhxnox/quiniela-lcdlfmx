import { getSession, getMyProfile, logout, onAuthStateChange } from "./auth.js";
import { renderLogin } from "./views/login.js";
import { renderHome } from "./views/home.js";
import { renderRanking } from "./views/ranking.js";
import { renderEliminados } from "./views/eliminados.js";
import { renderParticipantes } from "./views/participantes.js";
import { renderAdmin } from "./views/admin.js";
import { renderProfile, renderPublicProfile, renderEditProfile } from "./views/profile.js";
import { renderReglas } from "./views/reglas.js";
import { h, clearAndAppend } from "./utils.js";
import { initAccent, syncAccentFromProfile, initThemeMode, syncThemeModeFromProfile } from "./theme.js";

initAccent();
initThemeMode();

const app = document.getElementById("app");
const appHeaderWrap = document.getElementById("appHeaderWrap");
const tabsEl = document.getElementById("tabs");
const userChip = document.getElementById("userChip");
const appFooter = document.getElementById("appFooter");

appFooter.textContent = `LCDLFMX4 · ${new Date().getFullYear()} · Designed by Rick`;

let currentProfile = null;

const ROUTES = [
  { path: "#/", label: "Votar", icon: "fa-circle-check", render: (c) => renderHome(c, currentProfile) },
  { path: "#/participantes", label: "Habitantes", icon: "fa-house", render: renderParticipantes },
  { path: "#/eliminados", label: "Eliminados", icon: "fa-trash", render: renderEliminados },
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
  const hash = location.hash || "#/";
  ROUTES.filter((r) => !r.adminOnly || currentProfile?.role === "admin").forEach((r) => {
    const isActive = hash === r.path || (r.path === "#/perfil" && hash.startsWith("#/perfil/"));
    const a = h("a", { href: r.path, class: isActive ? "active" : "" }, [
      h("i", { class: `fa-solid ${r.icon}` }),
      h("span", {}, r.label),
    ]);
    tabsEl.appendChild(a);
  });
  appHeaderWrap.style.display = "block";
  userChip.innerHTML = "";
  userChip.appendChild(h("strong", {}, currentProfile.display_name));
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
      "Salir"
    )
  );
}

async function renderRoute() {
  const hash = location.hash || "#/";
  renderNav();

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
