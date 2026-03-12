"use server";

import { createClient } from "@/lib/supabase/server";
import { requestAccessSchema, loginSchema } from "@/lib/validations/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export type AuthActionState = {
  error?: string;
  success?: boolean;
};

export async function requestAccess(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const rawData = {
    email: formData.get("email") as string,
    fullName: formData.get("fullName") as string,
  };

  const parsed = requestAccessSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const supabase = await createClient();
  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? "";

  // Sign up the user — they'll get a confirmation email
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: crypto.randomUUID(), // Random password; they'll use magic link to log in
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { error: "Something went wrong. Please try again." };
  }

  // Note: Supabase may return a fake success for duplicate emails when
  // email confirmation is enabled (to prevent email enumeration).
  // The user will simply not receive a confirmation email in that case.
  return { success: true };
}

export async function login(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const rawData = {
    email: formData.get("email") as string,
  };

  const parsed = loginSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const supabase = await createClient();
  const headerStore = await headers();
  const origin = headerStore.get("origin") ?? "";

  // Send magic link
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { error: "Something went wrong. Please try again." };
  }

  return { success: true };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
