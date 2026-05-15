export function githubAppInstallUrl() {
  const slug = process.env.GITHUB_APP_SLUG ?? "shiprank";
  return `https://github.com/apps/${slug}/installations/new`;
}
