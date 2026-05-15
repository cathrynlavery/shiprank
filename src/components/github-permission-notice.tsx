import { githubAppInstallUrl } from "@/lib/github-app";

export function GitHubPermissionNotice() {
  const installUrl = githubAppInstallUrl();

  return (
    <section className="permission-notice" aria-labelledby="github-access-note">
      <h2 id="github-access-note">github access update</h2>
      <p>
        We removed GitHub&apos;s broad repo OAuth scope from new sign-ins.
        ShipRank is moving repo access to a read-only GitHub App, so
        reconnecting users can choose which repositories to include and ShipRank
        still cannot write to repositories, settings, issues, branches, PRs, or
        webhooks.
      </p>
      <div className="permission-notice-action">
        <a
          className="button cta-button"
          href={installUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          reconnect with github
        </a>
      </div>
    </section>
  );
}
