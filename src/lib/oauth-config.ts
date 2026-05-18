export function signInWithGithubFullEnabled() {
  return Boolean(
    process.env.AUTH_GITHUB_FULL_ID && process.env.AUTH_GITHUB_FULL_SECRET,
  );
}

export function githubFullSettingsUrl() {
  const clientId = process.env.AUTH_GITHUB_FULL_ID;
  return clientId
    ? `https://github.com/settings/connections/applications/${clientId}`
    : "https://github.com/settings/applications";
}
