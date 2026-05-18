import { test } from "@playwright/test";

test.describe.skip("OAuth live smoke", () => {
  test("manual procedure", async () => {
    /*
     * 1. Register the ShipRank Full Visibility OAuth App.
     * 2. Set AUTH_GITHUB_FULL_ID, AUTH_GITHUB_FULL_SECRET, and TOKEN_ENCRYPTION_KEY.
     * 3. Sign in as a GitHub user with collaborator access to a private repo.
     * 4. Open /<username>, click "grant full visibility", and approve GitHub's repo scope.
     * 5. Run refresh and confirm collaborator private-repo default-branch commits are counted.
     * 6. Revoke the OAuth app in GitHub settings, refresh again, and confirm the revoked banner appears.
     */
  });
});
