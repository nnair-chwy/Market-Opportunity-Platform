import { spawn } from "node:child_process";

const child = spawn(process.execPath, ["/Users/nnair/Documents/Retail and Clinic Location Evaluator/.codex-ppt-remake/remake-deck.mjs"], {
  cwd: "/Users/nnair/Documents/Retail and Clinic Location Evaluator/.codex-ppt-remake",
  env: process.env,
});
let stdout = "";
let stderr = "";
child.stdout.on("data", (chunk) => { stdout += chunk; });
child.stderr.on("data", (chunk) => { stderr += chunk; });
child.on("close", (code) => {
  console.log(`exit=${code}`);
  if (stdout) console.log(stdout.slice(-4000));
  if (stderr) {
    const lines = stderr.split(/\r?\n/);
    console.log(`stderr-bytes=${stderr.length}; lines=${lines.length}`);
    for (const line of lines.filter((value) => value.length < 1200).slice(-20)) console.log(line);
  }
});
