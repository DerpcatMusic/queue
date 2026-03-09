const bun = process.execPath;
const cwd = process.cwd();

function spawn(name: string, cmd: string[], stdin: "inherit" | "ignore") {
  return {
    name,
    process: Bun.spawn(cmd, {
      cwd,
      stdin,
      stdout: "inherit",
      stderr: "inherit",
    }),
  };
}

const children = [
  spawn("convex", [bun, "run", "convex:dev"], "ignore"),
  spawn("expo", [bun, "run", "start"], "inherit"),
];

let shuttingDown = false;

function stopAll(signal: NodeJS.Signals = "SIGTERM") {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const child of children) {
    if (!child.process.killed && child.process.exitCode === null) {
      child.process.kill(signal);
    }
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopAll(signal);
  });
}

const result = await Promise.race(
  children.map(({ name, process }) =>
    process.exited.then((code) => ({
      name,
      code,
    })),
  ),
);

stopAll(result.code === 0 ? "SIGTERM" : "SIGINT");
await Promise.allSettled(children.map(({ process }) => process.exited));

process.exit(result.code);
