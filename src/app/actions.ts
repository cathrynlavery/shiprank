"use server";

import { signIn, signOut } from "@/auth";

export async function signInWithGithub() {
  await signIn("github", { redirectTo: "/" });
}

export async function signOutUser() {
  await signOut({ redirectTo: "/" });
}
