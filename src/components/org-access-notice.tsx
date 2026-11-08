import { githubAppInstallUrl } from "@/lib/github-app";

export function OrgAccessNotice() {
  return (
    <section className="permission-notice oauth-state-banner">
      <h2>missing an org?</h2>
      <p>
        ShipRank only counts private repos in orgs and accounts where you
        installed the ShipRank GitHub App. Joined a new org, or want more repos
        from one you already added? Pick it on GitHub and choose the repos.
        Your stats recount when GitHub sends you back.
      </p>
      <div className="permission-notice-action">
        <a className="button cta-button" href={githubAppInstallUrl()}>
          add an org or repos
        </a>
      </div>
    </section>
  );
}
