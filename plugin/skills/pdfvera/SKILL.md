---
name: pdfvera
description: Convert German PDF invoices into XRechnung or ZUGFeRD e-invoices, and Brazilian bank statement PDFs (extrato bancário) into OFX, CSV or Excel, with the pdfvera tools. Use when the user wants an e-invoice (E-Rechnung, XRechnung, ZUGFeRD, EN 16931) from a PDF invoice, or an OFX file for Domínio, Alterdata, Conta Azul or Omie from a bank statement PDF.
---

# Converting documents with pdfvera

The pdfvera tools read a PDF from the user's computer, convert it with the pdfvera service and write the result files next to the PDF (or into `output_dir`). They need a pdfvera plan and API key; `get_usage` shows the plan and the monthly quota.

## German invoice to e-invoice (`convert_invoice`)

1. Ask whether the user issued the invoice or received it, and pass `role` (`issuer` or `recipient`). It only changes the wording of the questions.
2. Call `convert_invoice` with `pdf_path`. For several PDFs, or when the user only wants to know whether a PDF works, use `check_only: true` first: it writes nothing and uses no quota.
3. If the result lists `missing` fields, ask the user for each one, using its `label`, `help` and `example`. Never invent values such as an IBAN, a VAT ID or a Leitweg-ID. When a field offers an `escape` value and the user confirms it fits (for example, the buyer is not a public authority), use that value.
4. Call again with the same `pdf_path` and the answers in `answers`, keyed by `field`. If a value read from the PDF is wrong, pass the fix in `corrections`, keyed by one of the field's `keys` (for example `fix:number`).
5. When the invoice converts, tell the user which files were written: XRechnung UBL and CII, the ZUGFeRD PDF if it passed its check, and the check report (`pruefbericht.html`). Converting the same PDF again in the same month does not use quota.

If `reasons` say the PDF cannot be converted as it is (for example, it is not an invoice), tell the user and stop.

## Brazilian bank statement to OFX (`convert_bank_statement`)

1. Ask which accounting system the OFX is for and pass `profile`: `dominio` (default), `alterdata`, `contaazul` or `omie`.
2. Call `convert_bank_statement` with `pdf_path`. Files are only written when the entries add up to the balances printed in the statement.
3. If `cause` is `password`, ask the user for the PDF password, or for the account holder's CPF so the tool can try the banks' usual passwords, and call again.
4. If the balance does not reconcile, nothing is written and nothing is counted. Tell the user and show the `reconciliation` figures.

## Errors

Error texts from the tools are written for the user; pass them on. For "no active plan" or "quota is used up", point to the pricing pages named in the error. `check_only` works without a plan.
