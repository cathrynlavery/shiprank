import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const envPath = join(process.cwd(), ".env.local");
const examplePath = join(process.cwd(), ".env.example");

function parseEnv(content) {
  const values = new Map();

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const index = trimmed.indexOf("=");
    if (index === -1) continue;

    values.set(trimmed.slice(0, index), trimmed.slice(index + 1));
  }

  return values;
}

function serializeEnv(keys, values) {
  return `${keys
    .map((key) => `${key}=${values.get(key) ?? ""}`)
    .join("\n")}\n`;
}

const example = existsSync(examplePath)
  ? readFileSync(examplePath, "utf8")
  : "";
const existing = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const exampleValues = parseEnv(example);
const values = new Map([...exampleValues, ...parseEnv(existing)]);
const keys = [...exampleValues.keys()];

function ensure(key, value) {
  if (!values.get(key)) values.set(key, value);
  if (!keys.includes(key)) keys.push(key);
}

ensure("AUTH_SECRET", randomBytes(32).toString("hex"));
ensure("TOKEN_ENCRYPTION_KEY", randomBytes(32).toString("base64"));
ensure("CRON_SECRET", randomBytes(32).toString("hex"));
ensure("AUTH_URL", "http://localhost:3000");
ensure("GITHUB_APP_SLUG", "shiprank-local");

writeFileSync(envPath, serializeEnv(keys, values));

const missingGithub = ["AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET"].filter(
  (key) => !values.get(key),
);

console.log(`Wrote ${envPath}`);

if (missingGithub.length) {
  console.log("");
  console.log("Fill these from your GitHub App settings before signing in:");
  for (const key of missingGithub) console.log(`- ${key}`);
  console.log("");
  console.log("GitHub App local URLs:");
  console.log("- Homepage URL: http://localhost:3000");
  console.log("- Callback URL: http://localhost:3000/api/auth/callback/github");
  console.log("- Setup URL: http://localhost:3000/api/github/setup");
}
