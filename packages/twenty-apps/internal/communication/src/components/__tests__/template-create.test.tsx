// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { navigate, closeSidePanel, enqueueSnackbar } = vi.hoisted(() => ({
  navigate: vi.fn(),
  closeSidePanel: vi.fn(),
  enqueueSnackbar: vi.fn(),
}));
vi.mock('twenty-sdk/define', () => ({
  defineFrontComponent: (config: unknown) => ({ config }),
}));
vi.mock('twenty-sdk/front-component', () => ({
  AppPath: { RecordIndexPage: '/objects/:objectNamePlural' },
  useLocale: () => 'fa-IR',
  useRecordId: () => '187c3b8c-4a53-4de3-80be-9a683d044a75',
  useTranslate: () => ({ t: (text: string) => text }),
  enqueueSnackbar,
  navigate,
  closeSidePanel,
}));
import definition from 'src/components/create-template.front-component';
import editDefinition from 'src/components/template-variable-guide.front-component';
const Edit = (
  editDefinition.config as unknown as { component: () => React.JSX.Element }
).component;
const Create = (
  definition.config as unknown as { component: () => React.JSX.Element }
).component;
const bridge = vi.fn();
const draftId = '187c3b8c-4a53-4de3-80be-9a683d044a75';
const sources = [
  {
    objectUid: 'person-uid',
    objectName: 'person',
    labelPlural: 'افراد',
    relations: [],
  },
  {
    objectUid: 'opportunity-uid',
    objectName: 'opportunity',
    labelPlural: 'فرصتها',
    relations: [
      {
        relationUid: 'contact-uid',
        relationName: 'contact',
        relationLabel: 'گیرنده',
      },
    ],
  },
];
beforeEach(() => {
  vi.clearAllMocks();
  navigate.mockResolvedValue(undefined);
  enqueueSnackbar.mockReset();
  enqueueSnackbar.mockResolvedValue(undefined);
  closeSidePanel.mockResolvedValue(undefined);
  bridge.mockImplementation(
    async ({
      action,
      payload,
    }: {
      action: string;
      payload: Record<string, unknown>;
    }) => {
      if (action === 'eligible-sources') return { success: true, sources };
      if (action === 'catalog')
        return {
          success: true,
          catalogStatus: 'READY',
          groups: [
            {
              key: 'source',
              title:
                payload.sourceObjectUid === 'person-uid' ? 'افراد' : 'فرصتها',
              variables: [
                {
                  token:
                    payload.sourceObjectUid === 'person-uid'
                      ? '@person.firstName'
                      : '@source.name',
                  label: 'نام',
                },
              ],
            },
          ],
        };
      if (action === 'source-records')
        return {
          success: true,
          records: [{ id: 'sample-id', label: 'نمونه' }],
        };
      if (action === 'preview')
        return {
          success: true,
          previews: [{ previewText: 'سلام فرصت نمونه', issues: [] }],
        };
      if (action === 'create-template')
        return {
          success: true,
          template: { ...payload, id: draftId, updatedAt: 'now' },
        };
      if (action === 'read-template')
        return {
          success: true,
          template: {
            id: draftId,
            title: 'عنوان',
            body: 'سلام @source.name',
            sourceObjectUid: 'opportunity-uid',
            recipientRelationUid: 'contact-uid',
            updatedAt: 'now',
          },
        };
      throw new Error(`Unexpected action: ${action}`);
    },
  );
  vi.stubGlobal('frontComponentHostCommunicationApi', {
    callCommunicationRoute: bridge,
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const openCreate = async () => {
  const user = userEvent.setup();
  render(<Create />);
  await screen.findByText('@person.firstName');
  return user;
};
const fill = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByRole('textbox', { name: 'Title' }), 'عنوان');
  await user.type(
    screen.getByRole('textbox', { name: 'Message body' }),
    'سلام ',
  );
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Source entity' }),
    'opportunity-uid',
  );
  await screen.findByText('@source.name');
  await user.click(screen.getByRole('button', { name: 'Add to end of text' }));
};
describe('new template uses the full editor before creation', () => {
  it('loads fields, switches source, inserts once and previews the draft before one complete create', async () => {
    const user = await openCreate();
    expect(
      bridge.mock.calls.some(([request]) => request.action === 'read-template'),
    ).toBe(false);
    expect(
      screen
        .getByRole('button', { name: 'Create template' })
        .hasAttribute('disabled'),
    ).toBe(false);
    await fill(user);
    expect(screen.queryByText('@person.firstName')).toBeNull();
    expect(
      (
        screen.getByRole('textbox', {
          name: 'Message body',
        }) as HTMLTextAreaElement
      ).value,
    ).toBe('سلام @source.name');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Sample record' }),
      'sample-id',
    );
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await screen.findByText('سلام فرصت نمونه');
    const preview = bridge.mock.calls.find(
      ([request]) => request.action === 'preview',
    )?.[0];
    expect(preview.payload).not.toHaveProperty('templateId');
    expect(
      bridge.mock.calls.filter(
        ([request]) => request.action === 'create-template',
      ),
    ).toHaveLength(0);
    await user.dblClick(
      screen.getByRole('button', { name: 'Create template' }),
    );
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(
      bridge.mock.calls.filter(
        ([request]) => request.action === 'create-template',
      ),
    ).toEqual([
      [
        {
          action: 'create-template',
          payload: expect.objectContaining({
            templateId: draftId,
            title: 'عنوان',
            body: 'سلام @source.name',
            sourceObjectUid: 'opportunity-uid',
            recipientRelationUid: 'contact-uid',
          }),
        },
      ],
    ]);
    expect(navigate).toHaveBeenCalledWith('/objects/:objectNamePlural', {
      objectNamePlural: 'messageTemplates',
    });
    expect(closeSidePanel).toHaveBeenCalledTimes(1);
  });
  it('cancel and confirmed discard never create a record', async () => {
    const user = await openCreate();
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'پیش نویس');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(closeSidePanel).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(
      (screen.getByRole('textbox', { name: 'Title' }) as HTMLInputElement)
        .value,
    ).toBe('پیش نویس');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(closeSidePanel).toHaveBeenCalledTimes(1);
    expect(
      bridge.mock.calls.some(
        ([request]) => request.action === 'create-template',
      ),
    ).toBe(false);
  });
  it('failed creation keeps the whole draft and retries with the same identifier', async () => {
    const original = bridge.getMockImplementation()!;
    let attempts = 0;
    bridge.mockImplementation((request) =>
      request.action === 'create-template' && attempts++ === 0
        ? Promise.reject(new Error('network failure'))
        : original(request),
    );
    const user = await openCreate();
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Create template' }));
    await screen.findByText(
      'The template could not be saved. Your changes have been kept. Please try again.',
    );
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'error' }),
    );
    expect(
      (
        screen.getByRole('textbox', {
          name: 'Message body',
        }) as HTMLTextAreaElement
      ).value,
    ).toBe('سلام @source.name');
    expect(
      (
        screen.getByRole('combobox', {
          name: 'Source entity',
        }) as HTMLSelectElement
      ).value,
    ).toBe('opportunity-uid');
    expect(navigate).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Create template' }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(
      bridge.mock.calls
        .filter(([request]) => request.action === 'create-template')
        .map(([request]) => request.payload.templateId),
    ).toEqual([draftId, draftId]);
  });
  it('requires an explicit choice when a source has several to-one recipient relations', async () => {
    const original = bridge.getMockImplementation()!;
    bridge.mockImplementation((request) =>
      request.action === 'eligible-sources'
        ? Promise.resolve({
            success: true,
            sources: [
              sources[0],
              {
                ...sources[1],
                relations: [
                  ...sources[1].relations,
                  {
                    relationUid: 'second-contact',
                    relationName: 'otherContact',
                    relationLabel: 'گیرنده دیگر',
                  },
                ],
              },
            ],
          })
        : original(request),
    );
    const user = await openCreate();
    await fill(user);
    expect(
      screen
        .getByRole('button', { name: 'Create template' })
        .hasAttribute('disabled'),
    ).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Create template' }));
    expect(
      screen
        .getByRole('combobox', { name: 'Recipient relation' })
        .getAttribute('aria-invalid'),
    ).toBe('true');
    expect(enqueueSnackbar).toHaveBeenCalledWith({
      message: 'Choose the relation that identifies the recipient.',
      variant: 'error',
    });
    expect(
      bridge.mock.calls.some(
        ([request]) => request.action === 'create-template',
      ),
    ).toBe(false);
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Recipient relation' }),
      'second-contact',
    );
    await waitFor(() =>
      expect(
        screen
          .getByRole('button', { name: 'Create template' })
          .hasAttribute('disabled'),
      ).toBe(false),
    );
    expect(bridge).toHaveBeenCalledWith({
      action: 'catalog',
      payload: expect.objectContaining({
        sourceObjectUid: 'opportunity-uid',
        recipientRelationUid: 'second-contact',
      }),
    });
  });
  it('reports empty title and body through native error toasts and accessible field messages instead of silently disabling Create', async () => {
    const user = await openCreate();
    await user.click(screen.getByRole('button', { name: 'Create template' }));
    expect(enqueueSnackbar).toHaveBeenCalledWith({
      message: 'A title is required. Enter the message text.',
      variant: 'error',
    });
    expect(
      screen
        .getByRole('textbox', { name: 'Title' })
        .getAttribute('aria-invalid'),
    ).toBe('true');
    expect(
      screen
        .getByRole('textbox', { name: 'Message body' })
        .getAttribute('aria-invalid'),
    ).toBe('true');
    expect(screen.getByText('A title is required.')).toBeTruthy();
    expect(screen.getByText('Enter the message text.')).toBeTruthy();
    expect(
      bridge.mock.calls.some(
        ([request]) => request.action === 'create-template',
      ),
    ).toBe(false);
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'عنوان');
    expect(
      screen
        .getByRole('textbox', { name: 'Title' })
        .getAttribute('aria-invalid'),
    ).toBe('false');
    await user.click(screen.getByRole('button', { name: 'Create template' }));
    expect(enqueueSnackbar).toHaveBeenLastCalledWith({
      message: 'Enter the message text.',
      variant: 'error',
    });
    expect(navigate).not.toHaveBeenCalled();
  });
  it('rejects a whitespace-only title and keeps the body unchanged', async () => {
    const user = await openCreate();
    await user.type(screen.getByRole('textbox', { name: 'Title' }), '   ');
    await user.type(
      screen.getByRole('textbox', { name: 'Message body' }),
      'متن من',
    );
    await user.click(screen.getByRole('button', { name: 'Create template' }));
    expect(enqueueSnackbar).toHaveBeenCalledWith({
      message: 'A title is required.',
      variant: 'error',
    });
    expect(
      (
        screen.getByRole('textbox', {
          name: 'Message body',
        }) as HTMLTextAreaElement
      ).value,
    ).toBe('متن من');
    expect(
      bridge.mock.calls.some(
        ([request]) => request.action === 'create-template',
      ),
    ).toBe(false);
  });
  it('keeps the draft and shows a specific native error when the server rejects the source', async () => {
    const original = bridge.getMockImplementation()!;
    bridge.mockImplementation((request) =>
      request.action === 'create-template'
        ? Promise.resolve({
            success: false,
            errorCode: 'TEMPLATE_CONTEXT_MISMATCH',
          })
        : original(request),
    );
    const user = await openCreate();
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Create template' }));
    await screen.findByRole('alert');
    expect(enqueueSnackbar).toHaveBeenCalledWith({
      message:
        'The selected source or recipient relation is no longer available. Choose them again.',
      variant: 'error',
    });
    expect(
      (
        screen.getByRole('textbox', {
          name: 'Message body',
        }) as HTMLTextAreaElement
      ).value,
    ).toBe('سلام @source.name');
    expect(navigate).not.toHaveBeenCalled();
  });
  it('does not misreport a successful creation as a failed save when opening the list fails', async () => {
    navigate.mockRejectedValue(new Error('navigation failure'));
    const user = await openCreate();
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Create template' }));
    await screen.findByText(
      'The template was saved, but the list could not be opened. Open SMS templates from the sidebar.',
    );
    expect(enqueueSnackbar).toHaveBeenCalledWith({
      message: 'The template was saved.',
      variant: 'success',
    });
    expect(
      screen.queryByText(
        'The template could not be saved. Your changes have been kept. Please try again.',
      ),
    ).toBeNull();
    expect(closeSidePanel).not.toHaveBeenCalled();
    expect(
      bridge.mock.calls.filter(
        ([request]) => request.action === 'create-template',
      ),
    ).toHaveLength(1);
  });
  it('also explains an empty edited title and preserves edits after a real conflict response', async () => {
    const user = userEvent.setup();
    render(<Edit />);
    const title = await screen.findByRole('textbox', { name: 'Title' });
    await user.clear(title);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(enqueueSnackbar).toHaveBeenCalledWith({
      message: 'A title is required.',
      variant: 'error',
    });
    const original = bridge.getMockImplementation()!;
    bridge.mockImplementation((request) =>
      request.action === 'save-template'
        ? Promise.resolve({
            success: false,
            errorCode: 'CONFLICT',
            isConflict: true,
          })
        : original(request),
    );
    await user.type(title, 'متن تازه');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText(
      'Someone else changed this template. Your text is kept. Reload before saving.',
    );
    expect((title as HTMLInputElement).value).toBe('متن تازه');
    expect(enqueueSnackbar).toHaveBeenCalledWith({
      message:
        'Someone else changed this template. Your text is kept. Reload before saving.',
      variant: 'error',
    });
    expect(navigate).not.toHaveBeenCalled();
  });
});
