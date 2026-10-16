// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('twenty-sdk/define', () => ({
  defineFrontComponent: (config: unknown) => ({ config }),
}));
vi.mock('twenty-sdk/front-component', () => ({
  useLocale: () => 'fa-IR',
  useRecordId: () => 'template-id',
  useTranslate: () => ({ t: (text: string) => text }),
  enqueueSnackbar: vi.fn(),
}));
import definition from 'src/components/template-variable-guide.front-component';
const Editor = (
  definition.config as unknown as { component: () => React.JSX.Element }
).component;
const inputBody = 'سلام @name، این یک پیام آزمایشی است.@person.jobTitle';
const source = {
  objectUid: 'person-uid',
  objectName: 'person',
  objectNamePlural: 'people',
  labelSingular: 'شخص',
  labelPlural: 'افراد',
  relations: [],
};
const bridge = vi.fn();
beforeEach(() => {
  bridge.mockReset();
  bridge.mockImplementation(async ({ action }: { action: string }) => {
    if (action === 'read-template')
      return {
        success: true,
        template: {
          title: 'الگو',
          body: inputBody,
          sourceObjectUid: 'person-uid',
          recipientRelationUid: '',
          updatedAt: 'now',
        },
      };
    if (action === 'eligible-sources')
      return { success: true, sources: [source] };
    if (action === 'catalog')
      return {
        success: true,
        catalogStatus: 'READY',
        groups: [
          {
            key: 'source',
            title: 'افراد',
            variables: [{ token: '@person.jobTitle', label: 'عنوان شغلی' }],
          },
        ],
      };
    if (action === 'source-records')
      return {
        success: true,
        records: [{ id: 'person-id', label: 'Patrick' }],
      };
    return {
      success: true,
      hasUnresolvedVariables: true,
      previews: [
        {
          previewText: 'سلام Patrick، این یک پیام آزمایشی است.@person.jobTitle',
          hasUnresolvedVariables: true,
          issues: [{ token: '@person.jobTitle', kind: 'EMPTY_FIELD' }],
        },
      ],
    };
  });
  vi.stubGlobal('frontComponentHostCommunicationApi', {
    callCommunicationRoute: bridge,
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const openSample = async () => {
  const user = userEvent.setup();
  render(<Editor />);
  const sample = await screen.findByRole('option', { name: 'Patrick' });
  await user.selectOptions(
    sample.parentElement as HTMLSelectElement,
    'person-id',
  );
  return user;
};
describe('record editor preview', () => {
  it('shows the unresolved job title and its empty-field reason, and sends the exact current text', async () => {
    const user = await openSample();
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await screen.findByText('Incomplete preview');
    expect(
      screen.getByText('This field is empty on the selected sample record.', {
        exact: false,
      }).textContent,
    ).toContain('@person.jobTitle');
    expect(
      screen.getByText(
        'سلام Patrick، این یک پیام آزمایشی است.@person.jobTitle',
      ),
    ).toBeTruthy();
    expect(bridge).toHaveBeenCalledWith({
      action: 'preview',
      payload: expect.objectContaining({
        body: inputBody,
        sampleRecordId: 'person-id',
        sourceObjectUid: 'person-uid',
      }),
    });
    await user.type(
      screen.getByRole('textbox', { name: 'Message body' }),
      ' متن جدید',
    );
    expect(screen.queryByText('Incomplete preview')).toBeNull();
    expect(
      screen.queryByText(
        'سلام Patrick، این یک پیام آزمایشی است.@person.jobTitle',
      ),
    ).toBeNull();
  });
  it('ignores an old preview that finishes after the body changes', async () => {
    let finish: (value: unknown) => void = () => {};
    const initial = bridge.getMockImplementation()!;
    bridge.mockImplementation((request) =>
      request.action === 'preview'
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : initial(request),
    );
    const user = await openSample();
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Message body' }),
      ' تغییر',
    );
    await act(async () => {
      finish({
        success: true,
        previews: [{ previewText: 'STALE', issues: [] }],
      });
    });
    await waitFor(() => expect(screen.queryByText('STALE')).toBeNull());
  });
  it('never presents an unavailable variable or an empty preview response as a complete result', async () => {
    const initial = bridge.getMockImplementation()!;
    bridge.mockImplementation((request) =>
      request.action === 'preview'
        ? {
            success: true,
            previews: [
              {
                previewText: '@source.missing',
                issues: [
                  { token: '@source.missing', kind: 'UNKNOWN_VARIABLE' },
                ],
              },
            ],
          }
        : initial(request),
    );
    const user = await openSample();
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await screen.findByText(
      'This variable is unavailable for the selected source or your access.',
      { exact: false },
    );
    expect(screen.getByText('Incomplete preview')).toBeTruthy();
    bridge.mockResolvedValueOnce({ success: true, previews: [] });
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await screen.findByText('The preview could not be built.');
    expect(screen.queryByText('Incomplete preview')).toBeNull();
  });
});
