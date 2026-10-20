/**
 * Product-owned Help links that older seeded dashboards persisted in their
 * blocknote body. They point at the upstream documentation site, which this
 * installation must never contact.
 *
 * This is an explicit allowlist on purpose: only links this product itself
 * wrote are rewritten. A customer's own `docs.twenty.com` link in their notes
 * stays exactly as they authored it.
 */
export const PRODUCT_OWNED_HELP_HREFS: readonly string[] = [
  'https://docs.twenty.com/getting-started/introduction',
  'https://docs.twenty.com/',
  'https://docs.twenty.com',
];

// Same-origin replacement for the links above.
const INTERNAL_HELP_HREF = '/help';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const rewriteNode = (node: unknown): unknown => {
  if (Array.isArray(node)) {
    return node.map(rewriteNode);
  }

  if (!isRecord(node)) {
    return node;
  }

  const isLegacyHelpLink =
    node.type === 'link' &&
    typeof node.href === 'string' &&
    PRODUCT_OWNED_HELP_HREFS.includes(node.href);

  const rewritten: Record<string, unknown> = isLegacyHelpLink
    ? { ...node, href: INTERNAL_HELP_HREF }
    : { ...node };

  for (const [key, value] of Object.entries(rewritten)) {
    if (key === 'href' && isLegacyHelpLink) {
      continue;
    }

    if (Array.isArray(value)) {
      rewritten[key] = value.map(rewriteNode);
    } else if (isRecord(value)) {
      rewritten[key] = rewriteNode(value);
    }
  }

  return rewritten;
};

/**
 * Read-time-only rewrite of product-owned legacy Help links in a persisted
 * blocknote body.
 *
 * Nothing is written back to the workspace: callers pass the result to the
 * read-only renderer only, so existing dashboards stay byte-for-byte intact in
 * the database and no migration or data cleanup is required.
 */
export const internalizeProductOwnedHelpLinks = <T>(body: T): T =>
  rewriteNode(body) as T;
