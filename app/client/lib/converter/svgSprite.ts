const SVG = "http://www.w3.org/2000/svg";
const XMLNS = "http://www.w3.org/2000/xmlns/";
const XLINK = "http://www.w3.org/1999/xlink";

export const SPRITE_LIMITS = {
  files: 12,
  fileBytes: 128 * 1024,
  batchBytes: 512 * 1024,
  nodesPerFile: 1000,
  nodesPerBatch: 4000,
  depth: 24,
  geometryPerFile: 6000,
  geometryPerBatch: 16000,
  outputBytes: 768 * 1024,
} as const;

const COORDINATE_LIMIT = 100000;
const MIN_VIEWBOX_SIDE = 0.001;
const NUMBER_SOURCE = "[+-]?(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+)(?:[eE][+-]?[0-9]+)?";
const NUMBER = new RegExp(`^${NUMBER_SOURCE}$`);
const ID_SOURCE = "[A-Za-z0-9_.:-]{1,80}";
const ID = new RegExp(`^${ID_SOURCE}$`);
const HASH = new RegExp(`^#(${ID_SOURCE})$`);
const PAINT_URL = new RegExp(`^url\\(\\s*(['"]?)#(${ID_SOURCE})\\1\\s*\\)$`);
const XML_DECLARATION = /^<\?xml[ \t\r\n]+version=(["'])1\.0\1(?:[ \t\r\n]+encoding=(["'])utf-8\2)?(?:[ \t\r\n]+standalone=(["'])(?:yes|no)\3)?[ \t\r\n]*\?>/i;
const ASPECT = /^(?:none|x(?:Min|Mid|Max)Y(?:Min|Mid|Max)(?:[ \t]+(?:meet|slice))?)$/;
const SHAPES = new Set(["path", "rect", "circle", "ellipse", "line", "polyline", "polygon"]);
const GRADIENTS = new Set(["linearGradient", "radialGradient"]);
const APPEARANCE = new Set([
  "fill", "stroke", "color", "fill-opacity", "stroke-opacity", "opacity",
  "fill-rule", "stroke-width", "stroke-linecap", "stroke-linejoin",
  "stroke-miterlimit", "vector-effect",
]);
const GEOMETRY: Readonly<Record<string, readonly string[]>> = {
  path: ["d"], rect: ["x", "y", "width", "height", "rx", "ry"],
  circle: ["cx", "cy", "r"], ellipse: ["cx", "cy", "rx", "ry"],
  line: ["x1", "y1", "x2", "y2"], polyline: ["points"], polygon: ["points"],
  linearGradient: ["x1", "y1", "x2", "y2"],
  radialGradient: ["cx", "cy", "fx", "fy", "r", "fr"],
};
const ARITIES = new Map(Object.entries({
  M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0,
}));
const TRANSFORM_ARITIES = new Map(Object.entries({
  matrix: [6], translate: [1, 2], scale: [1, 2], rotate: [1, 3], skewX: [1], skewY: [1],
}));

export type SpriteSource = { name: string; text: string };
type Box = readonly [number, number, number, number];
export type SpriteIcon = { id: string; label: string; viewBox: string; aspect: string; preview: string };
export type SpriteResult = { markup: string; bytes: number; icons: SpriteIcon[] };

type Reference = { element: Element; attribute: string; sourceId: string; paint: boolean };
type Budget = { nodes: number; geometry: number };

export class SpriteInputError extends Error {
  constructor(message: string, readonly fileIndex?: number) {
    super(message);
    this.name = "SpriteInputError";
  }
}

function reject(message: string): never {
  throw new SpriteInputError(message);
}

function xml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  if (doc.documentElement?.localName !== "svg" || doc.querySelector("parsererror") || doc.doctype) {
    reject("This file is not well-formed SVG markup.");
  }
  return doc;
}

function inputDocument(text: string): Document {
  const markup = text.replace(/^\uFEFF/, "").replace(XML_DECLARATION, "");
  if (/<\?|<!\s*(?:doctype|entity|\[CDATA\[)/i.test(markup)) {
    reject("XML directives, document types, entities and CDATA are not supported. Export a plain SVG.");
  }
  return xml(markup);
}

function finite(token: string): number {
  const number = Number(token);
  if (!Number.isFinite(number) || Math.abs(number) > COORDINATE_LIMIT) {
    reject("A number in the artwork is outside the supported range (±100,000).");
  }
  return number;
}

function numeric(value: string, suffixes: readonly string[] = [], min = -Infinity, max = Infinity): number {
  const suffix = suffixes.find((unit) => value.endsWith(unit));
  const token = suffix ? value.slice(0, -suffix.length) : value;
  if (!NUMBER.test(token)) reject("An SVG coordinate, length or opacity is invalid or uses an unsupported unit.");
  const number = finite(token);
  if (number < min || number > max) reject("An SVG coordinate, length or opacity is outside its allowed range.");
  return number;
}

/** SVG lists and paths allow adjacent numbers when the second number starts with a sign or decimal point. */
class NumericScanner {
  position = 0;
  readonly number = new RegExp(NUMBER_SOURCE, "y");

  constructor(readonly text: string) {}

  spaces() {
    while (/[ \t\r\n]/.test(this.text[this.position] || "")) this.position++;
  }

  take(comma: boolean, arcFlag = false) {
    this.spaces();
    if (comma && this.text[this.position] === ",") {
      this.position++;
      this.spaces();
    }
    if (arcFlag) {
      const flag = this.text[this.position];
      if (flag !== "0" && flag !== "1") reject("An SVG arc flag must be 0 or 1.");
      this.position++;
      return Number(flag);
    }
    this.number.lastIndex = this.position;
    const token = this.number.exec(this.text);
    if (!token) reject("An SVG path or numeric list has invalid syntax.");
    this.position = this.number.lastIndex;
    return finite(token[0]);
  }
}

function numbers(value: string, max: number, adjacent = false): number[] {
  const scanner = new NumericScanner(value);
  const parsed: number[] = [];
  scanner.spaces();
  while (scanner.position < value.length) {
    if (parsed.length === max) reject("An SVG numeric list has too many values.");
    parsed.push(scanner.take(parsed.length > 0));
    const end = scanner.position;
    scanner.spaces();
    if (!adjacent && end === scanner.position && scanner.position < value.length && value[end] !== ",") {
      reject("Separate SVG numbers with a space or comma.");
    }
  }
  return parsed;
}

function boxFor(root: Element): Box {
  const value = root.getAttribute("viewBox");
  if (value === null) {
    const width = root.getAttribute("width");
    const height = root.getAttribute("height");
    if (!width || !height) reject("Add a viewBox, or set both width and height in pixels.");
    return [0, 0, numeric(width.trim(), ["px"], MIN_VIEWBOX_SIDE), numeric(height.trim(), ["px"], MIN_VIEWBOX_SIDE)];
  }
  const box = numbers(value, 4);
  if (box.length !== 4 || box[2] < MIN_VIEWBOX_SIDE || box[3] < MIN_VIEWBOX_SIDE) {
    reject("The viewBox needs four numbers and a width and height of at least 0.001.");
  }
  return [box[0], box[1], box[2], box[3]];
}

function spendGeometry(budget: Budget, count: number) {
  budget.geometry += count;
  if (budget.geometry > SPRITE_LIMITS.geometryPerFile) reject("This icon has too many path segments or geometry values. Simplify it before export.");
}

function validatePath(value: string, budget: Budget) {
  const scanner = new NumericScanner(value);
  let command = "";
  let count = 0;
  scanner.spaces();
  if (!/[Mm]/.test(value[scanner.position] || "")) reject("An SVG path must start with M or m.");
  while (scanner.position < value.length) {
    const next = value[scanner.position];
    const explicit = /[MmZzLlHhVvCcSsQqTtAa]/.test(next);
    if (explicit) {
      command = next.toUpperCase();
      scanner.position++;
    }
    const arity = ARITIES.get(command);
    if (arity === undefined) reject("An SVG path has an invalid command.");
    if (!explicit && arity === 0) reject("An SVG path has unexpected data after a close command.");
    spendGeometry(budget, 1);
    for (let i = 0; i < arity; i++) {
      const number = scanner.take(i > 0 || !explicit, command === "A" && (i === 3 || i === 4));
      if (command === "A" && i < 2 && number < 0) reject("An SVG arc has a negative radius.");
    }
    count += arity;
    if (command === "M") command = "L";
    scanner.spaces();
  }
  if (count < 2) reject("An SVG path has no valid coordinates.");
}

function boundedTransform(matrix: DOMMatrixReadOnly) {
  const { a, b, c, d, e, f } = matrix;
  const determinant = a * d - b * c;
  if (
    [a, b, c, d, e, f].some((value) => !Number.isFinite(value) || Math.abs(value) > COORDINATE_LIMIT) ||
    Math.abs(determinant) < Math.max(Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d), 1) / COORDINATE_LIMIT
  ) {
    reject("The combined SVG transform is too large or collapses the artwork. Flatten transformations before export.");
  }
  return matrix;
}

function transformMatrix(name: string, values: number[]) {
  const [x, y, z] = values;
  const matrix = new DOMMatrix();
  switch (name) {
    case "matrix": return new DOMMatrix(values);
    case "translate": return matrix.translate(x, y ?? 0);
    case "scale": return matrix.scale(x, y ?? x);
    case "rotate": return y === undefined ? matrix.rotate(x) : matrix.translate(y, z).rotate(x).translate(-y, -z);
    case "skewX": return matrix.skewX(x);
    case "skewY": return matrix.skewY(x);
    default: return reject("An SVG transform is unsupported.");
  }
}

function validateTransform(value: string, budget: Budget) {
  const transform = /[ \t\r\n]*([A-Za-z]+)\(([^()]*)\)/y;
  let combined: DOMMatrixReadOnly = new DOMMatrix();
  let end = 0;
  let count = 0;
  while (end < value.length) {
    transform.lastIndex = end;
    const match = transform.exec(value);
    const arities = match && TRANSFORM_ARITIES.get(match[1]);
    if (!match || !arities || ++count > 8) reject("Use up to eight standard SVG transforms per element.");
    const values = numbers(match[2], 6);
    if (!arities.includes(values.length)) reject("An SVG transform has the wrong number of values.");
    combined = boundedTransform(combined.multiply(boundedTransform(transformMatrix(match[1], values))));
    spendGeometry(budget, values.length);
    end = transform.lastIndex;
    const separator = /^[ \t\r\n]*(?:,[ \t\r\n]*)?/.exec(value.slice(end))?.[0] || "";
    end += separator.length;
    if (end === value.length && separator.includes(",")) reject("An SVG transform list ends with a comma.");
  }
  if (!count) reject("An SVG transform is empty.");
  return combined;
}

function plainColor(value: string): boolean {
  // Named colors, hexadecimal colors, currentColor, and numeric rgb()/hsl() only.
  // The lexical gate excludes escapes, comments, var(), arbitrary functions and URLs.
  return (
    /^#[0-9A-Fa-f]{3,8}$/.test(value) ||
    (/^[a-zA-Z]+$/.test(value) && !/^(?:inherit|initial|unset|revert|revertlayer)$/i.test(value)) ||
    (/^(?:rgba?|hsla?)\([0-9eE+.,%/ \t-]{3,120}\)$/i.test(value))
  ) && CSS.supports("color", value);
}

function safeLabel(value: string, fallback: string) {
  return value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100) || fallback;
}

function sourceName(name: string) {
  return name.replace(/\.svg$/i, "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function symbolId(name: string, used: Set<string>) {
  const base = `icon-${sourceName(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 45).replace(/-$/, "") || "svg"}`;
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  used.add(id);
  return id;
}

function isAllowedChild(parent: string, name: string) {
  if (parent === "svg" || parent === "symbol") return name === "g" || SHAPES.has(name) || ["defs", "title", "desc"].includes(name);
  if (parent === "g") return name === "g" || SHAPES.has(name);
  if (parent === "defs") return GRADIENTS.has(name);
  if (GRADIENTS.has(parent)) return name === "stop";
  return false;
}

function safeAttr(
  raw: Attr,
  target: Element,
  root: boolean,
  ids: Map<string, Element>,
  refs: Reference[],
  budget: Budget,
  index: number,
) {
  const { name, localName, namespaceURI } = raw;
  const tag = root ? "svg" : target.localName;
  const value = raw.value.trim();

  if (root && namespaceURI === XMLNS && ((name === "xmlns" && value === SVG) || (name === "xmlns:xlink" && value === XLINK))) return;
  if (namespaceURI && !(namespaceURI === XLINK && localName === "href" && GRADIENTS.has(tag))) {
    reject("This file uses an unsupported XML namespace. Export a plain SVG.");
  }
  if (value.length > (name === "d" || name === "points" ? SPRITE_LIMITS.fileBytes : 512)) {
    reject("An SVG attribute is too long. Simplify the artwork before export.");
  }

  if (name === "id" && !root && tag !== "defs") {
    if (!ID.test(value) || value !== raw.value || ids.has(value)) reject("Element IDs must be short, unique tokens within each file.");
    ids.set(value, target);
    target.setAttribute("id", `ilovesvg-sprite-ref-${index + 1}-${ids.size}`);
    return;
  }
  if (root) {
    if (name === "viewBox" || (name === "version" && /^1\.[01]$/.test(value))) return;
    if (name === "width" || name === "height") {
      numeric(value, ["px"], MIN_VIEWBOX_SIDE);
      return;
    }
    if (name === "id") {
      if (!ID.test(value) || value !== raw.value || ids.has(value)) reject("Element IDs must be short, unique tokens within each file.");
      // A root ID is represented by the symbol ID and cannot be a paint source.
      ids.set(value, target);
      return;
    }
    if ((name === "role" && value === "img") || (["aria-hidden", "focusable"].includes(name) && /^(?:true|false)$/.test(value)) || name === "aria-label") return;
    if (name === "preserveAspectRatio" && ASPECT.test(value)) {
      target.setAttribute(name, value);
      return;
    }
  }

  if (GRADIENTS.has(tag) && localName === "href") {
    const match = HASH.exec(value);
    if (!match || refs.some((ref) => ref.element === target && !ref.paint)) {
      reject("A gradient can inherit from one local #id only. External links are not supported.");
    }
    refs.push({ element: target, attribute: "href", sourceId: match[1], paint: false });
    return;
  }
  if ((root || tag === "g" || SHAPES.has(tag)) && (name === "stroke-dasharray" || name === "stroke-dashoffset")) {
    if (name !== "stroke-dasharray" || value !== "none") {
      reject("Dashed strokes are unsupported. Convert the stroke to filled outlines before export.");
    }
    target.setAttribute(name, value);
    return;
  }

  if (Object.hasOwn(GEOMETRY, tag) && GEOMETRY[tag].includes(name)) {
    if (name === "d") validatePath(value, budget);
    else if (name === "points") {
      const values = numbers(value, SPRITE_LIMITS.geometryPerFile);
      if (values.length < (tag === "polygon" ? 6 : 4) || values.length % 2) reject("Polygon and polyline points must contain complete coordinate pairs.");
      spendGeometry(budget, values.length);
    } else numeric(value, GRADIENTS.has(tag) ? ["%"] : ["px", "%"], ["width", "height", "r", "rx", "ry", "fr"].includes(name) ? 0 : -Infinity);
  } else if ((SHAPES.has(tag) || tag === "g") && name === "transform" || GRADIENTS.has(tag) && name === "gradientTransform") {
    const matrix = validateTransform(value, budget);
    target.setAttribute(name, value);
    return name === "transform" ? matrix : undefined;
  } else if (GRADIENTS.has(tag) && name === "gradientUnits" && /^(?:userSpaceOnUse|objectBoundingBox)$/.test(value)) {
    // Keep explicit gradient units.
  } else if (GRADIENTS.has(tag) && name === "spreadMethod" && /^(?:pad|reflect|repeat)$/.test(value)) {
    // Keep explicit gradient spread.
  } else if (tag === "stop" && (name === "stop-opacity" || name === "offset")) {
    numeric(value, ["%"], 0, value.endsWith("%") ? 100 : 1);
  } else if (tag === "stop" && name === "stop-color" && plainColor(value)) {
    // Keep plain stop color.
  } else if ((root || tag === "g" || SHAPES.has(tag)) && APPEARANCE.has(name)) {
    if (name === "fill" || name === "stroke" || name === "color") {
      const match = name === "color" ? null : PAINT_URL.exec(value);
      if (match) {
        refs.push({ element: target, attribute: name, sourceId: match[2], paint: true });
        return;
      }
      if (!plainColor(value) && !(name !== "color" && value === "none")) {
        reject("Use plain colors or local gradient paints like url(#gradient). Styles and external URLs are not supported.");
      }
    } else if (name.endsWith("opacity")) numeric(value, ["%"], 0, value.endsWith("%") ? 100 : 1);
    else if (name === "stroke-width") numeric(value, ["px", "%"], 0);
    else if (name === "stroke-miterlimit") numeric(value, [], 1);
    else if (
      (name === "fill-rule" && !/^(?:nonzero|evenodd)$/.test(value)) ||
      (name === "stroke-linecap" && !/^(?:butt|round|square)$/.test(value)) ||
      (name === "stroke-linejoin" && !/^(?:miter|round|bevel)$/.test(value)) ||
      (name === "vector-effect" && (!SHAPES.has(tag) || !/^(?:none|non-scaling-stroke)$/.test(value)))
    ) reject("An SVG paint or stroke option is unsupported.");
  } else {
    reject(`Unsupported attribute ${displayName(name)}. Export plain paths, shapes and local gradients without styles or external references.`);
  }
  target.setAttribute(name, value);
}

function displayName(name: string) {
  return `“${name.replace(/[^A-Za-z0-9_:.\-]/g, "?").slice(0, 40)}”`;
}

function checkGradientChains(links: Map<Element, Element>) {
  for (const gradient of links.keys()) {
    const visited = new Set<Element>();
    let node: Element | undefined = gradient;
    while (node) {
      if (visited.has(node) || visited.size >= 12) reject("A gradient reference chain loops or is too long.");
      visited.add(node);
      const next: Element | undefined = links.get(node);
      if (!next && !node.children.length) reject("A gradient has no color stops.");
      node = next;
    }
  }
}

function buildSymbol(source: SpriteSource, index: number, id: string, doc: Document) {
  const root = inputDocument(source.text).documentElement;
  if (root.prefix || (root.namespaceURI !== SVG && root.namespaceURI !== null)) {
    reject("Use an SVG root in the SVG namespace, without a namespace prefix.");
  }
  const box = boxFor(root);
  const symbol = doc.createElementNS(SVG, "symbol");
  symbol.setAttribute("id", id);
  symbol.setAttribute("viewBox", box.join(" "));
  const ids = new Map<string, Element>();
  const refs: Reference[] = [];
  const budget = { nodes: 1, geometry: 0 };
  let shapeCount = 0;
  const metadata = new Set<string>();

  function copy(element: Element, target: Element, depth: number, parentTransform: DOMMatrixReadOnly) {
    if (depth > SPRITE_LIMITS.depth) reject("This icon is nested too deeply. Flatten groups before export.");
    let transform = parentTransform;
    for (const attr of element.attributes) {
      const local = safeAttr(attr, target, depth === 0, ids, refs, budget, index);
      if (local) transform = boundedTransform(parentTransform.multiply(local));
    }
    for (const child of element.childNodes) {
      if (++budget.nodes > SPRITE_LIMITS.nodesPerFile) reject("This icon has too many SVG nodes. Simplify the artwork.");
      if (child.nodeType === Node.COMMENT_NODE || (child.nodeType === Node.TEXT_NODE && !child.textContent?.trim())) continue;
      if (child.nodeType === Node.TEXT_NODE && (element.localName === "title" || element.localName === "desc")) {
        const text = child.textContent || "";
        if (text.length > 512) reject("An icon title or description is too long.");
        target.append(doc.createTextNode(text));
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) reject("Unexpected content in the SVG. Convert text artwork to paths.");
      const item = child as Element;
      const tag = item.localName;
      if (item.prefix || item.namespaceURI !== root.namespaceURI || !isAllowedChild(element.localName, tag)) {
        reject(`Unsupported element ${displayName(tag)}. Use basic shapes, groups and local gradients; flatten other effects before export.`);
      }
      if (tag === "title" || tag === "desc") {
        if (metadata.has(tag)) reject("An SVG can have at most one title and one description.");
        metadata.add(tag);
      }
      if (SHAPES.has(tag)) {
        const required = tag === "path" ? ["d"] : tag === "polygon" || tag === "polyline" ? ["points"] : [];
        if (required.some((attribute) => !item.hasAttribute(attribute))) reject("A path, polygon or polyline is missing its geometry.");
        shapeCount++;
      }
      const next = doc.createElementNS(SVG, tag);
      copy(item, next, depth + 1, transform);
      target.append(next);
    }
  }

  copy(root, symbol, 0, new DOMMatrix());
  if (!shapeCount) reject("This SVG has no supported shapes.");
  const links = new Map<Element, Element>();
  for (const { element, attribute, sourceId, paint } of refs) {
    const referenced = ids.get(sourceId);
    if (!referenced || !GRADIENTS.has(referenced.localName) || (!paint && referenced.localName !== element.localName)) {
      reject("A local reference is missing or points to the wrong element. Check that every paint points to a gradient in this file.");
    }
    const targetId = referenced.getAttribute("id");
    element.setAttribute(attribute, paint ? `url(#${targetId})` : `#${targetId}`);
    if (!paint) links.set(element, referenced);
  }
  for (const gradient of symbol.querySelectorAll("linearGradient,radialGradient")) {
    if (!links.has(gradient) && !gradient.children.length) reject("A gradient has no color stops.");
  }
  checkGradientChains(links);
  const title = [...symbol.children].find((child) => child.localName === "title")?.textContent;
  const label = safeLabel(root.getAttribute("aria-label") || title || "", safeLabel(source.name.replace(/\.svg$/i, ""), "SVG icon"));
  return { symbol, box, label, budget };
}

function validateOutput(markup: string, expected: { id: string; box: Box }[]) {
  const root = xml(markup).documentElement;
  const defs = root.firstElementChild;
  if (
    root.namespaceURI !== SVG || root.getAttribute("width") !== "0" ||
    root.getAttribute("height") !== "0" || root.getAttribute("aria-hidden") !== "true" ||
    root.children.length !== 1 || defs?.localName !== "defs" || defs.children.length !== expected.length
  ) {
    reject("The generated sprite failed its structure check.");
  }
  const allIds = new Set<string>();
  for (const [index, symbol] of [...defs.children].entries()) {
    const item = expected[index];
    const id = symbol.getAttribute("id");
    if (!id || id !== item.id || symbol.getAttribute("viewBox") !== item.box.join(" ") || allIds.has(id) || symbol.localName !== "symbol") {
      reject("The generated sprite failed its symbol check.");
    }
    allIds.add(id);
    const localIds = new Map<string, Element>();
    const elements = [symbol, ...symbol.querySelectorAll("*")];
    for (const node of elements) {
      if (node.namespaceURI !== SVG || (node !== symbol && !isAllowedChild(node.parentElement?.localName || "", node.localName))) {
        reject("The generated sprite contains an unexpected element.");
      }
      const local = node !== symbol && node.getAttribute("id");
      if (local) {
        if (!/^ilovesvg-sprite-ref-\d+-\d+$/.test(local) || allIds.has(local)) reject("The generated sprite contains a duplicate or invalid ID.");
        allIds.add(local);
        localIds.set(local, node);
      }
    }
    const links = new Map<Element, Element>();
    for (const node of elements) {
      for (const attr of node.attributes) {
        if (attr.namespaceURI || /^(?:on|src$|style$|class$)/i.test(attr.name)) reject("The generated sprite contains an unexpected attribute.");
        const href = attr.name === "href";
        const paint = (attr.name === "fill" || attr.name === "stroke") && attr.value.startsWith("url(");
        if (!href && !paint) continue;
        const fragment = href ? HASH.exec(attr.value)?.[1] : PAINT_URL.exec(attr.value)?.[2];
        const target = fragment && localIds.get(fragment);
        if (!target || !GRADIENTS.has(target.localName) || (href && target.localName !== node.localName)) {
          reject("The generated sprite contains an invalid or cross-icon reference.");
        }
        if (href) links.set(node, target);
      }
    }
    checkGradientChains(links);
  }
}

export function buildSvgSprite(sources: readonly SpriteSource[]): SpriteResult {
  if (!sources.length || sources.length > SPRITE_LIMITS.files) reject(`Choose 1 to ${SPRITE_LIMITS.files} SVG files.`);
  let totalBytes = 0;
  let totalNodes = 0;
  let totalGeometry = 0;
  const encoder = new TextEncoder();
  const serializer = new XMLSerializer();
  const doc = document.implementation.createDocument(SVG, "svg");
  const defs = doc.createElementNS(SVG, "defs");
  doc.documentElement.setAttribute("width", "0");
  doc.documentElement.setAttribute("height", "0");
  doc.documentElement.setAttribute("aria-hidden", "true");
  doc.documentElement.setAttribute("focusable", "false");
  doc.documentElement.append(defs);
  const usedIds = new Set<string>();
  const outputs = sources.map((source, index) => {
    try {
      if (source.text.length > SPRITE_LIMITS.fileBytes) reject("This SVG exceeds 128 KiB.");
      const bytes = encoder.encode(source.text).byteLength;
      if (bytes > SPRITE_LIMITS.fileBytes) reject("This SVG exceeds 128 KiB.");
      totalBytes += bytes;
      if (totalBytes > SPRITE_LIMITS.batchBytes) reject("The selected SVGs exceed 512 KiB in total.");
      const id = symbolId(source.name, usedIds);
      const { symbol, box, label, budget } = buildSymbol(source, index, id, doc);
      totalNodes += budget.nodes;
      totalGeometry += budget.geometry;
      if (totalNodes > SPRITE_LIMITS.nodesPerBatch || totalGeometry > SPRITE_LIMITS.geometryPerBatch) {
        reject("The selected SVGs are too complex together. Export a smaller batch.");
      }
      defs.append(symbol);
      return { id, box, label, symbol };
    } catch (error) {
      if (error instanceof SpriteInputError) throw new SpriteInputError(error.message, index);
      throw error;
    }
  });
  const markup = serializer.serializeToString(doc);
  const bytes = encoder.encode(markup).byteLength;
  if (bytes > SPRITE_LIMITS.outputBytes) reject("The generated sprite is too large. Export a smaller batch.");
  validateOutput(markup, outputs);
  return {
    markup,
    bytes,
    icons: outputs.map(({ id, box, label, symbol }) => {
      const viewBox = box.join(" ");
      const aspect = symbol.getAttribute("preserveAspectRatio") || "xMidYMid meet";
      return {
        id,
        label,
        viewBox,
        aspect,
        preview: `<svg xmlns="${SVG}" width="96" height="96" viewBox="${viewBox}" preserveAspectRatio="${aspect}"><defs>${serializer.serializeToString(symbol)}</defs>${useMarkup(viewBox, id)}</svg>`,
      };
    }),
  };
}

function useMarkup(viewBox: string, id: string) {
  const [x, y, width, height] = viewBox.split(" ");
  return `<use href="#${id}" x="${x}" y="${y}" width="${width}" height="${height}"/>`;
}

export function spriteUseSnippet(icon: SpriteIcon, decorative: boolean) {
  const attributes = decorative ? 'aria-hidden="true"' : `role="img" aria-label="${escapeHtmlAttribute(icon.label)}"`;
  return `<svg xmlns="${SVG}" viewBox="${icon.viewBox}" preserveAspectRatio="${icon.aspect}" width="24" height="24" ${attributes} focusable="false">\n  ${useMarkup(icon.viewBox, icon.id)}\n</svg>`;
}

function escapeHtmlAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
