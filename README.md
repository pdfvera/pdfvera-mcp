# pdfvera MCP server

Lets AI assistants like Claude and Cursor convert documents with [pdfvera](https://pdfvera.com/):

- **German PDF invoices into e-invoices:** XRechnung 3.0 (UBL and CII) and a ZUGFeRD PDF (EN 16931), checked against the official KoSIT rules, plus a check report. If mandatory data is missing, the assistant asks you for it.
- **Brazilian bank statement PDFs (extrato bancário) into OFX, CSV and Excel:** OFX for Domínio, Alterdata, Conta Azul or Omie. Files are only written when the entries add up to the balances printed in the statement.

The server runs on your computer. It reads the PDF from your disk, sends it to the [pdfvera API](https://pdfvera.com/de/e-rechnung-api/) with your API key and writes the result files next to the PDF.

## Requirements

- A pdfvera plan. The API and this server are included in every plan, with the same monthly quota as the website ([Preise](https://pdfvera.com/de/preise/), [Preços](https://pdfvera.com/pt-br/precos/)). Checking a PDF without writing files (`check_only`) is free.
- An API key, created in your pdfvera account ([Konto](https://pdfvera.com/de/konto/), [Conta](https://pdfvera.com/pt-br/conta/)).
- Node.js 18 or newer (not needed for the Claude Desktop extension).

## Install

**Claude Code**

```
claude mcp add pdfvera -e PDFVERA_API_KEY=pv_YOUR_KEY -- npx -y pdfvera-mcp@latest
```

Or as a plugin. The plugin has no MCP server; it is a skill that lets Claude call the pdfvera API with `curl`. It reads the key from `PDFVERA_API_KEY`, so first add `{ "env": { "PDFVERA_API_KEY": "pv_YOUR_KEY" } }` to `~/.claude/settings.json`, then:

```
/plugin marketplace add pdfvera/pdfvera-mcp
/plugin install pdfvera@pdfvera
```

**Cursor** (`~/.cursor/mcp.json`) and other MCP clients

```json
{
  "mcpServers": {
    "pdfvera": {
      "command": "npx",
      "args": ["-y", "pdfvera-mcp@latest"],
      "env": { "PDFVERA_API_KEY": "pv_YOUR_KEY" }
    }
  }
}
```

**Claude Desktop:** download [pdfvera.mcpb](https://pdfvera.com/mcp/pdfvera.mcpb), open it and enter the API key.

## Tools

| Tool | What it does |
| --- | --- |
| `convert_invoice` | PDF invoice to XRechnung (UBL, CII), ZUGFeRD and a check report. Returns missing fields as questions; answers and corrections go back in the next call. |
| `convert_bank_statement` | Brazilian bank statement PDF to OFX, CSV and Excel, after checking the balance. Handles password-protected PDFs (`password` or `cpf`). |
| `get_usage` | Your plan and how much of the monthly quota is used. |

Each converted document counts once against the monthly quota. The same PDF again in the same month does not count; `check_only` never counts.

## Example prompts

- "Convert ~/Rechnungen/RE-2026-0042.pdf into an XRechnung. It's an invoice I sent to a public authority."
- "Check whether all PDFs in ~/Rechnungen/November can be turned into e-invoices, without using my quota."
- "Converte o extrato ~/Downloads/extrato-itau-outubro.pdf em OFX para o Domínio."
- "The statement PDF is password protected; the account holder's CPF is 123.456.789-09. Try again."
- "How many conversions do I have left this month?"

## Privacy policy

This program stores nothing. It sends the PDF you name and your answers to pdfvera.com over HTTPS and writes the results to your disk. What pdfvera does with uploaded documents is described in the privacy policies: [Datenschutzerklärung](https://pdfvera.com/de/datenschutz/) (invoices) and [Política de privacidade](https://pdfvera.com/pt-br/privacidade/) (bank statements). In short: invoice PDFs are processed in the EU and not kept; bank statement PDFs sent through the API are never kept. Only a hash of each converted PDF is stored, so the same document is not counted twice. Bank statements that pdfvera's rules cannot read are sent to the Anthropic API to read the entries; Anthropic deletes that data within 30 days and does not train on it.

## Troubleshooting

- **"No pdfvera API key"**: set `PDFVERA_API_KEY` in the server configuration (for the plugin: in `~/.claude/settings.json` under `env`) and restart the assistant.
- **"The API key is missing, wrong or revoked"**: create a new key in your pdfvera account.
- **"no active plan" / "quota is used up"**: files need a plan; `check_only` works without one.
- **The assistant doesn't see the tools**: check that `node --version` prints 18 or newer and restart the assistant.
- **Not converted, fields missing**: the assistant should ask you for the listed fields; you can also answer them on [pdfvera.com](https://pdfvera.com/de/pdf-in-xrechnung/).

## Support

Questions and bugs: [GitHub issues](https://github.com/pdfvera/pdfvera-mcp/issues) or kontakt@pdfvera.com. Security reports: see [SECURITY.md](SECURITY.md).

## License

MIT for this MCP server. The pdfvera service itself is subject to its [terms](https://pdfvera.com/de/agb/).
