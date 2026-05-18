"use client";

import { signIn } from "next-auth/react";

type OAuthState = "not-opted-in" | "opted-in" | "revoked";

export function OAuthStateBanner({
  enabled,
  state,
  revokedAt,
  settingsUrl,
  username,
}: {
  enabled: boolean;
  state: OAuthState;
  revokedAt?: string;
  settingsUrl: string;
  username: string;
}) {
  const reconnect = () => {
    if (!enabled) return;
    void signIn("github-full", { callbackUrl: `/${username}` });
  };

  if (state === "opted-in") {
    return (
      <section className="permission-notice oauth-state-banner">
        <h2>full visibility on</h2>
        <p>
          Counts commits on default branches across repos you can read. GitHub
          search doesn&apos;t index feature-branch commits.
        </p>
        <div className="permission-notice-action">
          {enabled ? (
            <button className="button cta-button" type="button" onClick={reconnect}>
              reconnect
            </button>
          ) : null}
          <a className="button button-secondary" href={settingsUrl}>
            revoke in github
          </a>
        </div>
      </section>
    );
  }

  if (state === "revoked") {
    const date = revokedAt
      ? new Date(revokedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "recently";

    return (
      <section className="permission-notice oauth-state-banner">
        <h2>full visibility disconnected</h2>
        <p>Full visibility was disconnected on {date}. Reconnect?</p>
        <div className="permission-notice-action">
          <button
            className="button cta-button"
            type="button"
            onClick={reconnect}
            disabled={!enabled}
          >
            reconnect
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="permission-notice oauth-state-banner">
      <h2>counting owned and org repos</h2>
      <p>
        Counting only repos owned by you and your orgs. GitHub will ask
        permission for repo access, the smallest scope that lets the search API
        find commits in repos you collaborate on. ShipRank only uses it to count
        line additions and deletions per commit. We never display private repo
        names, commit messages, or code.
      </p>
      <div className="permission-notice-action">
        <button
          className="button cta-button"
          type="button"
          onClick={reconnect}
          disabled={!enabled}
        >
          grant full visibility
        </button>
      </div>
    </section>
  );
}
