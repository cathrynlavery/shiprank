import { signInWithGithub } from "@/app/actions";

export function GitHubPermissionNotice() {
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
        <form action={signInWithGithub}>
          <button className="button cta-button" type="submit">
            finish reconnect
          </button>
        </form>
      </div>
    </section>
  );
}
