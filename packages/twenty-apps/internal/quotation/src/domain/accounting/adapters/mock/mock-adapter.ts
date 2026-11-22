import { ASAN_CAPABILITIES } from 'src/domain/accounting/adapters/asan/asan-capabilities';
import {
  ACCOUNTING_ADAPTER_CONTRACT_VERSION,
  type AccountingAdapter,
  type AdapterHealth,
  type RemoteCatalogItem,
  type RemoteDocument,
  type RemoteItemInput,
  type RemotePage,
  type RemotePageRequest,
  type RemoteParty,
  type RemotePartyInput,
  type RemoteProformaInput,
} from 'src/domain/accounting/adapter-contract';
import {
  type AdapterCapabilities,
  type RemoteReadStrategy,
} from 'src/domain/accounting/capabilities';
import {
  clampPageSize,
  decodeRemoteOffsetCursor,
  encodeRemoteOffsetCursor,
} from 'src/domain/accounting/pagination';
import { MOCK_CATALOG_ITEMS, MOCK_PARTIES } from 'src/domain/accounting/adapters/mock/mock-dataset';
import { accepted, refused, type Result } from 'src/domain/shared/result';

// A deterministic adapter used by tests and by a workspace that wants to exercise the
// import/preview surfaces without a vendor server. It is deliberately NOT a simulation of
// Asan's response codes: those are tested against the real parser with recorded fixtures.
// Its job is to make the CRM side of the contract observable and repeatable.
//
// It can declare either read strategy. `REMOTE_PAGED` gives tests a destination that really
// pages (the page is cut from its own store and the cursor is its own token), which is how
// the paged branch is proven end to end with no vendor call. `REMOTE_UNPAGED` is the default
// because that is what Asan is, and the mock must not describe a richer API than Asan has.
export type MockAdapterConfig = {
  items?: RemoteCatalogItem[];
  parties?: RemoteParty[];
  readStrategy?: RemoteReadStrategy;
  // Forces every write to fail so retry and failure paths can be exercised.
  refuseWrites?: boolean;
  now?: () => Date;
};

const DEFAULT_ITEMS: RemoteCatalogItem[] = MOCK_CATALOG_ITEMS;

const DEFAULT_PARTIES: RemoteParty[] = MOCK_PARTIES;

const mockCapabilities = (
  readStrategy: RemoteReadStrategy,
): AdapterCapabilities => ({
  ...ASAN_CAPABILITIES,
  readStrategy,
});

export class MockAccountingAdapter implements AccountingAdapter {
  readonly id = 'mock' as const;
  readonly contractVersion = ACCOUNTING_ADAPTER_CONTRACT_VERSION;
  readonly capabilities: AdapterCapabilities;
  readonly isLive = false;

  private items: RemoteCatalogItem[];
  private parties: RemoteParty[];
  private readonly refuseWrites: boolean;
  private readonly now: () => Date;
  private nextDocumentNumber = 500;

  constructor(config: MockAdapterConfig = {}) {
    this.items = [...(config.items ?? DEFAULT_ITEMS)];
    this.parties = [...(config.parties ?? DEFAULT_PARTIES)];
    this.capabilities = mockCapabilities(config.readStrategy ?? 'REMOTE_UNPAGED');
    this.refuseWrites = config.refuseWrites ?? false;
    this.now = config.now ?? (() => new Date());
  }

  async testConnection(): Promise<Result<AdapterHealth>> {
    return accepted({
      kind: 'REACHABLE',
      checkedAt: this.now().toISOString(),
      latencyMs: 1,
      transportIsSecure: true,
      detail: 'mock adapter answered without a network call',
    });
  }

  async listItems(): Promise<Result<RemoteCatalogItem[]>> {
    return accepted([...this.items]);
  }

  async listParties(): Promise<Result<RemoteParty[]>> {
    return accepted([...this.parties]);
  }

  // Present on the mock regardless of the declared strategy, so a test can prove that a
  // `REMOTE_PAGED` destination is read page by page. The mapping service only calls these
  // when the adapter DECLARES `REMOTE_PAGED`, which is the same gate a real vendor uses.
  async readItemPage(
    request: RemotePageRequest,
  ): Promise<Result<RemotePage<RemoteCatalogItem>>> {
    return this.readPage(
      this.items,
      request,
      (item) => [item.code, item.name, item.externalItemId, item.secondaryName ?? ''],
    );
  }

  async readPartyPage(
    request: RemotePageRequest,
  ): Promise<Result<RemotePage<RemoteParty>>> {
    return this.readPage(
      this.parties,
      request,
      (party) => [
        party.code,
        party.fullName,
        party.externalPartyId,
        party.nationalCode ?? '',
        party.mobile ?? '',
      ],
    );
  }

  // One page, cut from the adapter's own store. A cursor from a different generation is
  // refused rather than reinterpreted, because an offset into a changed list would attach a
  // decision to the wrong record.
  private readPage<TRow>(
    rows: TRow[],
    request: RemotePageRequest,
    haystack: (row: TRow) => string[],
  ): Result<RemotePage<TRow>> {
    const offset = decodeRemoteOffsetCursor(request.cursor);

    if (offset === null) {
      return refused('INVALID_RESPONSE', 'the mock adapter did not issue this cursor');
    }

    const needle = request.search.trim().toLowerCase();
    const matching =
      needle === ''
        ? rows
        : rows.filter((row) =>
            haystack(row).some((field) =>
              field.toLowerCase().includes(needle),
            ),
          );

    const pageSize = clampPageSize(request.pageSize);
    const safeOffset = Math.min(offset, matching.length);
    const end = Math.min(safeOffset + pageSize, matching.length);

    return accepted({
      rows: matching.slice(safeOffset, end),
      nextCursor: end < matching.length ? encodeRemoteOffsetCursor(end) : null,
      hasNextPage: end < matching.length,
      totalKnown: matching.length,
    });
  }

  async createItem(input: RemoteItemInput): Promise<Result<RemoteCatalogItem>> {
    if (this.refuseWrites) {
      return refused('VENDOR_REFUSED', 'the mock adapter is configured to refuse writes');
    }

    if (!/^\d+$/.test(input.code) || Number(input.code) <= 0) {
      return refused('ASAN_PRODUCT_CODE_INVALID', 'the mock needs a positive numeric code');
    }

    const created: RemoteCatalogItem = {
      externalItemId: input.externalItemId ?? input.code,
      code: input.code,
      name: input.name,
      secondaryName: input.secondaryName,
      sellPriceUnits: input.sellPriceUnits,
      salesPriceUnits: input.salesPriceUnits,
      stock: null,
      remoteVersion: `mock-${this.items.length + 1}`,
      isActive: true,
    };

    this.items.push(created);

    return accepted(created);
  }

  async updateItemPrices(
    input: RemoteItemInput,
  ): Promise<Result<RemoteCatalogItem>> {
    if (this.refuseWrites) {
      return refused('VENDOR_REFUSED', 'the mock adapter is configured to refuse writes');
    }

    const index = this.items.findIndex(
      (item) => item.code === (input.externalItemId ?? input.code),
    );

    if (index < 0) {
      return refused('TARGET_NOT_LINKED', 'the mock has no such item');
    }

    const updated: RemoteCatalogItem = {
      ...this.items[index],
      sellPriceUnits: input.sellPriceUnits,
      salesPriceUnits: input.salesPriceUnits,
      remoteVersion: `${this.items[index].remoteVersion}-p`,
    };

    this.items[index] = updated;

    return accepted(updated);
  }

  async createParty(input: RemotePartyInput): Promise<Result<RemoteParty>> {
    if (this.refuseWrites) {
      return refused('VENDOR_REFUSED', 'the mock adapter is configured to refuse writes');
    }

    const created: RemoteParty = {
      externalPartyId: input.externalPartyId ?? `mock-${this.parties.length + 101}`,
      code: input.externalPartyId ?? `mock-${this.parties.length + 101}`,
      fullName: input.fullName,
      mobile: input.mobile,
      nationalCode: input.nationalCode,
      remoteVersion: `mock-party-${this.parties.length + 1}`,
    };

    this.parties.push(created);

    return accepted(created);
  }

  async updateParty(input: RemotePartyInput): Promise<Result<RemoteParty>> {
    if (this.refuseWrites) {
      return refused('VENDOR_REFUSED', 'the mock adapter is configured to refuse writes');
    }

    if (input.externalPartyId === null) {
      return refused('TARGET_NOT_LINKED', 'the mock has no such party');
    }

    const index = this.parties.findIndex(
      (party) => party.externalPartyId === input.externalPartyId,
    );

    if (index < 0) {
      return refused('TARGET_NOT_LINKED', 'the mock has no such party');
    }

    const updated: RemoteParty = {
      ...this.parties[index],
      fullName: input.fullName,
      mobile: input.mobile,
      nationalCode: input.nationalCode,
    };

    this.parties[index] = updated;

    return accepted(updated);
  }

  async registerProforma(
    _input: RemoteProformaInput,
  ): Promise<Result<RemoteDocument>> {
    if (this.refuseWrites) {
      return refused('VENDOR_REFUSED', 'the mock adapter is configured to refuse writes');
    }

    const documentNumber = String(this.nextDocumentNumber);
    this.nextDocumentNumber += 1;

    return accepted({
      externalDocumentId: documentNumber,
      documentNumber,
      registeredAt: this.now().toISOString(),
    });
  }
}
