#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const usage = `Usage:
  bun run internal-access:grant -- <email> [more-emails...]

Options:
  --email <email>        Add an email target. Can be repeated.
  --role <tester|admin>  Access role to grant. Default: tester
  --note <text>          Optional note stored with the grant.
  --access-token <text>  Bootstrap token. Falls back to INTERNAL_ACCESS_BOOTSTRAP_TOKEN env.
  --no-bypass            Disable verification bypass. Default: bypass enabled
  --disable              Deactivate the grant instead of enabling it.
  --dry-run              Print the Convex commands without executing them.
  --help                 Show this message.

Examples:
  bun run internal-access:grant -- mgmt.derpcat@gmail.com djderpcat@gmail.com
  bun run internal-access:grant -- --access-token "$INTERNAL_ACCESS_BOOTSTRAP_TOKEN" djderpcat@gmail.com
  bun run internal-access:grant -- --email mgmt.derpcat@gmail.com --role admin
  bun run internal-access:grant -- --email djderpcat@gmail.com --disable
`;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function parseArgs(argv) {
  const emails = [];
  let role = "tester";
  let note;
  let accessToken = process.env.INTERNAL_ACCESS_BOOTSTRAP_TOKEN?.trim();
  let verificationBypass = true;
  let active = true;
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--help" || value === "-h") {
      console.log(usage);
      process.exit(0);
    }

    if (value === "--email") {
      const email = argv[index + 1];
      if (!email) {
        fail("--email requires a value");
      }
      emails.push(email);
      index += 1;
      continue;
    }

    if (value === "--role") {
      const nextRole = argv[index + 1];
      if (nextRole !== "tester" && nextRole !== "admin") {
        fail("--role must be either tester or admin");
      }
      role = nextRole;
      index += 1;
      continue;
    }

    if (value === "--note") {
      const nextNote = argv[index + 1];
      if (!nextNote) {
        fail("--note requires a value");
      }
      note = nextNote;
      index += 1;
      continue;
    }

    if (value === "--access-token") {
      const nextAccessToken = argv[index + 1];
      if (!nextAccessToken) {
        fail("--access-token requires a value");
      }
      accessToken = nextAccessToken;
      index += 1;
      continue;
    }

    if (value === "--no-bypass") {
      verificationBypass = false;
      continue;
    }

    if (value === "--disable") {
      active = false;
      continue;
    }

    if (value === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (value.startsWith("--")) {
      fail(`Unknown option: ${value}`);
    }

    emails.push(value);
  }

  const normalizedEmails = [...new Set(emails.map(normalizeEmail).filter(Boolean))];
  if (normalizedEmails.length === 0) {
    fail(`At least one email is required.\n\n${usage}`);
  }

  return {
    active,
    dryRun,
    emails: normalizedEmails,
    note,
    role,
    accessToken,
    verificationBypass,
  };
}

function getBunxCommand() {
  return process.platform === "win32" ? "bunx.cmd" : "bunx";
}

function buildPayload(args, email) {
  return {
    email,
    role: args.role,
    verificationBypass: args.verificationBypass,
    active: args.active,
    ...(args.note ? { notes: args.note } : {}),
  };
}

function runGrant(functionName, payload, dryRun) {
  const command = getBunxCommand();
  const args = ["convex", "run", functionName, JSON.stringify(payload)];

  if (dryRun) {
    console.log(`[dry-run] ${command} ${args.join(" ")}`);
    return { ok: true };
  }

  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.status !== 0) {
    return {
      ok: false,
      stderr: result.stderr?.trim(),
      stdout: result.stdout?.trim(),
    };
  }

  return {
    ok: true,
    stdout: result.stdout?.trim(),
  };
}

const args = parseArgs(process.argv.slice(2));

const functionName = args.accessToken
  ? "internalAccess:setInternalAccessGrantWithAccessToken"
  : "internalAccess:setInternalAccessGrant";

console.log(
  `${args.active ? "Granting" : "Disabling"} ${args.role} access for ${args.emails.length} email${args.emails.length === 1 ? "" : "s"} using ${args.accessToken ? "bootstrap token" : "authenticated admin"} path...`,
);

for (const email of args.emails) {
  const payload = {
    ...buildPayload(args, email),
    ...(args.accessToken ? { accessToken: args.accessToken } : {}),
  };
  const result = runGrant(functionName, payload, args.dryRun);

  if (!result.ok) {
    console.error(`Failed for ${email}`);
    if (result.stderr) {
      console.error(result.stderr);
    }
    if (result.stdout) {
      console.error(result.stdout);
    }
    if (!args.accessToken && (result.stderr ?? "").includes("Authentication required")) {
      console.error(
        "Hint: `convex run` is anonymous here. Set INTERNAL_ACCESS_BOOTSTRAP_TOKEN in Convex and in your shell, then rerun with the same command.",
      );
    }
    process.exit(1);
  }

  console.log(`${args.active ? "Granted" : "Disabled"} ${args.role} access for ${email}`);
  if (result.stdout) {
    console.log(result.stdout);
  }
}
