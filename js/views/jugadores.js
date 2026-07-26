import { getLeaderboard, getAllProfiles } from "../data.js";
import { ACCENTS } from "../theme.js";
import { h, esc, clearAndAppend } from "../utils.js";

function playerAvatar(profile, size) {
  const style = `width:${size}px;height:${size}px;border-radius:50%;flex-shrink:0;border:3px solid var(--line);margin:0 auto;`;
  if (profile?.avatar_url) {
    return h("div", { style: `${style}background:var(--bg-elev) url('${esc(profile.avatar_url)}') center/cover no-repeat;` });
  }
  const theme = ACCENTS[profile?.accent_color] || ACCENTS.rojo;
  return h(
    "div",
    {
      style: `${style}display:flex;align-items:center;justify-content:center;background:${theme.accent};color:${theme.text};font-weight:800;font-size:${size * 0.4}px;font-family:var(--font-display)`,
    },
    (profile?.display_name || "?")[0].toUpperCase()
  );
}

export async function renderJugadores(container) {
  clearAndAppend(container, h("div", { class: "loading" }, "Cargando…"));
  const [leaderboard, profiles] = await Promise.all([getLeaderboard(), getAllProfiles()]);

  if (leaderboard.length === 0) {
    clearAndAppend(container, h("div", { class: "empty-state" }, "Aún no hay jugadores registrados."));
    return;
  }

  const profileMap = {};
  profiles.forEach((p) => (profileMap[p.id] = p));

  const cards = leaderboard.map((r, i) => {
    const profile = profileMap[r.player_id];
    return h("div", { class: "card", style: "text-align:center" }, [
      playerAvatar(profile, 84),
      h("div", { style: "margin-top:10px;font-weight:700" }, r.display_name),
      h("div", { class: "muted", style: "font-size:0.8rem;margin-top:2px" }, [
        i === 0 ? h("i", { class: "fa-solid fa-crown", style: "color:var(--gold)" }) : `#${i + 1}`,
        ` · ${r.points} pts`,
      ]),
      h(
        "a",
        { href: `#/perfil/${encodeURIComponent(r.username)}`, class: "btn small", style: "margin-top:10px;display:inline-block" },
        "Ver perfil"
      ),
    ]);
  });

  clearAndAppend(
    container,
    h("div", {}, [h("div", { class: "section-title" }, "Participantes"), h("div", { class: "grid" }, cards)])
  );
}
