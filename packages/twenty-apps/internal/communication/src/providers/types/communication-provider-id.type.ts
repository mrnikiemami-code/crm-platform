// Identity of a provider implementation, independent of the channel it sends
// on. Several providers can serve the same channel (e.g. `kavenegar` and
// `razpayamak` both send `SMS`), so provider identity — not channel — is what
// the registry is keyed by and what a caller selects.
//
// Kept as an open string union rather than an enum so adding a provider is
// additive and does not touch shared types.
export type CommunicationProviderId = 'kavenegar' | 'razpayamak';
