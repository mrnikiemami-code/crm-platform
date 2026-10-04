import { describe, expect, it } from 'vitest';

import { SUPPORTED_COMMUNICATION_CHANNELS } from 'src/logic-functions/types/communication-channel-option.type';

describe('SUPPORTED_COMMUNICATION_CHANNELS', () => {
  it('offers only implemented channels', () => {
    // Unsupported channels must never appear as selectable dead controls.
    expect(SUPPORTED_COMMUNICATION_CHANNELS).toEqual(['SMS']);
  });
});
