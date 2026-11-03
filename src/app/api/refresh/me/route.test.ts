import { afterEach, expect, it, vi } from "vitest";
import { POST } from "./route";
import { auth } from "@/auth";
import { acquireRefreshLock, getUser, isStorageReadOnly } from "@/lib/store";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/github", () => ({ refreshUserStats: vi.fn() }));
vi.mock("@/lib/store", () => ({
  acquireRefreshLock: vi.fn(), getUser: vi.fn(), isStorageReadOnly: vi.fn(),
  releaseRefreshLock: vi.fn(), saveStats: vi.fn(), saveUser: vi.fn(),
}));
afterEach(() => vi.resetAllMocks());

it("returns maintenance status before token reads or lock acquisition", async () => {
  vi.mocked(auth).mockResolvedValue({ githubUsername: "ada" } as never);
  vi.mocked(isStorageReadOnly).mockReturnValue(true);
  const response = await POST();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: expect.stringContaining("maintenance") });
  expect(getUser).not.toHaveBeenCalled();
  expect(acquireRefreshLock).not.toHaveBeenCalled();
});
