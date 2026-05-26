import Link from "next/link";
import { auth } from "@/auth";
import { githubAppInstallUrl } from "@/lib/github-app";

export default async function ConnectPage() {
  const session = await auth();
  const installUrl = githubAppInstallUrl();
  const label = session?.githubUsername
    ? "reconnect with github"
    : "connect with github";

  return (
    <main className="wrap">
      <div className="topline">
        <div className="handle">
          <Link href="/">
            <span className="wordmark-bold">ship</span>rank
          </Link>
        </div>
      </div>

      <p className="tagline">A public leaderboard for people who ship.</p>

      <div className="date">github access</div>
      <h1 className="connect-title">Read-only. No repo control.</h1>
      <p className="connect-copy">
        ShipRank uses GitHub access to count recent commits, merged PRs, and
        lines changed. It cannot push code, create branches, open PRs, edit
        issues, change repository settings, manage webhooks, or write to your
        repositories.
      </p>
      <div className="connect-actions connect-actions-primary">
        <a className="button github-connect-button" href={installUrl}>
          {label}
        </a>
      </div>

      <section className="section">
        <h2 className="section-head">what github will ask for</h2>
        <div className="permission-list">
          <div className="permission-row">
            <span>profile and email</span>
            <span>read-only</span>
          </div>
          <div className="permission-row">
            <span>public activity metadata</span>
            <span>read-only</span>
          </div>
          <div className="permission-row">
            <span>private repo access</span>
            <span>optional later</span>
          </div>
        </div>
      </section>

      <section className="section">
        <h2 className="section-head">what shows publicly</h2>
        <p className="prose">
          Private repo names are anonymized publicly, and code, diffs, file
          names, and commit messages are not published.
        </p>
        <div className="example-list" aria-label="private repository example">
          <div className="example-row">
            <span>your private repo</span>
            <span>acme/secret-roadmap</span>
          </div>
          <div className="example-row">
            <span>public display</span>
            <span>Stellar Voyager 7f3</span>
          </div>
          <div className="example-row">
            <span>stats shown</span>
            <span>+1,284 lines · 6 commits</span>
          </div>
        </div>
      </section>

      <section className="section">
        <h2 className="section-head">your control</h2>
        <p className="prose">
          Start by choosing the repositories ShipRank can read in GitHub. After
          installation, GitHub returns you to ShipRank to finish sign-in and
          create your profile.
        </p>
      </section>

      <div className="connect-actions">
        <a className="button cta-button" href={installUrl}>
          {label}
        </a>
        <Link className="button button-secondary" href="/">
          back
        </Link>
      </div>
    </main>
  );
}
