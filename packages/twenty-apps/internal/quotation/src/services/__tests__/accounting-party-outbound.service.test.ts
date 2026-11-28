import { describe, it, expect, vi } from 'vitest';
import { MockAccountingAdapter } from 'src/domain/accounting/adapters/mock/mock-adapter';
import { executePartyPush, previewPartyPush, type PartyPushCommand } from 'src/services/accounting-party-outbound.service';

const command: PartyPushCommand = {
  operationId: '11111111-1111-5111-8111-111111111111', mode: 'CREATE',
  expectedRemoteVersion: null, sourceProfile: null,
  profile: { partyType: 'PERSON', externalPartyId: null, fullName: 'مشتری آزمون', mobile: '09120000001', nationalCode: '0012345678', address: null },
};

describe('customer outbound identity and receipt', () => {
  it('creates only after explicit preview and confirms the unique readback', async () => {
    const adapter = new MockAccountingAdapter({ parties: [] });
    expect(await previewPartyPush(adapter, command)).toMatchObject({ ok: true });
    const created = await executePartyPush(adapter, command, true);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.value.externalPartyId).toMatch(/^\d+$/);
    expect(created.value.remoteVersion).toEqual(expect.any(String));
    expect(await executePartyPush(adapter, command, true)).toMatchObject({ ok: false, refusal: { code: 'ASAN_CUSTOMER_ALREADY_EXISTS' } });
  });
  it('never calls a disabled or live adapter write', async () => {
    const adapter = new MockAccountingAdapter({ parties: [] });
    const create = vi.spyOn(adapter, 'createParty');
    expect(await executePartyPush(adapter, command, false)).toMatchObject({ ok: false });
    Object.defineProperty(adapter, 'isLive', { value: true });
    expect(await executePartyPush(adapter, command, true)).toMatchObject({ ok: false });
    expect(create).not.toHaveBeenCalled();
  });
  it('refuses stale versions and permits the exact linked mock update', async () => {
    const adapter = new MockAccountingAdapter({ parties: [] });
    const created = await executePartyPush(adapter, command, true);
    if (!created.ok) throw new Error('fixture create failed');
    const update: PartyPushCommand = { ...command, mode: 'UPDATE', expectedRemoteVersion: created.value.remoteVersion,
      profile: { ...command.profile, fullName: 'نام جدید', externalPartyId: created.value.externalPartyId } };
    expect(await previewPartyPush(adapter, { ...update, expectedRemoteVersion: 'stale' })).toMatchObject({ ok: false });
    expect(await executePartyPush(adapter, update, true)).toMatchObject({ ok: true, value: { externalPartyId: created.value.externalPartyId } });
  });
});
