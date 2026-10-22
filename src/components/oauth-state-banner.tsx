import { signInWithGithubFull } from "@/app/actions";
import { STATS_TIME_ZONE } from "@/lib/stats-date";

type OAuthState = "not-opted-in" | "opted-in" | "revoked";

function shortDate(iso: string | undefined) {
  return iso
    ? new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: STATS_TIME_ZONE,
      })
    : null;
}

function FullVisibilityForm({
  children,
  enabled,
  username,
}: {
  children: string;
  enabled: boolean;
  username: string;
}) {
  if (!enabled) {
    return (
      <button className="button cta-button" type="button" disabled>
        {children}
      </button>
    );
  }

  return (
    <form action={signInWithGithubFull}>
      <input
        name="redirectTo"
        type="hidden"
        value={`/${username}?reconnected=1`}
      />
      <button className="button cta-button" type="submit">
        {children}
      </button>
    </form>
  );
}

export function OAuthStateBanner({
  enabled,
  state,
  grantedAt,
  revokedAt,
  settingsUrl,
  username,
}: {
  enabled: boolean;
  state: OAuthState;
  grantedAt?: string;
  revokedAt?: string;
  settingsUrl: string;
  username: string;
}) {
  if (state === "opted-in") {
    return (
      <section className="permission-notice oauth-state-banner">
        <h2>full visibility on</h2>
        <p>
          Counts commits on default branches across repos you can read. GitHub
          search doesn&apos;t index feature-branch commits.
        </p>
        <p>
          Connected{grantedAt ? ` ${shortDate(grantedAt)}` : ""}. Nothing to do
          here. If you hit reconnect anyway, GitHub sends you straight back
          without asking again, since you already approved ShipRank, and your
          stats recount.
        </p>
        <div className="permission-notice-action">
          {enabled ? (
            <FullVisibilityForm enabled={enabled} username={username}>
              reconnect
            </FullVisibilityForm>
          ) : null}
          <a className="button button-secondary" href={settingsUrl}>
            revoke in github
          </a>
        </div>
      </section>
    );
  }

  if (state === "revoked") {
    const date = shortDate(revokedAt) ?? "recently";

    return (
      <section className="permission-notice oauth-state-banner">
        <h2>full visibility disconnected</h2>
        <p>Full visibility was disconnected on {date}. Reconnect?</p>
        <div className="permission-notice-action">
          <FullVisibilityForm enabled={enabled} username={username}>
            reconnect
          </FullVisibilityForm>
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
        line additions and deletions per commit. Public repo names and aggregate
        stats are shown; private repo names are shown only to you while signed
        in. Commit messages, code, diffs, and file names are not shown.
      </p>
      <div className="permission-notice-action">
        <FullVisibilityForm enabled={enabled} username={username}>
          grant full visibility
        </FullVisibilityForm>
      </div>
    </section>
  );
}
