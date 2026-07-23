import { supabase } from "./supabaseClient.js";

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

// ---------- Participants ----------
export async function getParticipants({ activeOnly = false } = {}) {
  let q = supabase.from("participants").select("*").order("name");
  if (activeOnly) q = q.eq("active", true);
  return unwrap(await q);
}

export async function createParticipant({ name, room, photo_url }) {
  return unwrap(
    await supabase.from("participants").insert({ name, room, photo_url }).select().single()
  );
}

export async function updateParticipant(id, fields) {
  return unwrap(await supabase.from("participants").update(fields).eq("id", id).select().single());
}

export async function deleteParticipant(id) {
  return unwrap(await supabase.from("participants").delete().eq("id", id));
}

export async function uploadParticipantPhoto(file) {
  const ext = file.name.split(".").pop();
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("photos").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("photos").getPublicUrl(path);
  return data.publicUrl;
}

// ---------- Favoritos de temporadas anteriores (no son habitantes actuales) ----------
export async function getLegacyFavorites({ season } = {}) {
  let q = supabase.from("legacy_favorites").select("*").order("name");
  if (season) q = q.eq("season", season);
  return unwrap(await q);
}

export async function createLegacyFavorite({ season, name, photo_url }) {
  return unwrap(await supabase.from("legacy_favorites").insert({ season, name, photo_url }).select().single());
}

export async function updateLegacyFavorite(id, fields) {
  return unwrap(await supabase.from("legacy_favorites").update(fields).eq("id", id).select().single());
}

export async function deleteLegacyFavorite(id) {
  return unwrap(await supabase.from("legacy_favorites").delete().eq("id", id));
}

export async function getNominationCounts() {
  const rows = unwrap(await supabase.from("nomination_counts").select("*"));
  const map = {};
  rows.forEach((r) => (map[r.participant_id] = r.times_nominated));
  return map;
}

export async function getImmunityCounts() {
  const rows = unwrap(await supabase.from("immunity_counts").select("*"));
  const map = {};
  rows.forEach((r) => (map[r.participant_id] = r.times_leader));
  return map;
}

export async function getSavedCounts() {
  const rows = unwrap(await supabase.from("saved_counts").select("*"));
  const map = {};
  rows.forEach((r) => (map[r.participant_id] = r.times_saved));
  return map;
}

// ---------- Weeks ----------
export async function getWeeks() {
  return unwrap(await supabase.from("weeks").select("*").order("week_number", { ascending: false }));
}

export async function getVotingWeek() {
  const rows = unwrap(
    await supabase
      .from("weeks")
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
      .from("weeks")
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
      .from("weeks")
      .insert({ week_number, label, nomination_date, elimination_date })
      .select()
      .single()
  );
}

export async function updateWeek(id, fields) {
  return unwrap(await supabase.from("weeks").update(fields).eq("id", id).select().single());
}

export async function deleteWeek(id) {
  return unwrap(await supabase.from("weeks").delete().eq("id", id));
}

// ---------- Nominations ----------
export async function getNominationsForWeek(weekId) {
  return unwrap(
    await supabase
      .from("nominations")
      .select("week_id, participant_id, points, saved, participants(*)")
      .eq("week_id", weekId)
      .order("points", { ascending: false })
  );
}

export async function setNomination(weekId, participantId, points) {
  return unwrap(
    await supabase
      .from("nominations")
      .upsert({ week_id: weekId, participant_id: participantId, points })
      .select()
      .single()
  );
}

export async function setNominationSaved(weekId, participantId, saved) {
  return unwrap(
    await supabase
      .from("nominations")
      .update({ saved })
      .eq("week_id", weekId)
      .eq("participant_id", participantId)
      .select()
      .single()
  );
}

export async function removeNomination(weekId, participantId) {
  return unwrap(
    await supabase.from("nominations").delete().eq("week_id", weekId).eq("participant_id", participantId)
  );
}

// ---------- Immunities ----------
export async function getImmunitiesForWeek(weekId) {
  return unwrap(
    await supabase.from("immunities").select("week_id, participant_id, participants(*)").eq("week_id", weekId)
  );
}

export async function addImmunity(weekId, participantId) {
  return unwrap(
    await supabase.from("immunities").insert({ week_id: weekId, participant_id: participantId })
  );
}

export async function removeImmunity(weekId, participantId) {
  return unwrap(
    await supabase.from("immunities").delete().eq("week_id", weekId).eq("participant_id", participantId)
  );
}

// ---------- Eliminations ----------
export async function getEliminationsForWeek(weekId) {
  return unwrap(
    await supabase.from("eliminations").select("week_id, participant_id, participants(*)").eq("week_id", weekId)
  );
}

export async function getAllEliminationsWithWeeks() {
  return unwrap(
    await supabase
      .from("eliminations")
      .select("week_id, participant_id, participants(*), weeks(*)")
      .order("week_id", { ascending: false })
  );
}

export async function confirmEliminations(weekId, participantIds) {
  await supabase.from("eliminations").delete().eq("week_id", weekId);
  if (participantIds.length > 0) {
    unwrap(
      await supabase
        .from("eliminations")
        .insert(participantIds.map((pid) => ({ week_id: weekId, participant_id: pid })))
    );
  }
  await supabase.from("participants").update({ active: false }).in("id", participantIds);
  return unwrap(await supabase.from("weeks").update({ status: "closed" }).eq("id", weekId).select().single());
}

// ---------- Predictions ----------
export async function getMyPrediction(weekId, playerId) {
  const { data, error } = await supabase
    .from("predictions")
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
      .from("predictions")
      .upsert({ week_id: weekId, player_id: playerId, participant_id: participantId, updated_at: new Date().toISOString() })
      .select()
      .single()
  );
}

export async function getPredictionsForWeek(weekId) {
  return unwrap(
    await supabase.from("predictions").select("*, profiles(display_name, username)").eq("week_id", weekId)
  );
}

// ---------- Leaderboard ----------
export async function getLeaderboard() {
  return unwrap(await supabase.from("leaderboard").select("*"));
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
  const ext = file.name.split(".").pop();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
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
  avatar_url,
  bio,
  fav_season1_id,
  clearFavSeason1,
  fav_season2_id,
  clearFavSeason2,
  fav_season3_id,
  clearFavSeason3,
  legacy_room_t1,
  legacy_room_t2,
  legacy_room_t3,
  hated_season1_id,
  clearHatedSeason1,
  hated_season2_id,
  clearHatedSeason2,
  hated_season3_id,
  clearHatedSeason3,
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
      new_avatar_url: avatar_url ?? null,
      new_bio: bio ?? null,
      new_fav_season1_id: fav_season1_id ?? null,
      clear_fav_season1: clearFavSeason1 ?? false,
      new_fav_season2_id: fav_season2_id ?? null,
      clear_fav_season2: clearFavSeason2 ?? false,
      new_fav_season3_id: fav_season3_id ?? null,
      clear_fav_season3: clearFavSeason3 ?? false,
      new_legacy_room_t1: legacy_room_t1 ?? null,
      new_legacy_room_t2: legacy_room_t2 ?? null,
      new_legacy_room_t3: legacy_room_t3 ?? null,
      new_hated_season1_id: hated_season1_id ?? null,
      clear_hated_season1: clearHatedSeason1 ?? false,
      new_hated_season2_id: hated_season2_id ?? null,
      clear_hated_season2: clearHatedSeason2 ?? false,
      new_hated_season3_id: hated_season3_id ?? null,
      clear_hated_season3: clearHatedSeason3 ?? false,
    })
  );
}

export async function getMyPredictionHistory(playerId) {
  return unwrap(
    await supabase
      .from("predictions")
      .select("week_id, participant_id, participants(name), weeks(week_number, label, status)")
      .eq("player_id", playerId)
      .order("week_id", { ascending: false })
  );
}
