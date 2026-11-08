import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import sharp from "sharp";
import { execFileSync } from "node:child_process";
const root = path.resolve(import.meta.dirname, "..");
const filename = path.join(root, "app/utils/imagePreprocess.server.ts");
function compile(source) {
  const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const moduleExports = {};
  new Function("require", "exports", javascript)(name => {
    if (name.endsWith("conversionModules.server")) return { getSharp: async () => sharp };
    // These collaborators are unused by the production checkerboard function.
    return {};
  }, moduleExports);
  return moduleExports.neutralizeTransparencyCheckerboard;
}
const baselineRef = process.env.CHECKER_BASELINE_REF || "origin/main";
const before = compile(execFileSync("git", ["show", `${baselineRef}:app/utils/imagePreprocess.server.ts`], { cwd: root, encoding: "utf8" }));
const after = compile(await readFile(filename, "utf8"));
const alphaShare = async input => {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let opaque = 0;
  for (let i=3;i<data.length;i+=info.channels) if(data[i]>=245) opaque++;
  return opaque/(info.width*info.height);
};
const fixtures = [
  { id:"existing-ui-mockup", bytes:await readFile(path.join(root,"tests/fixtures/IMG_8487.PNG")), shouldStrip:false },
  { id:"two-solid-neutral-bands", bytes:await sharp(Buffer.from('<svg width="160" height="120"><path fill="#f8f8f8" d="M0 0H160V60H0Z"/><path fill="#dedede" d="M0 60H160V120H0Z"/><path fill="#1565c0" d="M30 25H110V95H30Z"/></svg>')).png().toBuffer(), shouldStrip:false },
  { id:"actual-checkerboard", bytes:await sharp(Buffer.from('<svg width="160" height="120"><defs><pattern id="c" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#f8f8f8"/><path fill="#dedede" d="M0 0H10V10H0ZM10 10H20V20H10Z"/></pattern></defs><rect width="160" height="120" fill="url(#c)"/><path fill="#1565c0" d="M30 25H110V95H30Z"/></svg>')).png().toBuffer(), shouldStrip:true },
];
const results=[];
for(const fixture of fixtures){
  const sourceShare=await alphaShare(fixture.bytes);
  const beforeShare=await alphaShare(await before(fixture.bytes));
  const afterShare=await alphaShare(await after(fixture.bytes));
  results.push({id:fixture.id,sourceOpaqueShare:sourceShare,baselineOpaqueShare:beforeShare,candidateOpaqueShare:afterShare,intendedRemoval:fixture.shouldStrip,baselineFalsePositive:!fixture.shouldStrip&&beforeShare<sourceShare-0.01,candidateFalsePositive:!fixture.shouldStrip&&afterShare<sourceShare-0.01});
}
const directory=path.join(root,"tmp/run2-high-fidelity-remeasurement");
await mkdir(directory,{recursive:true});
await writeFile(path.join(directory,"checkerboard-root-cause.json"),JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
