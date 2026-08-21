import { spawn, execFileSync } from "node:child_process";
import process from "node:process";

const port = Number(process.env.PORT ?? "8082");
const host = "127.0.0.1";

/** @returns {number[]} */
function pidsOnPort(p) {
  if (process.platform === "win32") {
    let out = "";
    try {
      out = execFileSync("netstat", ["-ano", "-p", "tcp"], {
        encoding: "utf8",
      });
    } catch {
      return [];
    }
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes(`:${p}`)) continue;
      if (!/LISTENING/i.test(line)) continue;
      const parts = line.trim().split(/\s+/);
      const pid = Number(parts[parts.length - 1]);
      if (Number.isFinite(pid) && pid > 0) pids.add(pid);
    }
    return [...pids];
  }

  try {
    const out = execFileSync("lsof", ["-ti", `tcp:${p}`], {
      encoding: "utf8",
    });
    return out
      .split(/\s+/)
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n) && n > 0);
  } catch {
    return [];
  }
}

/** @param {number} pid */
function killPid(pid) {
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
        stdio: "ignore",
      });
    } catch {
      // already gone
    }
    return;
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // already gone
  }
}

/** @param {number} p */
function freePort(p) {
  const pids = pidsOnPort(p).filter((pid) => pid !== process.pid);
  if (pids.length === 0) {
    process.stdout.write(`[start] port ${p} is free\n`);
    return;
  }
  for (const pid of pids) {
    process.stdout.write(`[start] killing pid ${pid} on port ${p}\n`);
    killPid(pid);
  }
}

freePort(port);

const child = spawn(
  process.execPath,
  [
    "--experimental-sqlite",
    "--experimental-strip-types",
    "src/rd/server/index.ts",
  ],
  {
    stdio: "inherit",
    env: { ...process.env, PORT: String(port) },
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

process.stdout.write(`[start] API ${host}:${port} (conf: src/op/conf/test.env)\n`);
