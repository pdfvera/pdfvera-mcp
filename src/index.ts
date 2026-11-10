// pdfvera MCP server (stdio). Reads the PDF from the local disk, calls the pdfvera API (https://pdfvera.com/openapi.json)
// with the user's API key and writes the result files next to the PDF. Nothing is stored by this program.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";

const VERSION = "1.0.1";
const BASE = (process.env.PDFVERA_API_URL || "https://pdfvera.com").replace(/\/$/, "");
const KEY = process.env.PDFVERA_API_KEY || "";
const MAX = 20 * 1024 * 1024;

const NO_KEY =
  "No pdfvera API key. Create one in your pdfvera account (https://pdfvera.com/de/konto/ or https://pdfvera.com/pt-br/conta/) and set it as PDFVERA_API_KEY in this MCP server's configuration (or in the pdfvera plugin settings), then restart. The API is included in every pdfvera plan.";

const ERRORS: Record<string, string> = {
  key: "The API key is missing, wrong or revoked. Create a new one in the pdfvera account.",
  subscription: "This pdfvera account has no active plan. Files need a plan (https://pdfvera.com/de/preise/ or https://pdfvera.com/pt-br/precos/); check_only works without one.",
  quota: "The monthly quota of this pdfvera plan is used up.",
  size: "The PDF is larger than 20 MB.",
  type: "The file is not a PDF.",
  pages: "The PDF has too many pages (invoices: 30, bank statements: 300).",
  scanned: "The PDF has too many scanned pages (invoices: 10, bank statements: 40).",
  pagesize: "A page of the PDF is too large.",
  rate: "Too many requests. Wait a minute and try again.",
  busy: "The converter is busy. Try again in a minute.",
  unavailable: "The converter is temporarily unavailable. Try again later.",
  form: "The answers could not be read (must be field → text, at most 4096 characters in total).",
  profile: "Unknown accounting system profile.",
  failed: "The conversion failed. Try again later.",
};

type Json = Record<string, any>;
const ok = (text: string, data: Json) => ({ content: [{ type: "text" as const, text }], structuredContent: data });
const fail = (text: string) => ({ content: [{ type: "text" as const, text }], isError: true });

async function readPdf(path: string) {
  const file = resolve(path);
  const s = await stat(file).catch(() => null);
  if (!s?.isFile()) throw new Error(`File not found: ${file}`);
  if (s.size > MAX) throw new Error(ERRORS.size);
  const buf = await readFile(file);
  if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error(ERRORS.type);
  return { file, buf };
}

async function call(path: string, init: RequestInit = {}) {
  const headers: Record<string, string> = { authorization: `Bearer ${KEY}`, "user-agent": `pdfvera-mcp/${VERSION}` };
  if (process.env.PDFVERA_TEST_KEY) headers["x-test-key"] = process.env.PDFVERA_TEST_KEY;
  const r = await fetch(`${BASE}${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) } });
  const d = (await r.json().catch(() => ({}))) as Json;
  if (r.status !== 200) {
    const msg = ERRORS[d.error] || `pdfvera returned HTTP ${r.status}${d.error ? ` (${d.error})` : ""}.`;
    const extra = d.error === "quota" ? ` Used ${d.used} of ${d.quota}.` : d.scope ? ` Limit: per ${d.scope}.` : "";
    throw new Error(msg + extra);
  }
  return d;
}

/** Writes outputs (name → Base64) into dir; file names are reduced to a safe basename. */
async function save(outputs: Json | undefined, dir: string, prefix: string) {
  const written: string[] = [];
  if (!outputs) return written;
  await mkdir(dir, { recursive: true });
  for (const [name, b64] of Object.entries(outputs)) {
    const safe = basename(String(name)).replace(/[^\w.-]/g, "_");
    const target = join(dir, prefix ? `${prefix}.${safe}` : safe);
    await writeFile(target, Buffer.from(String(b64), "base64"));
    written.push(target);
  }
  return written;
}

const server = new McpServer({ name: "pdfvera", version: VERSION });

server.registerTool(
  "convert_invoice",
  {
    title: "PDF invoice to XRechnung and ZUGFeRD",
    description:
      "Convert a German PDF invoice into an e-invoice: XRechnung 3.0 (UBL and CII), a ZUGFeRD PDF (EN 16931) and a check report, checked against the KoSIT rules. " +
      "Files are written next to the PDF. If mandatory data is missing, nothing is written and the result lists the missing fields with a German label, help text and example: " +
      "ask the user for them (or use the offered escape value when it fits), then call again with the same PDF and `answers`. Wrong values read from the PDF are fixed with `corrections` (keys from found[].edit[].key, e.g. fix:number). " +
      "Each converted invoice counts once against the monthly quota of the user's pdfvera plan; the same PDF again in the same month does not count, check_only never counts.",
    inputSchema: {
      pdf_path: z.string().describe("Path of the PDF invoice on this computer"),
      answers: z.record(z.string(), z.string()).optional().describe("Values for missing fields, keyed by questions[].field, e.g. {\"buyer_reference\": \"04011000-12345-06\"}"),
      corrections: z.record(z.string(), z.string()).optional().describe("Corrections of values read from the PDF, keyed by found[].edit[].key, e.g. {\"fix:number\": \"RE-2026-0042\"}"),
      role: z.enum(["issuer", "recipient"]).default("issuer").describe("Whether the user issued (issuer) or received (recipient) the invoice; only changes the wording of the questions"),
      check_only: z.boolean().default(false).describe("Only check, write no files and use no quota"),
      output_dir: z.string().optional().describe("Folder for the result files; default: the PDF's folder"),
    },
    annotations: { title: "Convert invoice", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async ({ pdf_path, answers, corrections, role, check_only, output_dir }) => {
    if (!KEY) return fail(NO_KEY);
    try {
      const { file, buf } = await readPdf(pdf_path);
      const fd = new FormData();
      fd.append("pdf", new Blob([buf], { type: "application/pdf" }), basename(file));
      fd.append("form", JSON.stringify({ ...(answers || {}), ...(corrections || {}) }));
      if (check_only) fd.append("mode", "preview");
      const d = await call("/api/v1/de/convert", { method: "POST", body: fd });
      const stem = basename(file, extname(file));
      const files = d.deliverable && !check_only ? await save(d.outputs, output_dir ? resolve(output_dir) : dirname(file), stem) : [];
      const missing = (d.questions || [])
        .filter((q: Json) => q.missing || q.error)
        .map((q: Json) => ({ field: q.field, label: q.label?.[role] || q.label, help: q.help?.[role] || q.help, why: q.why, example: q.example, error: q.error, escape: q.escape }));
      const result = {
        deliverable: !!d.deliverable,
        files,
        invoice: d.invoice,
        missing,
        corrections_rejected: d.fix_errors || undefined,
        found: (d.found || []).map((f: Json) => ({ field: f.field, label: f.label, value: f.value, corrected: f.corrected, keys: (f.edit || []).map((e: Json) => e.key) })),
        reasons: d.reasons,
        used: d.used,
        quota: d.quota,
      };
      let text: string;
      if (d.deliverable && files.length) text = `Converted. Files written:\n${files.join("\n")}\nQuota: ${d.used} of ${d.quota} used this month.`;
      else if (d.deliverable) text = "The invoice can be converted. Call again without check_only to write the files.";
      else if (missing.length) text = `Not converted yet: ${missing.length} field(s) missing or wrong (${missing.map((m: Json) => m.field).join(", ")}). Ask the user and call again with answers.`;
      else text = `This PDF cannot be converted as it is. Reasons: ${(d.reasons || []).join(", ") || "unknown"}.`;
      if (d.fix_errors) text += `\nRejected corrections: ${JSON.stringify(d.fix_errors)}`;
      return ok(text, result);
    } catch (e) {
      return fail((e as Error).message);
    }
  },
);

server.registerTool(
  "convert_bank_statement",
  {
    title: "Brazilian bank statement PDF to OFX, CSV and Excel",
    description:
      "Convert a Brazilian bank statement PDF (extrato bancário) into OFX for an accounting system, CSV and Excel. The entries are summed and checked against the balances printed in the statement; " +
      "files are only written when the balance reconciles. Password-protected PDFs need `password` (or `cpf` to try the banks' usual passwords). " +
      "Each converted statement counts once against the monthly quota of the user's pdfvera plan; check_only never counts.",
    inputSchema: {
      pdf_path: z.string().describe("Path of the statement PDF on this computer"),
      profile: z.enum(["dominio", "alterdata", "contaazul", "omie"]).default("dominio").describe("Accounting system the OFX is for"),
      password: z.string().optional().describe("PDF password"),
      cpf: z.string().optional().describe("Account holder's CPF, to try the banks' usual passwords"),
      check_only: z.boolean().default(false).describe("Only check, write no files and use no quota"),
      output_dir: z.string().optional().describe("Folder for the result files; default: the PDF's folder"),
    },
    annotations: { title: "Convert bank statement", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  async ({ pdf_path, profile, password, cpf, check_only, output_dir }) => {
    if (!KEY) return fail(NO_KEY);
    try {
      const { file, buf } = await readPdf(pdf_path);
      const fd = new FormData();
      fd.append("pdf", new Blob([buf], { type: "application/pdf" }), basename(file));
      fd.append("profile", profile);
      if (password) fd.append("password", password);
      if (cpf) fd.append("cpf", cpf);
      if (check_only) fd.append("mode", "preview");
      const d = await call("/api/v1/br/convert", { method: "POST", body: fd });
      const files = d.ok && !check_only ? await save(d.outputs, output_dir ? resolve(output_dir) : dirname(file), "") : [];
      const result = { ok: !!d.ok, files, bank: d.bank, transactions: d.transactions, reconciliation: d.reconciliation, accounts: d.accounts, cause: d.cause, error: d.error, used: d.used, quota: d.quota };
      let text: string;
      if (d.ok && files.length) text = `Converted (${d.transactions} entries, balance checked). Files written:\n${files.join("\n")}\nQuota: ${d.used} of ${d.quota} used this month.`;
      else if (d.ok) text = `The statement reconciles (${d.transactions} entries). Call again without check_only to write the files.`;
      else if (d.cause === "password") text = "The PDF is password protected. Ask the user for the password (or the account holder's CPF) and call again.";
      else text = `Not converted: ${d.error || d.cause || "the balance does not reconcile"}. No file was written and nothing was counted.`;
      return ok(text, result);
    } catch (e) {
      return fail((e as Error).message);
    }
  },
);

server.registerTool(
  "get_usage",
  {
    title: "pdfvera plan and quota",
    description: "Show the user's pdfvera plan and how many documents of the monthly quota are used.",
    annotations: { title: "Plan and quota", readOnlyHint: true, openWorldHint: true },
  },
  async () => {
    if (!KEY) return fail(NO_KEY);
    try {
      const d = await call("/api/v1/usage");
      if (!d.plan) return ok("No active pdfvera plan. check_only works without one.", d);
      return ok(`Plan ${d.plan}: ${d.used} of ${d.quota} used; renews ${new Date(d.resets * 1000).toISOString().slice(0, 10)}.`, d);
    } catch (e) {
      return fail((e as Error).message);
    }
  },
);

await server.connect(new StdioServerTransport());
