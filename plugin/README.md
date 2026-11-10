# pdfvera plugin for Claude Code

Converts German PDF invoices into XRechnung and ZUGFeRD e-invoices, and Brazilian bank statement PDFs into OFX, CSV and Excel, from a chat with Claude Code. The plugin is a skill: it shows Claude how to send the PDF you name to the pdfvera API with your API key (using `curl`) and write the result files next to the PDF. When mandatory invoice data is missing, Claude asks you for it.

Install in Claude Code:

```
/plugin marketplace add pdfvera/pdfvera-mcp
/plugin install pdfvera@pdfvera
```

Setup: you need a pdfvera plan and an API key from your pdfvera account (pdfvera.com/de/konto/ or pdfvera.com/pt-br/conta/). Put the key into `~/.claude/settings.json` and restart Claude Code:

```json
{ "env": { "PDFVERA_API_KEY": "pv_YOUR_KEY" } }
```

Claude uses `curl` and `python3` (or `node`). If you prefer tools over a skill, use the pdfvera MCP server instead: `claude mcp add pdfvera -e PDFVERA_API_KEY=pv_YOUR_KEY -- npx -y pdfvera-mcp@latest`.

Privacy policy and troubleshooting: see the [main README](../README.md).
