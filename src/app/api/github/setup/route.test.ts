import { NextRequest } from "next/server";
import { afterEach, expect, it, vi } from "vitest";
import { GET } from "./route";
import { auth, signIn } from "@/auth";
import { getUser, isStorageReadOnly, saveUser } from "@/lib/store";

vi.mock("@/auth", () => ({ auth: vi.fn(), signIn: vi.fn() }));
vi.mock("@/lib/stats-date", () => ({ statsDate: () => "2026-11-08" }));
vi.mock("@/lib/store", () => ({
  getUser: vi.fn(), isStorageReadOnly: vi.fn(), saveUser: vi.fn(),
}));
afterEach(() => vi.resetAllMocks());

const setup = (qs = "") =>
  GET(new NextRequest(`http://localhost/api/github/setup${qs}`));

it("rebuilds an existing profile after an App install and asks for a recount", async () => {
  vi.mocked(auth).mockResolvedValue({ githubUsername: "ada" } as never);
  vi.mocked(getUser).mockResolvedValue({ username: "ada" } as never);
  await setup("?installation_id=1&setup_action=install");
  expect(saveUser).toHaveBeenCalledWith({ username: "ada", byDayInvalidUntil: "2026-11-08" });
  expect(signIn).toHaveBeenCalledWith("github", { redirectTo: "/me?reconnected=1" });
});

it("leaves first sign-in alone so FirstRefresh runs once", async () => {
  vi.mocked(auth).mockResolvedValue(null as never);
  await setup("?installation_id=1&setup_action=install");
  expect(saveUser).not.toHaveBeenCalled();
  expect(signIn).toHaveBeenCalledWith("github", { redirectTo: "/me" });
});

it("treats the plain sign-in entry as sign-in only", async () => {
  vi.mocked(auth).mockResolvedValue({ githubUsername: "ada" } as never);
  await setup();
  expect(getUser).not.toHaveBeenCalled();
  expect(signIn).toHaveBeenCalledWith("github", { redirectTo: "/me" });
});

it("skips the rebuild mark while storage is read-only", async () => {
  vi.mocked(auth).mockResolvedValue({ githubUsername: "ada" } as never);
  vi.mocked(getUser).mockResolvedValue({ username: "ada" } as never);
  vi.mocked(isStorageReadOnly).mockReturnValue(true);
  await setup("?setup_action=update");
  expect(saveUser).not.toHaveBeenCalled();
  expect(signIn).toHaveBeenCalledWith("github", { redirectTo: "/me" });
});

it("ignores an install request still waiting on an org owner", async () => {
  vi.mocked(auth).mockResolvedValue({ githubUsername: "ada" } as never);
  await setup("?setup_action=request");
  expect(getUser).not.toHaveBeenCalled();
  expect(signIn).toHaveBeenCalledWith("github", { redirectTo: "/me" });
});
