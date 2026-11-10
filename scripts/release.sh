#!/bin/sh
# Release. First bump "version" in package.json, server.json (twice), mcpb/manifest.json and VERSION in src/server.js.
# src/server.js is the only source; npm run build copies it to dist/ (npm) and mcpb/server/ (Claude Desktop extension).
# The Claude Code plugin (plugin/) is a skill only and has its own version in plugin/.claude-plugin/plugin.json.
set -e
cd "$(dirname "$0")/.."
npm whoami >/dev/null || { echo "Run: npm login"; exit 1; }
npm run build
npm publish --access public  # asks for the authenticator code; npm holds new versions a few minutes
npx -y @anthropic-ai/mcpb pack mcpb pdfvera.mcpb && cp pdfvera.mcpb ../pdfvera-web/public/mcp/pdfvera.mcpb
KEY="$(openssl pkey -in ~/.config/pdfvera/mcp-registry-ed25519.pem -outform DER | tail -c 32 | xxd -p -c 64)"
mcp-publisher login http --domain pdfvera.com --private-key "$KEY"
mcp-publisher publish  # fails until npm shows the new version; then run it again
echo "Commit and push. Deploy pdfvera-web for the .mcpb."
