import type { Id } from './types';

type Node = { id: Id };

/** Parents of a node, nearest first. A cycle ends the walk. */
export function ancestors<T extends Node>(id: Id, nodes: T[], parentOf: (n: T) => Id | null | undefined): Id[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: Id[] = [];
  const seen = new Set<Id>([id]);
  let cur = byId.get(id);
  while (cur) {
    const p = parentOf(cur);
    if (!p || seen.has(p)) break;
    seen.add(p);
    out.push(p);
    cur = byId.get(p);
  }
  return out;
}

/** Every node under this one, at any depth. */
export function descendants<T extends Node>(id: Id, nodes: T[], parentOf: (n: T) => Id | null | undefined): Id[] {
  const kids = new Map<Id, Id[]>();
  for (const n of nodes) {
    const p = parentOf(n);
    if (p) kids.set(p, [...(kids.get(p) ?? []), n.id]);
  }
  const out: Id[] = [];
  const seen = new Set<Id>([id]);
  const stack = [...(kids.get(id) ?? [])];
  while (stack.length) {
    const k = stack.pop()!;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
    stack.push(...(kids.get(k) ?? []));
  }
  return out;
}

/** Adds each entry's count to its node and every ancestor, so a tee counts under Tees and Tops. */
export function countAtEveryLevel<T extends Node>(
  items: { key: Id; n: number }[],
  nodes: T[],
  parentOf: (n: T) => Id | null | undefined,
): Map<Id, number> {
  const out = new Map<Id, number>();
  const chain = new Map<Id, Id[]>();
  for (const { key, n } of items) {
    let up = chain.get(key);
    if (!up) chain.set(key, (up = [key, ...ancestors(key, nodes, parentOf)]));
    for (const k of up) out.set(k, (out.get(k) ?? 0) + n);
  }
  return out;
}
