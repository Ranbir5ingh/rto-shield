import { collectRtoTestOrderGids, type RtoTestOrderConnection } from './rto-test-orders';

function page(ids: string[], next: string | null, extraUntagged = false): RtoTestOrderConnection {
  const edges = ids.map((id) => ({ node: { id, tags: ['rto-test'] } }));
  if (extraUntagged) edges.push({ node: { id: 'gid://shopify/Order/untagged', tags: ['vip'] } });
  return {
    orders: {
      pageInfo: { hasNextPage: Boolean(next), endCursor: next },
      edges,
    },
  };
}

describe('rto-test order pages', () => {
  it('reads past the first 50 and ignores orders without the tag', async () => {
    const first = Array.from({ length: 50 }, (_, index) => `gid://shopify/Order/${index + 1}`);
    const cursors: Array<string | null> = [];
    const ids = await collectRtoTestOrderGids(async (cursor) => {
      cursors.push(cursor);
      if (!cursor) return page(first, 'cursor-2', true);
      if (cursor === 'cursor-2') return page(['gid://shopify/Order/1047'], null);
      throw new Error('walked past the last page');
    });
    expect(cursors).toEqual([null, 'cursor-2']);
    expect(ids.size).toBe(51);
    expect(ids.has('gid://shopify/Order/1047')).toBe(true);
    expect(ids.has('gid://shopify/Order/untagged')).toBe(false);
  });

  it('stops when Shopify omits a next page', async () => {
    const cursors: Array<string | null> = [];
    const ids = await collectRtoTestOrderGids(async (cursor) => {
      cursors.push(cursor);
      return {
        orders: { edges: [{ node: { id: 'gid://shopify/Order/9', tags: [' RTO-Test '] } }] },
      };
    });
    expect(cursors).toEqual([null]);
    expect([...ids]).toEqual(['gid://shopify/Order/9']);
  });
});
