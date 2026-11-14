import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const applicationRoot = path.join(root, "app") + path.sep;

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("~/")) specifier = pathToFileURL(path.join(root, "app", specifier.slice(2))).href;
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (!specifier.startsWith(".") && !specifier.startsWith("file:")) throw error;
    const base = new URL(specifier, context.parentURL);
    if (base.protocol !== "file:") throw error;
    for (const extension of [".ts", ".tsx"]) {
      const candidate = new URL(base.href + extension);
      const filename = fileURLToPath(candidate);
      if (!filename.startsWith(applicationRoot)) continue;
      if (await stat(filename).then(value => value.isFile(), () => false)) return { url: candidate.href, shortCircuit: true };
    }
    throw error;
  }
}

export async function load(url, context, nextLoad) {
  if (url.startsWith("file:") && /\.tsx?$/.test(url)) {
    const filename = fileURLToPath(url);
    if (filename.startsWith(applicationRoot)) {
      const source = await readFile(filename, "utf8");
      const result = ts.transpileModule(source, {
        fileName: filename,
        reportDiagnostics: true,
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
      });
      if (result.diagnostics?.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(result.diagnostics, {
        getCurrentDirectory: () => root, getCanonicalFileName: value => value, getNewLine: () => "\n",
      }));
      return { format: "module", source: result.outputText, shortCircuit: true };
    }
  }
  return nextLoad(url, context);
}
