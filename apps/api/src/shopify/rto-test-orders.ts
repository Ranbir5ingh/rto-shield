export interface RtoTestOrderNode {
  id?: string | null;
  tags?: string[] | null;
}

export interface RtoTestOrderConnection {
  orders?: {
    pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
    edges?: Array<{ node?: RtoTestOrderNode | null } | null>;
  } | null;
}

export function rtoTestIdsOnPage(data: RtoTestOrderConnection): {
  ids: string[];
  next: string | null;
} {
  const ids: string[] = [];
  for (const edge of data.orders?.edges || []) {
    const id = edge?.node?.id || '';
    const tags = Array.isArray(edge?.node?.tags) ? edge.node.tags : [];
    if (id && tags.some((tag) => tag.trim().toLowerCase() === 'rto-test')) ids.push(id);
  }
  const page = data.orders?.pageInfo;
  const next = page?.hasNextPage ? page.endCursor || null : null;
  return { ids, next };
}

/** Walk every tagged page. A missing cursor or a repeated cursor ends the walk. */
export async function collectRtoTestOrderGids(
  load: (cursor: string | null) => Promise<RtoTestOrderConnection>,
  maxPages = 40,
): Promise<Set<string>> {
  const ids = new Set<string>();
  let cursor: string | null = null;
  for (let page = 0; page < maxPages; page += 1) {
    const parsed = rtoTestIdsOnPage(await load(cursor));
    for (const id of parsed.ids) ids.add(id);
    if (!parsed.next || parsed.next === cursor) break;
    cursor = parsed.next;
  }
  return ids;
}
