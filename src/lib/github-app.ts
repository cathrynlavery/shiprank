export function githubAppInstallUrl() {
  const slug = process.env.GITHUB_APP_SLUG?.trim() || "shiprank";
  return `https://github.com/apps/${slug}/installations/new`;
}

export function githubConnectUrl(isAuthenticated: boolean) {
  return isAuthenticated ? githubAppInstallUrl() : "/api/github/setup";
}
