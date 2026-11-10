// One source file, three copies: npm (dist/), Claude Code plugin (plugin/server/), Claude Desktop extension (mcpb/server/).
import { copyFileSync, mkdirSync, chmodSync } from "node:fs";
for (const dir of ["dist", "plugin/server", "mcpb/server"]) {
  mkdirSync(dir, { recursive: true });
  copyFileSync("src/server.js", `${dir}/index.js`);
  chmodSync(`${dir}/index.js`, 0o755);
}
