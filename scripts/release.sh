#!/bin/sh
# Release: npm package, official MCP registry, hosted .mcpb. Bump "version" in package.json, server.json (twice),
# plugin/.claude-plugin/plugin.json, mcpb/manifest.json and VERSION in src/index.ts first.
set -e
cd "$(dirname "$0")/.."
npm whoami >/dev/null || { echo "Run: npm login"; exit 1; }
npm publish --access public
cp dist/index.js mcpb/server/index.js && npx -y @anthropic-ai/mcpb pack mcpb pdfvera.mcpb
cp pdfvera.mcpb ../pdfvera-web/public/mcp/pdfvera.mcpb
KEY="$(openssl pkey -in ~/.config/pdfvera/mcp-registry-ed25519.pem -noout -text | grep -A3 'priv:' | tail -n +2 | tr -d ' :\n')"
mcp-publisher login http --domain pdfvera.com --private-key "$KEY"
mcp-publisher publish
echo "Done. Deploy pdfvera-web (npm run cf:deploy) so the new .mcpb is live."
