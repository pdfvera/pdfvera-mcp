---
name: pdfvera
description: Convert German PDF invoices into XRechnung or ZUGFeRD e-invoices, and Brazilian bank statement PDFs (extrato bancário) into OFX, CSV or Excel, with the pdfvera API. Use when the user wants an e-invoice (E-Rechnung, XRechnung, ZUGFeRD, EN 16931) from a PDF invoice, or an OFX file for Domínio, Alterdata, Conta Azul or Omie from a bank statement PDF.
---

# Converting documents with pdfvera

pdfvera converts a PDF on the user's computer through its HTTPS API (`https://pdfvera.com/api/v1/`, documented at https://pdfvera.com/openapi.json) and you write the result files next to the PDF. It needs a pdfvera plan and an API key. Each converted document counts once against the plan's monthly quota; the same PDF again in the same month is free, and `mode=preview` (check only) never counts.

## API key

The key is read from the environment variable `PDFVERA_API_KEY`. Check it without printing it:

```sh
test -n "$PDFVERA_API_KEY" && echo "key set" || echo "no key"
```

If it is not set, stop and tell the user:

1. Create a key in the pdfvera account: https://pdfvera.com/de/konto/ (or https://pdfvera.com/pt-br/conta/). The API is included in every plan.
2. Add it to `~/.claude/settings.json` (create the file if needed), then restart Claude Code:
   ```json
   { "env": { "PDFVERA_API_KEY": "pv_..." } }
   ```

Never print, echo or log the key, never ask the user to paste it into the chat, and always pass it as `"$PDFVERA_API_KEY"` so it stays out of the transcript.

## Calling the API

Save the response to a temporary file and never print it raw: it contains the result files in Base64. Then run the reader below. It writes the files, drops the Base64 and the HTML report from the output, and prints the rest as JSON.

```sh
RESP="$(mktemp)"
STATUS=$(curl -sS -o "$RESP" -w '%{http_code}' -H "Authorization: Bearer $PDFVERA_API_KEY" \
  -F "pdf=@/path/to/file.pdf;type=application/pdf" \
  ...fields for the track, see below... \
  https://pdfvera.com/api/v1/de/convert)
echo "HTTP $STATUS"
python3 - "$RESP" "/path/to/output-folder" "file-name-prefix" <<'PY'
import base64, json, os, re, sys
resp, outdir, prefix = sys.argv[1:4]
d = json.load(open(resp))
outputs = d.pop("outputs", None) or {}
d.pop("report_html", None)
written = []
if outputs:
    os.makedirs(outdir, exist_ok=True)
    for name, b64 in outputs.items():
        safe = re.sub(r"[^\w.-]", "_", os.path.basename(str(name)))
        path = os.path.join(outdir, f"{prefix}.{safe}" if prefix else safe)
        with open(path, "wb") as f:
            f.write(base64.b64decode(b64))
        written.append(path)
d["files_written"] = written
print(json.dumps(d, ensure_ascii=False, indent=1))
PY
rm -f "$RESP"
```

If `python3` is missing, do the same with `node`. The output folder is the PDF's folder unless the user wants another one. The PDF must be at most 20 MB.

## German invoice to e-invoice (`/api/v1/de/convert`)

Fields: `pdf`, optional `form` (JSON object of field → text, at most 4096 characters), optional `mode=preview`. Use the PDF's file name without `.pdf` as the prefix.

1. Ask whether the user issued the invoice or received it. The questions in the response have `label` and `help` texts per role (`issuer` or `recipient`); use the matching ones.
2. Send the PDF. For several PDFs, or when the user only wants to know whether a PDF works, add `-F mode=preview` first: nothing is written and no quota is used.
3. If `deliverable` is false and `questions` has entries with `missing` or `error`, ask the user for each one, using its `label`, `help`, `why` and `example`. Never invent values such as an IBAN, a VAT ID or a Leitweg-ID. When a question offers an `escape` value and the user confirms it fits (for example, the buyer is not a public authority), use that value.
4. Send the same PDF again with the answers. Write them to a JSON file and send it with `-F "form=<answers.json"`, so that quotes in the values are safe. Keys are the questions' `field`. A wrong value read from the PDF is fixed with a key from the `edit[].key` list of its entry in `found`, for example `{"fix:number": "RE-2026-0042"}`. Answers and corrections go in the same object. `fix_errors` lists corrections that were rejected.
5. When `deliverable` is true, tell the user which files were written: XRechnung UBL and CII, the ZUGFeRD PDF if it passed its check, and the check report (`pruefbericht.html`), plus `used` of `quota` this month.

If `reasons` say the PDF cannot be converted as it is (for example, it is not an invoice), tell the user and stop.

## Brazilian bank statement to OFX (`/api/v1/br/convert`)

Fields: `pdf`, `profile`, optional `password`, optional `cpf`, optional `mode=preview`. No prefix (pass `""`); the file names come from the response. Send `password` and `cpf` with `--form-string` so that special characters are safe.

1. Ask which accounting system the OFX is for and pass `-F profile=...`: `dominio` (default), `alterdata`, `contaazul` or `omie`.
2. Send the PDF. Files only come back when `ok` is true, meaning the entries add up to the balances printed in the statement. Report `bank`, `transactions` and the files written.
3. If `cause` is `password`, ask the user for the PDF password, or for the account holder's CPF so pdfvera can try the banks' usual passwords, and send again.
4. If `ok` is false for another reason, nothing was written and nothing was counted. Tell the user and show the `reconciliation` figures.

## Plan and quota (`/api/v1/usage`)

```sh
curl -sS -H "Authorization: Bearer $PDFVERA_API_KEY" https://pdfvera.com/api/v1/usage
```

Returns `plan`, `used`, `quota` and `resets` (Unix time). `plan` is null without an active plan.

## Errors

Any status other than 200 comes with `{"error": "<code>"}`. Tell the user what it means:

| code | meaning |
|---|---|
| `key` | The API key is missing, wrong or revoked. Create a new one in the pdfvera account. |
| `subscription` | No active plan. Files need a plan (https://pdfvera.com/de/preise/ or https://pdfvera.com/pt-br/precos/); `mode=preview` works without one. |
| `quota` | The monthly quota is used up (`used` of `quota`). |
| `size` | The PDF is larger than 20 MB. |
| `type` | The file is not a PDF. |
| `pages` | Too many pages (invoices: 30, bank statements: 300). |
| `scanned` | Too many scanned pages (invoices: 10, bank statements: 40). |
| `pagesize` | A page of the PDF is too large. |
| `rate` | Too many requests. Wait a minute and try again. |
| `busy`, `unavailable` | The converter is busy or temporarily unavailable. Try again later. |
| `form` | The answers could not be read (must be field → text, at most 4096 characters in total). |
| `profile` | Unknown accounting system profile. |
| `failed` | The conversion failed. Try again later. |
