import { getLeaderboard, getAllProfiles, getAllEliminationOrders, getSecretAssignments, getVotingWeek, getVotedPlayerIds } from "../data.js";
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

function pickLine(icon, participant) {
  return h("div", { class: "muted", style: "font-size:0.72rem;margin-top:6px;display:flex;align-items:center;justify-content:center;gap:5px" }, [
    h("i", { class: `fa-solid ${icon}` }),
    h("strong", { style: "color:var(--text)" }, participant?.name || "Sin definir"),
  ]);
}

export async function renderJugadores(container) {
  clearAndAppend(container, h("div", { class: "loading" }, "Cargando…"));
  const [leaderboard, profiles, allOrders, assignments, votingWeek] = await Promise.all([
    getLeaderboard(),
    getAllProfiles(),
    getAllEliminationOrders(),
    getSecretAssignments(),
    getVotingWeek(),
  ]);
  const votedIds = votingWeek ? await getVotedPlayerIds(votingWeek.id) : null;

  if (leaderboard.length === 0) {
    clearAndAppend(container, h("div", { class: "empty-state" }, "Aún no hay jugadores registrados."));
    return;
  }

  const profileMap = {};
  profiles.forEach((p) => (profileMap[p.id] = p));

  const winnerPickMap = {};
  allOrders.forEach((row) => {
    if (row.position === 1) winnerPickMap[row.player_id] = row.participants;
  });

  const secretMap = {};
  assignments.forEach((a) => (secretMap[a.player_id] = a.participants));

  const cards = leaderboard.map((r, i) => {
    const profile = profileMap[r.player_id];
    const voteDotColor = !votingWeek ? "#e8c05a" : votedIds.has(r.player_id) ? "var(--green)" : "var(--red)";
    const voteDotTitle = !votingWeek ? "Aún no hay votación abierta" : votedIds.has(r.player_id) ? "Ya votó esta semana" : "Todavía no vota esta semana";
    return h("div", { class: "card player-card", style: "text-align:center;position:relative" }, [
      h("span", {
        title: voteDotTitle,
        style: `position:absolute;top:10px;right:10px;width:14px;height:14px;border-radius:50%;background:${voteDotColor};border:2px solid var(--bg-card);`,
      }),
      playerAvatar(profile, 84),
      h("div", { style: "margin-top:10px;font-weight:700" }, r.display_name),
      h("div", { class: "muted", style: "font-size:0.8rem;margin-top:2px" }, [
        i === 0 ? h("i", { class: "fa-solid fa-crown", style: "color:var(--gold)" }) : `#${i + 1}`,
        ` · ${r.points} pts`,
      ]),
      pickLine("fa-crown", winnerPickMap[r.player_id]),
      pickLine("fa-shuffle", secretMap[r.player_id]),
      h(
        "a",
        { href: `#/perfil/${encodeURIComponent(r.username)}`, class: "btn small", style: "margin-top:10px;display:inline-block" },
        "Ver perfil"
      ),
    ]);
  });

  clearAndAppend(
    container,
    h("div", {}, [h("div", { class: "section-title" }, "Jugadores"), h("div", { class: "grid" }, cards)])
  );
}
