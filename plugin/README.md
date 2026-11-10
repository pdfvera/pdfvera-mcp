# pdfvera plugin for Claude

Converts German PDF invoices into XRechnung and ZUGFeRD e-invoices, and Brazilian bank statement PDFs into OFX, CSV and Excel, from a chat with Claude. The plugin starts the pdfvera MCP server on your computer: it reads the PDF you name, sends it to the pdfvera API with your API key and writes the result files next to the PDF. When mandatory invoice data is missing, Claude asks you for it.

Install in Claude Code:

```
/plugin marketplace add pdfvera/pdfvera-mcp
/plugin install pdfvera@pdfvera
```

Setup: you need a pdfvera plan and an API key from your pdfvera account (pdfvera.com/de/konto/ or pdfvera.com/pt-br/conta/), plus Node.js 18 or newer. The plugin asks for the key on install.

Tools, example prompts, privacy policy and troubleshooting: see the [main README](../README.md).
