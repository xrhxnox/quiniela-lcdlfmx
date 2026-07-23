import { supabase } from "./supabaseClient.js";
import { USERNAME_DOMAIN } from "./config.js";

function usernameToEmail(username) {
  return `${username.trim().toLowerCase()}@${USERNAME_DOMAIN}`;
}

export async function login(username, password) {
  const email = usernameToEmail(username);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function logout() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getMyProfile() {
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();
  if (error) throw error;
  return data;
}

export function onAuthStateChange(cb) {
  return supabase.auth.onAuthStateChange((_event, session) => cb(session));
}
