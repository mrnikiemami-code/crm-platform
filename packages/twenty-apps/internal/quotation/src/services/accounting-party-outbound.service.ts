import { createHash } from 'node:crypto';
import { type AccountingAdapter, type RemoteParty, type RemotePartyInput } from 'src/domain/accounting/adapter-contract';
import { normalizeIranMobile, normalizeNationalCode, normalizePartyName, partyNationalIdentity, partyIdentityConflict } from 'src/domain/accounting/party-identity';
import { mergeSourcePartyProfile } from 'src/domain/accounting/party-profile';
import { accepted, refused, type Result } from 'src/domain/shared/result';

export type PartyPushCommand = {
  operationId: string;
  mode: 'CREATE' | 'UPDATE';
  expectedRemoteVersion: string | null;
  profile: RemotePartyInput;
  sourceProfile: string | null;
};
export type PartyPushReceipt = { externalPartyId: string; externalCode: string; remoteVersion: string; sourceProfile: string | null };

const matchesIdentity = (candidate: RemoteParty, input: RemotePartyInput): boolean => {
  const national = partyNationalIdentity(input);
  const mobile = normalizeIranMobile(input.mobile);
  return (national !== null && partyNationalIdentity(candidate) === national) ||
    (mobile !== null && normalizeIranMobile(candidate.mobile) === mobile);
};
const receipt = (party: RemoteParty, previous: string | null): PartyPushReceipt => ({
  externalPartyId: party.externalPartyId, externalCode: party.code,
  remoteVersion: party.remoteVersion, sourceProfile: mergeSourcePartyProfile(party, previous),
});

// A prior match is never permission to create or overwrite. Explicit linking
// is provided by the existing authorized inbound customer mapping workflow.
export const previewPartyPush = async (adapter: AccountingAdapter, command: PartyPushCommand): Promise<Result<{ mode: 'CREATE' | 'UPDATE'; externalPartyId: string | null }>> => {
  const { mode, profile, expectedRemoteVersion } = command;
  if (!profile.fullName.trim() || partyIdentityConflict(profile) ||
      (!normalizeNationalCode(profile.nationalCode) && !normalizeIranMobile(profile.mobile))) {
    return refused('ASAN_CUSTOMER_LOOKUP_REQUIRED', 'customer name and national identity or mobile required');
  }
  if (mode === 'CREATE' ? !adapter.capabilities.parties.create : !adapter.capabilities.parties.update) {
    return refused('INVALID_INPUT', 'customer operation not supported');
  }
  const remote = await adapter.listParties();
  if (!remote.ok) return remote;
  const matching = remote.value.filter(row => matchesIdentity(row, profile));
  if (mode === 'CREATE') {
    if (profile.externalPartyId !== null || matching.length !== 0) return refused('ASAN_CUSTOMER_ALREADY_EXISTS', 'customer exists; review and explicitly link instead');
  } else {
    const byId = remote.value.filter(row => row.externalPartyId === profile.externalPartyId);
    if (byId.length !== 1 || !expectedRemoteVersion || byId[0].remoteVersion !== expectedRemoteVersion ||
      matching.some(row => row.externalPartyId !== profile.externalPartyId) ||
      !matchesIdentity(byId[0], profile)) return refused('RECONCILIATION_REQUIRED', 'remote customer identity/version changed or is ambiguous');
  }
  return accepted({ mode, externalPartyId: profile.externalPartyId });
};

export const executePartyPush = async (adapter: AccountingAdapter, command: PartyPushCommand, outboundEnabled: boolean): Promise<Result<PartyPushReceipt>> => {
  // G2 is not authorized. This is intentionally stricter than capability flags.
  if (adapter.isLive || adapter.writesEnabled === false || !outboundEnabled) {
    return refused('ASAN_LIVE_WRITE_NOT_APPROVED', 'customer write is disabled for this destination');
  }
  const preview = await previewPartyPush(adapter, command);
  if (!preview.ok) return preview;
  const profile = command.profile;
  // The mock is an ephemeral fixture, not a live dataset; provide a stable
  // numeric fixture identifier derived from the operation, never to Asan.
  const mockCode = String(1000000000 + (parseInt(createHash('sha256').update(command.operationId).digest('hex').slice(0, 7), 16)));
  const result = command.mode === 'CREATE'
    ? await adapter.createParty({ ...profile, externalPartyId: adapter.id === 'mock' ? mockCode : null })
    : await adapter.updateParty(profile);
  if (!result.ok) return result;
  const remote = result.value;
  if (!remote.externalPartyId || !remote.remoteVersion ||
      (command.mode === 'UPDATE' && remote.externalPartyId !== profile.externalPartyId) ||
      normalizePartyName(remote.fullName) !== normalizePartyName(profile.fullName) ||
      !matchesIdentity(remote, profile)) return refused('RECONCILIATION_REQUIRED', 'customer receipt does not match the intended identity');
  const after = await adapter.listParties();
  if (!after.ok) return after;
  const hits = after.value.filter(row => row.externalPartyId === remote.externalPartyId);
  if (hits.length !== 1 || hits[0].remoteVersion !== remote.remoteVersion ||
      normalizePartyName(hits[0].fullName) !== normalizePartyName(profile.fullName) ||
      !matchesIdentity(hits[0], profile)) return refused('RECONCILIATION_REQUIRED', 'unique customer readback not confirmed');
  return accepted(receipt(hits[0], command.sourceProfile));
};
