// App-local mirror of the `communication.channel` SELECT options.
//
// The SELECT field is the source of truth for what a user can pick; this union
// is what the provider boundary can key on. Adding a channel means adding one
// option to the object field and one member here — both additive, no redesign.
// Only channels that are actually implemented are listed, so a channel never
// appears as a selectable dead control before it can be sent.
export type CommunicationChannel = 'SMS';
