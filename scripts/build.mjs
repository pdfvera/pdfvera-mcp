// One source file, two copies: npm (dist/) and Claude Desktop extension (mcpb/server/).
import { copyFileSync, mkdirSync, chmodSync } from "node:fs";
for (const dir of ["dist", "mcpb/server"]) {
  mkdirSync(dir, { recursive: true });
  copyFileSync("src/server.js", `${dir}/index.js`);
  chmodSync(`${dir}/index.js`, 0o755);
}
