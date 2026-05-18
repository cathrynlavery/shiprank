"use server";

import { signIn, signOut } from "@/auth";

export async function signInWithGithub() {
  await signIn("github", { redirectTo: "/me" });
}

export async function signInWithGithubFull(formData: FormData) {
  const redirectTo = formData.get("redirectTo");
  await signIn("github-full", {
    redirectTo: typeof redirectTo === "string" ? redirectTo : "/me",
  });
}

export async function signOutUser() {
  await signOut({ redirectTo: "/" });
}
