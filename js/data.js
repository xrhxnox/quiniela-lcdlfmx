import { supabase } from "./supabaseClient.js";
import { compressImage } from "./utils.js";
import { tbl } from "./shows.js";

// Al embeber una tabla, PostgREST necesita su nombre real (granja_participants),
// pero todas las vistas leen row.participants y row.weeks. El alias deja el
// prefijo del lado de la consulta y la respuesta conserva la misma forma en los
// dos shows: emb("participants", "*") -> "participants:granja_participants(*)".
const emb = (name, cols) => `${name}:${tbl(name)}(${cols})`;

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

// ---------- Participants ----------
export async function getParticipants({ activeOnly = false } = {}) {
  let q = supabase.from(tbl("participants")).select("*").order("name");
  if (activeOnly) q = q.eq("active", true);
  return unwrap(await q);
}

export async function createParticipant({ name, room, photo_url }) {
  return unwrap(
    await supabase.from(tbl("participants")).insert({ name, room, photo_url }).select().single()
  );
}

export async function updateParticipant(id, fields) {
  return unwrap(await supabase.from(tbl("participants")).update(fields).eq("id", id).select().single());
}

export async function deleteParticipant(id) {
  return unwrap(await supabase.from(tbl("participants")).delete().eq("id", id));
}

export async function uploadParticipantPhoto(file) {
  const compressed = await compressImage(file);
  const path = `${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from("photos").upload(path, compressed, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("photos").getPublicUrl(path);
  return data.publicUrl;
}

// ---------- Favoritos de temporadas anteriores (no son habitantes actuales) ----------
export async function getLegacyFavorites({ season } = {}) {
  let q = supabase.from(tbl("legacy_favorites")).select("*").order("name");
  if (season) q = q.eq("season", season);
  return unwrap(await q);
}

export async function createLegacyFavorite({ season, name, photo_url }) {
  return unwrap(await supabase.from(tbl("legacy_favorites")).insert({ season, name, photo_url }).select().single());
}

export async function updateLegacyFavorite(id, fields) {
  return unwrap(await supabase.from(tbl("legacy_favorites")).update(fields).eq("id", id).select().single());
}

export async function deleteLegacyFavorite(id) {
  return unwrap(await supabase.from(tbl("legacy_favorites")).delete().eq("id", id));
}

export async function getNominationCounts() {
  const rows = unwrap(await supabase.from(tbl("nomination_counts")).select("*"));
  const map = {};
  rows.forEach((r) => (map[r.participant_id] = r.times_nominated));
  return map;
}

export async function getImmunityCounts() {
  const rows = unwrap(await supabase.from(tbl("immunity_counts")).select("*"));
  const map = {};
  rows.forEach((r) => (map[r.participant_id] = r.times_leader));
  return map;
}

export async function getSpecialImmunityCounts() {
  const rows = unwrap(await supabase.from(tbl("special_immunity_counts")).select("*"));
  const map = {};
  rows.forEach((r) => (map[r.participant_id] = r.times_immune));
  return map;
}

export async function getSavedCounts() {
  const rows = unwrap(await supabase.from(tbl("saved_counts")).select("*"));
  const map = {};
  rows.forEach((r) => (map[r.participant_id] = r.times_saved));
  return map;
}

// Los picks de perfil (favorito, funado, sorpresa, decepción) son de La Casa
// y viven en columnas de profiles que apuntan a participants. Por eso se leen
// siempre contra esa tabla, aunque el usuario esté viendo La Granja; si no,
// un id de La Casa se resolvería contra un granjero distinto con el mismo id.
export async function getCasaParticipants() {
  return unwrap(await supabase.from("participants").select("*").order("name"));
}

// Picks de perfil de La Granja. Van por su propia función porque
// update_my_profile es de La Casa y ya carga 46 parámetros.
export async function updateMyGranjaPicks({
  favorite,
  hated,
  surprise,
  disappointment,
  favS1,
  hatedS1,
  surpriseS1,
  disappointmentS1,
}) {
  const { data, error } = await supabase.rpc("update_my_granja_picks", {
    p_favorite: favorite ?? null,
    p_clear_favorite: favorite === null,
    p_hated: hated ?? null,
    p_clear_hated: hated === null,
    p_surprise: surprise ?? null,
    p_clear_surprise: surprise === null,
    p_disappointment: disappointment ?? null,
    p_clear_disappointment: disappointment === null,
    p_fav_s1: favS1 ?? null,
    p_clear_fav_s1: favS1 === null,
    p_hated_s1: hatedS1 ?? null,
    p_clear_hated_s1: hatedS1 === null,
    p_surprise_s1: surpriseS1 ?? null,
    p_clear_surprise_s1: surpriseS1 === null,
    p_disappointment_s1: disappointmentS1 ?? null,
    p_clear_disappointment_s1: disappointmentS1 === null,
  });
  if (error) throw error;
  return data;
}

// ---------- Dinámicas propias de La Granja ----------
// Duelo, traición y El Legado solo existen en La Granja, así que las tablas se
// nombran directo (sin pasar por tbl()) y estas funciones solo deben llamarse
// cuando el show activo es ese.
// Peones de una semana. Como el exilio en La Casa, agregar a alguien también
// prende su bandera global is_peon (la que pinta la insignia). Quitarlo de la
// lista NO la apaga: fue peón esa semana aunque hoy ya no lo sea, y el estado
// de hoy se maneja desde la pestaña de Granjeros.
export async function getPeonesForWeek(weekId) {
  return unwrap(
    await supabase
      .from("granja_peones")
      .select(`week_id, participant_id, ${emb("participants", "*")}`)
      .eq("week_id", weekId)
  );
}

export async function addPeon(weekId, participantId) {
  const row = unwrap(
    await supabase.from("granja_peones").insert({ week_id: weekId, participant_id: participantId }).select()
  );
  unwrap(await supabase.from("granja_participants").update({ is_peon: true }).eq("id", participantId).select());
  return row;
}

export async function removePeon(weekId, participantId) {
  return unwrap(
    await supabase.from("granja_peones").delete().eq("week_id", weekId).eq("participant_id", participantId)
  );
}

export async function getGranjaWeekDynamics(weekId) {
  const [duel, betrayal, legacy] = await Promise.all([
    supabase.from("granja_duels").select("*").eq("week_id", weekId).maybeSingle(),
    supabase.from("granja_betrayals").select("*").eq("week_id", weekId).maybeSingle(),
    supabase.from("granja_legacies").select("*").eq("week_id", weekId).maybeSingle(),
  ]);
  if (duel.error) throw duel.error;
  if (betrayal.error) throw betrayal.error;
  if (legacy.error) throw legacy.error;
  return { duel: duel.data, betrayal: betrayal.data, legacy: legacy.data };
}

// Todas las dinámicas de todas las semanas, para pintarlas en la ficha del
// granjero y en el historial sin una consulta por semana.
export async function getAllGranjaDynamics() {
  const [duels, betrayals, legacies, peones] = await Promise.all([
    supabase.from("granja_duels").select("*"),
    supabase.from("granja_betrayals").select("*"),
    supabase.from("granja_legacies").select("*"),
    supabase.from("granja_peones").select("week_id, participant_id"),
  ]);
  return {
    duels: unwrap(duels),
    betrayals: unwrap(betrayals),
    legacies: unwrap(legacies),
    peones: unwrap(peones),
  };
}

// El perdedor del duelo "sale nominado directamente", así que al guardarlo se
// agrega solo a la lista de nominados de esa semana. Borrar el duelo no lo
// quita: para eso está la ✕ de Nominados.
export async function saveGranjaDuel(weekId, { participant_a_id, participant_b_id, loser_id }) {
  const row = unwrap(
    await supabase
      .from("granja_duels")
      .upsert({ week_id: weekId, participant_a_id, participant_b_id, loser_id })
      .select()
      .single()
  );
  if (loser_id) {
    await supabase
      .from("granja_nominations")
      .upsert({ week_id: weekId, participant_id: loser_id }, { onConflict: "week_id,participant_id", ignoreDuplicates: true });
  }
  return row;
}

export async function removeGranjaDuel(weekId) {
  return unwrap(await supabase.from("granja_duels").delete().eq("week_id", weekId));
}

// La traición intercambia de verdad: el de out sale de nominados y el de in
// entra. Igual que el duelo, deshacer el registro no revierte las listas.
export async function saveGranjaBetrayal(weekId, { traitor_id, out_participant_id, in_participant_id }) {
  const row = unwrap(
    await supabase
      .from("granja_betrayals")
      .upsert({ week_id: weekId, traitor_id, out_participant_id, in_participant_id })
      .select()
      .single()
  );
  await supabase.from("granja_nominations").delete().eq("week_id", weekId).eq("participant_id", out_participant_id);
  await supabase
    .from("granja_nominations")
    .upsert({ week_id: weekId, participant_id: in_participant_id }, { onConflict: "week_id,participant_id", ignoreDuplicates: true });
  return row;
}

export async function removeGranjaBetrayal(weekId) {
  return unwrap(await supabase.from("granja_betrayals").delete().eq("week_id", weekId));
}

// El Legado se guarda en la semana en que el granjero SALIÓ, pero su efecto cae
// en la siguiente, así que aquí no se toca ninguna lista de nominados: el admin
// nomina a esa persona cuando arme la semana que sigue.
export async function saveGranjaLegacy(weekId, { from_participant_id, to_participant_id }) {
  return unwrap(
    await supabase
      .from("granja_legacies")
      .upsert({ week_id: weekId, from_participant_id, to_participant_id })
      .select()
      .single()
  );
}

export async function removeGranjaLegacy(weekId) {
  return unwrap(await supabase.from("granja_legacies").delete().eq("week_id", weekId));
}

// ---------- Historial de un habitante ----------
// Todo lo que le pasó semana por semana. Devuelve filas crudas con ids; la
// vista resuelve los nombres contra la lista de participantes que ya carga,
// para no depender de los nombres de las llaves foráneas al hacer el embed
// (nomination_votes apunta dos veces a participants y PostgREST necesitaría
// una pista distinta para cada lado).
export async function getParticipantHistory(participantId) {
  const [nominations, immunities, eliminations, exiles, votesCast, votesReceived] = await Promise.all([
    supabase.from(tbl("nominations")).select("week_id, points, saved").eq("participant_id", participantId),
    supabase.from(tbl("immunities")).select("week_id, is_leader").eq("participant_id", participantId),
    supabase.from(tbl("eliminations")).select("week_id, reverted_by_exile, gift_all").eq("participant_id", participantId),
    supabase.from(tbl("exiles")).select("week_id").eq("participant_id", participantId),
    supabase.from(tbl("nomination_votes")).select("week_id, nominee_id").eq("nominator_id", participantId),
    supabase.from(tbl("nomination_votes")).select("week_id, nominator_id").eq("nominee_id", participantId),
  ]);
  return {
    nominations: unwrap(nominations),
    immunities: unwrap(immunities),
    eliminations: unwrap(eliminations),
    exiles: unwrap(exiles),
    votesCast: unwrap(votesCast),
    votesReceived: unwrap(votesReceived),
  };
}

// ---------- Weeks ----------
export async function getWeeks() {
  return unwrap(await supabase.from(tbl("weeks")).select("*").order("week_number", { ascending: false }));
}

export async function getVotingWeek() {
  const rows = unwrap(
    await supabase
      .from(tbl("weeks"))
      .select("*")
      .eq("status", "voting_open")
      .order("week_number", { ascending: false })
      .limit(1)
  );
  return rows[0] || null;
}

export async function getLatestClosedWeek() {
  const rows = unwrap(
    await supabase
      .from(tbl("weeks"))
      .select("*")
      .eq("status", "closed")
      .order("week_number", { ascending: false })
      .limit(1)
  );
  return rows[0] || null;
}

export async function createWeek({ week_number, label, nomination_date, elimination_date }) {
  return unwrap(
    await supabase
      .from(tbl("weeks"))
      .insert({ week_number, label, nomination_date, elimination_date })
      .select()
      .single()
  );
}

export async function updateWeek(id, fields) {
  return unwrap(await supabase.from(tbl("weeks")).update(fields).eq("id", id).select().single());
}

export async function deleteWeek(id) {
  return unwrap(await supabase.from(tbl("weeks")).delete().eq("id", id));
}

// ---------- Nominations ----------
export async function getNominationsForWeek(weekId) {
  return unwrap(
    await supabase
      .from(tbl("nominations"))
      .select(`week_id, participant_id, points, saved, ${emb("participants", "*")}`)
      .eq("week_id", weekId)
      .order("points", { ascending: false })
  );
}

export async function setNomination(weekId, participantId, points) {
  return unwrap(
    await supabase
      .from(tbl("nominations"))
      .upsert({ week_id: weekId, participant_id: participantId, points })
      .select()
      .single()
  );
}

export async function setNominationSaved(weekId, participantId, saved) {
  return unwrap(
    await supabase
      .from(tbl("nominations"))
      .update({ saved })
      .eq("week_id", weekId)
      .eq("participant_id", participantId)
      .select()
      .single()
  );
}

export async function removeNomination(weekId, participantId) {
  return unwrap(
    await supabase.from(tbl("nominations")).delete().eq("week_id", weekId).eq("participant_id", participantId)
  );
}

// ---------- Quién nominó a quién ----------
export async function getNominationVotesForWeek(weekId) {
  return unwrap(
    await supabase.from(tbl("nomination_votes")).select("week_id, nominator_id, nominee_id").eq("week_id", weekId)
  );
}

export async function addNominationVote(weekId, nominatorId, nomineeId) {
  return unwrap(
    await supabase.from(tbl("nomination_votes")).insert({ week_id: weekId, nominator_id: nominatorId, nominee_id: nomineeId }).select()
  );
}

export async function removeNominationVote(weekId, nominatorId, nomineeId) {
  return unwrap(
    await supabase
      .from(tbl("nomination_votes"))
      .delete()
      .eq("week_id", weekId)
      .eq("nominator_id", nominatorId)
      .eq("nominee_id", nomineeId)
  );
}

// ---------- Immunities ----------
export async function getImmunitiesForWeek(weekId) {
  return unwrap(
    await supabase.from(tbl("immunities")).select(`week_id, participant_id, is_leader, ${emb("participants", "*")}`).eq("week_id", weekId)
  );
}

export async function addImmunity(weekId, participantId, isLeader = false) {
  return unwrap(
    await supabase.from(tbl("immunities")).insert({ week_id: weekId, participant_id: participantId, is_leader: isLeader })
  );
}

export async function removeImmunity(weekId, participantId) {
  return unwrap(
    await supabase.from(tbl("immunities")).delete().eq("week_id", weekId).eq("participant_id", participantId)
  );
}

// ---------- Exilio (por semana) ----------
export async function getExilesForWeek(weekId) {
  return unwrap(
    await supabase.from(tbl("exiles")).select(`week_id, participant_id, ${emb("participants", "*")}`).eq("week_id", weekId)
  );
}

// Mandar a alguien al exilio también prende su flag global is_exiliado, que es
// el que pinta la insignia en Habitantes. Quitarlo de la lista NO lo apaga: ya
// pasó por el exilio y puede haber vuelto a la casa; ese estado se maneja a
// mano desde la pestaña de Habitantes.
export async function addExile(weekId, participantId) {
  const row = unwrap(await supabase.from(tbl("exiles")).insert({ week_id: weekId, participant_id: participantId }).select());
  // Va con unwrap a propósito: si esta escritura falla (RLS, id inválido) tiene
  // que reventar y verse, no quedarse callada dejando el flag desincronizado.
  unwrap(await supabase.from(tbl("participants")).update({ is_exiliado: true }).eq("id", participantId).select());
  return row;
}

export async function removeExile(weekId, participantId) {
  return unwrap(await supabase.from(tbl("exiles")).delete().eq("week_id", weekId).eq("participant_id", participantId));
}

// ---------- Eliminations ----------
export async function getEliminationsForWeek(weekId) {
  return unwrap(
    await supabase
      .from(tbl("eliminations"))
      .select(`week_id, participant_id, reverted_by_exile, gift_all, ${emb("participants", "*")}`)
      .eq("week_id", weekId)
  );
}

export async function getAllEliminationsWithWeeks() {
  return unwrap(
    await supabase
      .from(tbl("eliminations"))
      .select(`week_id, participant_id, reverted_by_exile, gift_all, ${emb("participants", "*")}, ${emb("weeks", "*")}`)
      .order("week_id", { ascending: false })
  );
}

// Marca cómo cuenta esta eliminación para El Oráculo (el pick semanal no cambia).
export async function setEliminationOraculoMode(weekId, participantId, { reverted_by_exile, gift_all }) {
  return unwrap(
    await supabase
      .from(tbl("eliminations"))
      .update({ reverted_by_exile, gift_all })
      .eq("week_id", weekId)
      .eq("participant_id", participantId)
      .select()
  );
}

export async function confirmEliminations(weekId, participantIds) {
  await supabase.from(tbl("eliminations")).delete().eq("week_id", weekId);
  if (participantIds.length > 0) {
    unwrap(
      await supabase
        .from(tbl("eliminations"))
        .insert(participantIds.map((pid) => ({ week_id: weekId, participant_id: pid })))
    );
  }
  await supabase.from(tbl("participants")).update({ active: false }).in("id", participantIds);
  return unwrap(await supabase.from(tbl("weeks")).update({ status: "closed" }).eq("id", weekId).select().single());
}

// ---------- Predictions ----------
export async function getMyPrediction(weekId, playerId) {
  const { data, error } = await supabase
    .from(tbl("predictions"))
    .select("*")
    .eq("week_id", weekId)
    .eq("player_id", playerId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function submitPrediction(weekId, playerId, participantId) {
  return unwrap(
    await supabase
      .from(tbl("predictions"))
      .upsert({ week_id: weekId, player_id: playerId, participant_id: participantId, updated_at: new Date().toISOString() })
      .select()
      .single()
  );
}

export async function getPredictionsForWeek(weekId) {
  return unwrap(
    await supabase.from(tbl("predictions")).select("*, profiles(display_name, username)").eq("week_id", weekId)
  );
}

export async function getVotedPlayerIds(weekId) {
  const { data, error } = await supabase.rpc(tbl("get_voted_player_ids"), { p_week_id: weekId });
  if (error) throw error;
  return new Set(data.map((r) => r.player_id));
}

// ---------- Leaderboard ----------
export async function getLeaderboard() {
  return unwrap(await supabase.from(tbl("leaderboard")).select("*"));
}

// ---------- Profiles (admin) ----------
export async function getAllProfiles() {
  return unwrap(await supabase.from("profiles").select("*").order("display_name"));
}

export async function setProfileRole(id, role) {
  return unwrap(await supabase.from("profiles").update({ role }).eq("id", id).select().single());
}

export async function updateProfileDisplayName(id, display_name) {
  return unwrap(await supabase.from("profiles").update({ display_name }).eq("id", id).select().single());
}

export async function getProfileByUsername(username) {
  const { data, error } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
  if (error) throw error;
  return data;
}

export async function uploadMyAvatar(userId, file) {
  const compressed = await compressImage(file);
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from("avatars").upload(path, compressed, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

// ---------- Mi perfil (self-service) ----------
export async function updateMyProfile({
  display_name,
  favorite_participant_id,
  clearFavorite,
  accent_color,
  hated_participant_id,
  clearHated,
  favorite_room,
  clearFavoriteRoom,
  avatar_url,
  clearAvatar,
  theme_mode,
  bio,
  fav_season1_id,
  clearFavSeason1,
  fav_season2_id,
  clearFavSeason2,
  fav_season3_id,
  clearFavSeason3,
  legacy_room_t1,
  clearLegacyRoomT1,
  legacy_room_t2,
  clearLegacyRoomT2,
  legacy_room_t3,
  clearLegacyRoomT3,
  hated_season1_id,
  clearHatedSeason1,
  hated_season2_id,
  clearHatedSeason2,
  hated_season3_id,
  clearHatedSeason3,
  surprise_participant_id,
  clearSurprise,
  disappointment_participant_id,
  clearDisappointment,
  surprise_season1_id,
  clearSurpriseSeason1,
  surprise_season2_id,
  clearSurpriseSeason2,
  surprise_season3_id,
  clearSurpriseSeason3,
  disappointment_season1_id,
  clearDisappointmentSeason1,
  disappointment_season2_id,
  clearDisappointmentSeason2,
  disappointment_season3_id,
  clearDisappointmentSeason3,
} = {}) {
  return unwrap(
    await supabase.rpc("update_my_profile", {
      new_display_name: display_name ?? null,
      new_favorite_participant_id: favorite_participant_id ?? null,
      clear_favorite: clearFavorite ?? false,
      new_accent_color: accent_color ?? null,
      new_hated_participant_id: hated_participant_id ?? null,
      clear_hated: clearHated ?? false,
      new_favorite_room: favorite_room ?? null,
      clear_favorite_room: clearFavoriteRoom ?? false,
      new_avatar_url: avatar_url ?? null,
      clear_avatar: clearAvatar ?? false,
      new_theme_mode: theme_mode ?? null,
      new_bio: bio ?? null,
      new_fav_season1_id: fav_season1_id ?? null,
      clear_fav_season1: clearFavSeason1 ?? false,
      new_fav_season2_id: fav_season2_id ?? null,
      clear_fav_season2: clearFavSeason2 ?? false,
      new_fav_season3_id: fav_season3_id ?? null,
      clear_fav_season3: clearFavSeason3 ?? false,
      new_legacy_room_t1: legacy_room_t1 ?? null,
      clear_legacy_room_t1: clearLegacyRoomT1 ?? false,
      new_legacy_room_t2: legacy_room_t2 ?? null,
      clear_legacy_room_t2: clearLegacyRoomT2 ?? false,
      new_legacy_room_t3: legacy_room_t3 ?? null,
      clear_legacy_room_t3: clearLegacyRoomT3 ?? false,
      new_hated_season1_id: hated_season1_id ?? null,
      clear_hated_season1: clearHatedSeason1 ?? false,
      new_hated_season2_id: hated_season2_id ?? null,
      clear_hated_season2: clearHatedSeason2 ?? false,
      new_hated_season3_id: hated_season3_id ?? null,
      clear_hated_season3: clearHatedSeason3 ?? false,
      new_surprise_participant_id: surprise_participant_id ?? null,
      clear_surprise: clearSurprise ?? false,
      new_disappointment_participant_id: disappointment_participant_id ?? null,
      clear_disappointment: clearDisappointment ?? false,
      new_surprise_season1_id: surprise_season1_id ?? null,
      clear_surprise_season1: clearSurpriseSeason1 ?? false,
      new_surprise_season2_id: surprise_season2_id ?? null,
      clear_surprise_season2: clearSurpriseSeason2 ?? false,
      new_surprise_season3_id: surprise_season3_id ?? null,
      clear_surprise_season3: clearSurpriseSeason3 ?? false,
      new_disappointment_season1_id: disappointment_season1_id ?? null,
      clear_disappointment_season1: clearDisappointmentSeason1 ?? false,
      new_disappointment_season2_id: disappointment_season2_id ?? null,
      clear_disappointment_season2: clearDisappointmentSeason2 ?? false,
      new_disappointment_season3_id: disappointment_season3_id ?? null,
      clear_disappointment_season3: clearDisappointmentSeason3 ?? false,
    })
  );
}

export async function getMyPredictionHistory(playerId) {
  return unwrap(
    await supabase
      .from(tbl("predictions"))
      .select(`week_id, participant_id, ${emb("participants", "name")}, ${emb("weeks", "week_number, label, status")}`)
      .eq("player_id", playerId)
      .order("week_id", { ascending: false })
  );
}

// ---------- Dinámica: Habitante al azar ----------
export async function getSecretAssignments() {
  return unwrap(
    await supabase
      .from(tbl("secret_assignments"))
      .select(`player_id, participant_id, profiles(display_name, username), ${emb("participants", "name, photo_url, active, is_winner")}`)
  );
}

export async function getMySecretAssignment(playerId) {
  const { data, error } = await supabase
    .from(tbl("secret_assignments"))
    .select(`participant_id, ${emb("participants", "name, photo_url, active, is_winner")}`)
    .eq("player_id", playerId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function assignSecretHabitantesRandomly() {
  const [profiles, participants, assignments] = await Promise.all([
    getAllProfiles(),
    getParticipants(),
    getSecretAssignments(),
  ]);
  const assignedPlayerIds = new Set(assignments.map((a) => a.player_id));
  const unassignedPlayers = profiles.filter((p) => !assignedPlayerIds.has(p.id));
  const eligibleParticipants = participants.filter((p) => !p.is_infiltrado);
  if (unassignedPlayers.length === 0 || eligibleParticipants.length === 0) return [];

  const shuffled = [...eligibleParticipants];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const rows = unassignedPlayers.map((player, i) => ({
    player_id: player.id,
    participant_id: shuffled[i % shuffled.length].id,
  }));
  return unwrap(await supabase.from(tbl("secret_assignments")).insert(rows).select());
}

export async function clearSecretAssignment(playerId) {
  return unwrap(await supabase.from(tbl("secret_assignments")).delete().eq("player_id", playerId).select());
}

export async function resetSecretAssignments() {
  return unwrap(
    await supabase.from(tbl("secret_assignments")).delete().neq("player_id", "00000000-0000-0000-0000-000000000000").select()
  );
}

export async function reassignSecretHabitante(playerId, participantId) {
  return unwrap(
    await supabase
      .from(tbl("secret_assignments"))
      .upsert({ player_id: playerId, participant_id: participantId })
      .select()
      .single()
  );
}

export async function markParticipantAsWinner(participantId) {
  await supabase.from(tbl("participants")).update({ is_winner: false }).eq("is_winner", true);
  return unwrap(await supabase.from(tbl("participants")).update({ is_winner: true }).eq("id", participantId).select().single());
}

export async function clearWinner() {
  return unwrap(await supabase.from(tbl("participants")).update({ is_winner: false }).eq("is_winner", true).select());
}

// ---------- Dinámica: Orden de salida ----------
export async function getMyEliminationOrder(playerId) {
  return unwrap(
    await supabase
      .from(tbl("elimination_order_predictions"))
      .select(`position, participant_id, ${emb("participants", "name, photo_url")}`)
      .eq("player_id", playerId)
      .order("position")
  );
}

export async function saveEliminationOrder(playerId, orderedParticipantIds) {
  await supabase.from(tbl("elimination_order_predictions")).delete().eq("player_id", playerId);
  const rows = orderedParticipantIds.map((participant_id, i) => ({
    player_id: playerId,
    position: i + 1,
    participant_id,
  }));
  const result = unwrap(await supabase.from(tbl("elimination_order_predictions")).insert(rows).select());
  await supabase.from(tbl("oraculo_auto_filled")).delete().eq("player_id", playerId);
  return result;
}

export async function getAllEliminationOrders() {
  return unwrap(
    await supabase
      .from(tbl("elimination_order_predictions"))
      .select(`player_id, position, participant_id, ${emb("participants", "name, photo_url, is_winner, is_infiltrado")}, profiles(display_name, username)`)
      .order("player_id")
      .order("position")
  );
}

export async function getEliminationOrderScores() {
  return unwrap(await supabase.from(tbl("elimination_order_score")).select("*"));
}

export async function isOraculoLocked() {
  const { data, error } = await supabase.from(tbl("oraculo_settings")).select("locked").limit(1).maybeSingle();
  if (error) throw error;
  return data?.locked ?? false;
}

export async function setOraculoLocked(locked) {
  return unwrap(await supabase.from(tbl("oraculo_settings")).update({ locked }).eq("id", true).select().single());
}

export async function resetOraculo() {
  await supabase.from(tbl("elimination_order_predictions")).delete().neq("player_id", "00000000-0000-0000-0000-000000000000");
  await supabase.from(tbl("oraculo_auto_filled")).delete().neq("player_id", "00000000-0000-0000-0000-000000000000");
  return setOraculoLocked(false);
}

// Le pone el orden "estándar" (alfabético por nombre) a quienes no hayan
// guardado ninguna predicción todavía, para que no se queden sin puntaje, y
// los marca en oraculo_auto_filled para poder avisarlo en la vista.
export async function fillMissingOraculoPredictionsAlphabetically() {
  const [profiles, participants, predictionRows] = await Promise.all([
    getAllProfiles(),
    getParticipants(),
    supabase.from(tbl("elimination_order_predictions")).select("player_id"),
  ]);
  if (predictionRows.error) throw predictionRows.error;

  const assignedPlayerIds = new Set(predictionRows.data.map((r) => r.player_id));
  const missingPlayers = profiles.filter((p) => !assignedPlayerIds.has(p.id));
  if (missingPlayers.length === 0) return [];

  const eligible = participants.filter((p) => !p.is_infiltrado).sort((a, b) => a.name.localeCompare(b.name));
  const rows = [];
  missingPlayers.forEach((player) => {
    eligible.forEach((participant, i) => {
      rows.push({ player_id: player.id, position: i + 1, participant_id: participant.id });
    });
  });
  const inserted = unwrap(await supabase.from(tbl("elimination_order_predictions")).insert(rows).select());
  await supabase.from(tbl("oraculo_auto_filled")).upsert(missingPlayers.map((p) => ({ player_id: p.id })));
  return inserted;
}

export async function getOraculoAutoFilledPlayerIds() {
  const { data, error } = await supabase.from(tbl("oraculo_auto_filled")).select("player_id");
  if (error) throw error;
  return new Set(data.map((r) => r.player_id));
}
