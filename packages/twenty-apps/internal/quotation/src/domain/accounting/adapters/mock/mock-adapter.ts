import { ASAN_CAPABILITIES } from 'src/domain/accounting/adapters/asan/asan-capabilities';
import {
  ACCOUNTING_ADAPTER_CONTRACT_VERSION,
  type AccountingAdapter,
  type AdapterHealth,
  type RemoteCatalogItem,
  type RemoteDocument,
  type RemoteItemInput,
  type RemoteParty,
  type RemotePartyInput,
  type RemoteProformaInput,
} from 'src/domain/accounting/adapter-contract';
import { MOCK_CATALOG_ITEMS, MOCK_PARTIES } from 'src/domain/accounting/adapters/mock/mock-dataset';
import { accepted, refused, type Result } from 'src/domain/shared/result';

// A deterministic adapter used by tests and by a workspace that wants to exercise the
// import/preview surfaces without a vendor server. It is deliberately NOT a simulation of
// Asan's response codes: those are tested against the real parser with recorded fixtures.
// Its job is to make the CRM side of the contract observable and repeatable.
export type MockAdapterConfig = {
  items?: RemoteCatalogItem[];
  parties?: RemoteParty[];
  // Forces every write to fail so retry and failure paths can be exercised.
  refuseWrites?: boolean;
  now?: () => Date;
};

const DEFAULT_ITEMS: RemoteCatalogItem[] = MOCK_CATALOG_ITEMS;

const DEFAULT_PARTIES: RemoteParty[] = MOCK_PARTIES;

export class MockAccountingAdapter implements AccountingAdapter {
  readonly id = 'mock' as const;
  readonly contractVersion = ACCOUNTING_ADAPTER_CONTRACT_VERSION;
  readonly capabilities = ASAN_CAPABILITIES;
  readonly isLive = false;

  private items: RemoteCatalogItem[];
  private parties: RemoteParty[];
  private readonly refuseWrites: boolean;
  private readonly now: () => Date;
  private nextDocumentNumber = 500;

  constructor(config: MockAdapterConfig = {}) {
    this.items = [...(config.items ?? DEFAULT_ITEMS)];
    this.parties = [...(config.parties ?? DEFAULT_PARTIES)];
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
