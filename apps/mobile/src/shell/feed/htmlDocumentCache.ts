import type { HTMLSourceDom, TRenderEngine, Node } from "@native-html/render";
import { copyPreparedHtmlStyles } from "./htmlStyles";
import { measureStartupWork } from "../../runtime/startupTiming";

type Entry = { dom: HTMLSourceDom["dom"]; nodes: number; bytes: number };
const documents = new Map<string, Entry>();
let nodes = 0, bytes = 0;
const MAX_ENTRIES = 32, MAX_NODES = 4096, MAX_BYTES = 256 * 1024;

function nodeCount(node: HTMLSourceDom["dom"]): number {
  return 1 + node.children.reduce((total, child) => total + ("children" in child ? nodeCount(child as HTMLSourceDom["dom"]) : 1), 0);
}

function copyStyles(from: Node, to: Node) {
  if ("attribs" in from && "attribs" in to) copyPreparedHtmlStyles(from as Parameters<typeof copyPreparedHtmlStyles>[0], to as Parameters<typeof copyPreparedHtmlStyles>[1]);
  if ("children" in from && "children" in to) {
    const source = from as HTMLSourceDom["dom"], clone = to as HTMLSourceDom["dom"];
    source.children.forEach((child, index) => copyStyles(child, clone.children[index]));
  }
}

/** Cache prepared DOM only. Each renderer owns a clone and its own styled tree. */
export function cachedHtmlDocument(engine: TRenderEngine, html: string, configuration: string, sourceBytes: number): HTMLSourceDom {
  const key = JSON.stringify([configuration, html]);
  let entry = documents.get(key);
  if (entry) {
    documents.delete(key);
    documents.set(key, entry);
  } else {
    const dom = measureStartupWork("html-parse-css", () => engine.parseDocument(html));
    entry = { dom, nodes: nodeCount(dom), bytes: sourceBytes };
    if (entry.nodes <= MAX_NODES && entry.bytes <= MAX_BYTES) {
      documents.set(key, entry); nodes += entry.nodes; bytes += entry.bytes;
      while (documents.size > MAX_ENTRIES || nodes > MAX_NODES || bytes > MAX_BYTES) {
        const oldest = documents.keys().next().value!;
        const removed = documents.get(oldest)!;
        documents.delete(oldest); nodes -= removed.nodes; bytes -= removed.bytes;
      }
    }
  }
  const dom = measureStartupWork("html-clone", () => {
    const clone = entry.dom.cloneNode(true);
    copyStyles(entry.dom, clone);
    return clone;
  });
  return { dom };
}
