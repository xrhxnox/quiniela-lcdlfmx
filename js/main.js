import { getSession, getMyProfile, logout, onAuthStateChange } from "./auth.js";
import { updateMyProfile } from "./data.js";
import { renderLogin } from "./views/login.js";
import { renderHome } from "./views/home.js";
import { renderRanking } from "./views/ranking.js";
import { renderEliminados } from "./views/eliminados.js";
import { renderParticipantes } from "./views/participantes.js";
import { renderAdmin } from "./views/admin.js";
import { renderProfile } from "./views/profile.js";
import { h, clearAndAppend } from "./utils.js";
import { ACCENTS, getAccentKey, applyAccent, initAccent, syncAccentFromProfile } from "./theme.js";

initAccent();

const app = document.getElementById("app");
const appHeaderWrap = document.getElementById("appHeaderWrap");
const tabsEl = document.getElementById("tabs");
const userChip = document.getElementById("userChip");
const appFooter = document.getElementById("appFooter");

appFooter.textContent = `LCDLFMX4 · ${new Date().getFullYear()} · Designed by Rick`;

let currentProfile = null;

const ROUTES = [
  { path: "#/", label: "Votar", icon: "fa-square-poll-vertical", render: (c) => renderHome(c, currentProfile) },
  { path: "#/ranking", label: "Ranking", icon: "fa-trophy", render: renderRanking },
  { path: "#/eliminados", label: "Eliminados", icon: "fa-door-open", render: renderEliminados },
  { path: "#/participantes", label: "Participantes", icon: "fa-house", render: renderParticipantes },
  {
    path: "#/perfil",
    label: "Mi Perfil",
    icon: "fa-user",
    render: (c) =>
      renderProfile(c, currentProfile, (updated) => {
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
    const a = h("a", { href: r.path, class: hash === r.path ? "active" : "" }, [
      h("i", { class: `fa-solid ${r.icon}` }),
      h("span", {}, r.label),
    ]);
    tabsEl.appendChild(a);
  });
  appHeaderWrap.style.display = "block";
  userChip.innerHTML = "";
  const swatchWrap = h("div", { class: "swatches" });
  Object.entries(ACCENTS).forEach(([key, theme]) => {
    swatchWrap.appendChild(
      h("button", {
        class: `swatch${getAccentKey() === key ? " active" : ""}`,
        style: `background:${theme.accent}`,
        title: theme.label,
        type: "button",
        onclick: async () => {
          applyAccent(key);
          renderNav();
          try {
            const updated = await updateMyProfile({ accent_color: key });
            currentProfile = { ...currentProfile, ...updated };
          } catch (e) {
            /* el color ya se aplicó localmente aunque falle guardarlo */
          }
        },
      })
    );
  });
  userChip.appendChild(swatchWrap);
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
  const route = ROUTES.find((r) => r.path === hash) || ROUTES[0];
  if (route.adminOnly && currentProfile?.role !== "admin") {
    clearAndAppend(app, h("div", { class: "empty-state" }, "No tienes permiso para ver esta sección."));
    return;
  }
  renderNav();
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
      await renderRoute();
    });
    return;
  }
  currentProfile = await getMyProfile();
  syncAccentFromProfile(currentProfile);
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
