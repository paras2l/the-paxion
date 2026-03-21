import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://clcyjlonejqtluadlwgm.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsY3lqbG9uZWpxdGx1YWRsd2dtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwOTE3NDUsImV4cCI6MjA4OTY2Nzc0NX0.47Bw4WxJpoGAO2slS9DxrYivHa63Ar9sBuh-WHtsrY0";

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });
  if (error) {
    console.error(error);
    return null;
  }
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  if (error) {
    console.error(error);
    return null;
  }
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    console.log("User logged in:", session.user.id);
  } else {
    console.log("User logged out");
  }
});
