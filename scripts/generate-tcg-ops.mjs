// scripts/generate-tcg-ops.mjs
// Verbose generator: exports ALL non-admin queries/mutations/fragments from the installed package
// into ./graphql/*.js in the APP repo (not the package).

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const CANDIDATES = [
  "@sixbyfive/tcg-binder/queries",
  "@sixbyfive/tcg-binder/client",
];

// Exclude operations by name (case-insensitive)
const EXCLUDE = /^(admin)/i;
// If you also want to hide commerce for now, use:
// const EXCLUDE = /^(admin|market|listing|offer|trade)/i;

function isDocumentNode(v) {
  return v && typeof v === "object" && v.kind === "Document" && Array.isArray(v.definitions);
}
function isFragmentDoc(doc) {
  return doc?.definitions?.some((d) => d.kind === "FragmentDefinition");
}
function opType(doc) {
  const op = doc?.definitions?.find((d) => d.kind === "OperationDefinition");
  return op?.operation || null; // "query" | "mutation" | "subscription" | null
}
function header(title, from) {
  return `// AUTO-GENERATED in app: ${title}\n// Source: ${from}\n// Excludes: ${EXCLUDE}\n\n`;
}
function exportLine(fromPath, name) {
  return `export { ${name} } from "${fromPath}";`;
}

async function importFromCandidates() {
  let lastErr;
  for (const spec of CANDIDATES) {
    try {
      // Prefer ESM import
      const m = await import(spec);
      console.log(`[generate-tcg] imported: ${spec} (ESM)`);
      return { client: m, from: spec };
    } catch (e) {
      lastErr = e;
      // Try resolving a file path and importing that
      try {
        const resolved = requireResolve(spec);
        const mfile = await import(pathToFileURL(resolved).href);
        console.log(`[generate-tcg] imported: ${resolved} (file)`);
        return { client: mfile, from: spec };
      } catch (e2) {
        lastErr = e2;
        console.log(`[generate-tcg] failed import: ${spec} -> ${e2?.message}`);
      }
    }
  }
  throw new Error(
    `Could not import GraphQL docs from package. Tried: ${CANDIDATES.join(
      ", "
    )}\nLast error: ${lastErr?.message}`
  );
}

// CommonJS-safe resolve wrapper
function requireResolve(spec) {
  try {
    // eslint-disable-next-line no-undef
    return require.resolve(spec);
  } catch {
    // try resolution relative to app root node_modules
    const candidate = path.resolve("node_modules", ...spec.split("/"));
    return candidate;
  }
}

async function main() {
  console.log("[generate-tcg] starting in", process.cwd());

  const { client, from } = await importFromCandidates();

  const allKeys = Object.keys(client).sort();
  console.log(`[generate-tcg] total exported keys from ${from}: ${allKeys.length}`);

  const queries = [];
  const mutations = [];
  const fragments = [];

  for (const key of allKeys) {
    const value = client[key];

    const looksLikeDoc =
      (key.endsWith("Document") || key.endsWith("Doc")) && isDocumentNode(value);
    if (!looksLikeDoc) continue;

    if (EXCLUDE.test(key)) {
      console.log(`[generate-tcg] excluded by name: ${key}`);
      continue;
    }

    if (isFragmentDoc(value)) {
      fragments.push(key);
      continue;
    }

    const t = opType(value);
    if (t === "query") queries.push(key);
    else if (t === "mutation") mutations.push(key);
    else {
      console.log(`[generate-tcg] skipped (unsupported op type): ${key}`);
    }
  }

  queries.sort();
  mutations.sort();
  fragments.sort();

  console.log(`[generate-tcg] queries:   ${queries.length}`);
  console.log(`[generate-tcg] mutations: ${mutations.length}`);
  console.log(`[generate-tcg] fragments: ${fragments.length}`);

  const outDir = path.resolve("graphql");
  await fs.mkdir(outDir, { recursive: true });

  const qOut = header("Queries", from) + queries.map((k) => exportLine(from, k)).join("\n") + "\n";
  const mOut = header("Mutations", from) + mutations.map((k) => exportLine(from, k)).join("\n") + "\n";
  const fOut = header("Fragments", from) + fragments.map((k) => exportLine(from, k)).join("\n") + "\n";
  const barrel = `// Convenience barrel for the app\nexport * from "./tcg-queries";\nexport * from "./tcg-mutations";\nexport * from "./tcg-fragments";\n`;

  await fs.writeFile(path.join(outDir, "tcg-queries.js"), qOut, "utf8");
  await fs.writeFile(path.join(outDir, "tcg-mutations.js"), mOut, "utf8");
  await fs.writeFile(path.join(outDir, "tcg-fragments.js"), fOut, "utf8");
  await fs.writeFile(path.join(outDir, "index.js"), barrel, "utf8");

  console.log(`[generate-tcg] wrote graphql/tcg-queries.js`);
  console.log(`[generate-tcg] wrote graphql/tcg-mutations.js`);
  console.log(`[generate-tcg] wrote graphql/tcg-fragments.js`);
  console.log(`[generate-tcg] wrote graphql/index.js`);
}

main().catch((e) => {
  console.error("[generate-tcg] ERROR:", e);
  process.exit(1);
});
