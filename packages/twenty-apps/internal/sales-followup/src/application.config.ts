import { defineApplication } from 'twenty-sdk/define';

import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// Sales follow-up ("پیگیری فروش") owns the interaction's title.
//
// It is a separate application rather than part of event-registration or
// record-access because the concern is independent: registration records
// attendees, record access decides who may SEE a customer, and this one decides
// what a follow-up is CALLED. Coupling the title to either of the others would
// mean a title fix could not ship without them.
export default defineApplication({
  universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
  displayName: 'Sales Follow-up',
  description:
    'Builds sales follow-up titles from the call attempt and the customer name, and keeps hand-written titles untouched.',
});
