import { describe, expect, it } from 'vitest';

import { type BulkRecipient } from 'src/bulk/resolve-bulk-recipients';
import { buildTemplatePreview } from 'src/templates/build-template-preview';
import { type TemplateRecipientData } from 'src/templates/template-variable-catalog';

const recipient = (personId: string, selectedPhone: string | null): BulkRecipient => ({
  personId,
  displayName: personId,
  status: selectedPhone === null ? 'NO_PHONE' : 'SENDABLE',
  phones: [],
  selectedPhone,
});

const data: Map<string, TemplateRecipientData> = new Map([
  [
    'p1',
    {
      firstName: 'سارا',
      lastName: 'احمدی',
      fullName: 'سارا احمدی',
      companyName: 'شرکت الف',
    },
  ],
]);

describe('buildTemplatePreview empty-body rule', () => {
  it('never marks a recipient ready when the body is empty', () => {
    const preview = buildTemplatePreview({
      body: '',
      recipients: [recipient('p1', '09120000001')],
      recipientData: data,
    });

    expect(preview.isBodyEmpty).toBe(true);
    expect(preview.readyCount).toBe(0);
    expect(preview.previews[0].isReadyToSend).toBe(false);
  });

  it('never marks a recipient ready when the body is whitespace only', () => {
    for (const body of ['   ', '\n\t ', '  \n  ']) {
      const preview = buildTemplatePreview({
        body,
        recipients: [recipient('p1', '09120000001')],
        recipientData: data,
      });

      expect(preview.isBodyEmpty).toBe(true);
      expect(preview.readyCount).toBe(0);
      expect(preview.previews[0].isReadyToSend).toBe(false);
    }
  });

  it('marks a recipient with a real body and a phone as ready', () => {
    const preview = buildTemplatePreview({
      body: 'سلام @name',
      recipients: [recipient('p1', '09120000001')],
      recipientData: data,
    });

    expect(preview.isBodyEmpty).toBe(false);
    expect(preview.readyCount).toBe(1);
    expect(preview.previews[0].isReadyToSend).toBe(true);
  });

  it('is not ready without a phone even when the body is real', () => {
    const preview = buildTemplatePreview({
      body: 'سلام @name',
      recipients: [recipient('p1', null)],
      recipientData: data,
    });

    expect(preview.readyCount).toBe(0);
    expect(preview.previews[0].isReadyToSend).toBe(false);
  });
});
