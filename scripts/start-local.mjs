import { spawn } from "node:child_process";
import { join } from "node:path";

const nextBin = join(
  process.cwd(),
  "node_modules",
  "next",
  "dist",
  "bin",
  "next",
);

const server = spawn(
  process.execPath,
  [
    "--max-old-space-size=384",
    nextBin,
    "start",
    "--hostname",
    "127.0.0.1",
    ...process.argv.slice(2),
  ],
  {
    env: {
      ...process.env,
      SHIPRANK_USE_LOCAL_STORE: "1",
    },
    stdio: "inherit",
  },
);

server.on("error", (error) => {
  console.error(`Could not start the local server: ${error.message}`);
  process.exitCode = 1;
});

server.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
