import { type MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';

// Action `defaultLabel` doubles as the persisted step name and the fallback
// English text, so it must stay stable and untranslated. Only the rendered
// label is resolved through these descriptors.
export const ACTION_LABEL_MESSAGE_BY_DEFAULT_LABEL: Record<
  string,
  MessageDescriptor
> = {
  'Create Record': msg`Create Record`,
  'Update Record': msg`Update Record`,
  'Delete Record': msg`Delete Record`,
  'Search Records': msg`Search Records`,
  'Create or Update Record': msg`Create or Update Record`,
  'Pick Record': msg`Pick Record`,
  'AI Agent': msg`AI Agent`,
  Classify: msg`Classify`,
  Iterator: msg`Iterator`,
  Filter: msg`Filter`,
  'If/else': msg`If/else`,
  Delay: msg`Delay`,
  'Send Email': msg`Send Email`,
  'Draft Email': msg`Draft Email`,
  'Create Calendar Event': msg`Create Calendar Event`,
  'Code - Logic Function': msg`Code - Logic Function`,
  'HTTP Request': msg`HTTP Request`,
  Form: msg`Form`,
};
