import Link from "next/link";
import { auth } from "@/auth";
import { githubAppInstallUrl } from "@/lib/github-app";

export default async function ConnectPage() {
  const session = await auth();
  const installUrl = githubAppInstallUrl();

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
        <a
          className="button github-connect-button"
          href={installUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {session?.githubUsername
            ? "reconnect with github"
            : "connect with github"}
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
            <span>repository contents</span>
            <span>read-only</span>
          </div>
          <div className="permission-row">
            <span>pull requests</span>
            <span>read-only</span>
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
          With the GitHub App setup, you choose which repositories ShipRank can
          read. Select all repositories if you want your total line count to
          include everything you ship. Select specific repositories if you only
          want those projects counted.
        </p>
      </section>

      <div className="connect-actions">
        <a
          className="button cta-button"
          href={installUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {session?.githubUsername
            ? "reconnect with github"
            : "connect with github"}
        </a>
        <Link className="button button-secondary" href="/">
          back
        </Link>
      </div>
    </main>
  );
}
