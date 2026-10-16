// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { navigate, closeSidePanel } = vi.hoisted(() => ({
  navigate: vi.fn(),
  closeSidePanel: vi.fn(),
}));
vi.mock('twenty-sdk/define', () => ({
  defineFrontComponent: (config: unknown) => ({ config }),
}));
vi.mock('twenty-sdk/front-component', () => ({
  AppPath: { RecordShowPage: '/object/:objectNameSingular/:objectRecordId' },
  useLocale: () => 'fa-IR',
  useRecordId: () => '187c3b8c-4a53-4de3-80be-9a683d044a75',
  useTranslate: () => ({ t: (text: string) => text }),
  enqueueSnackbar: vi.fn(),
  navigate,
  closeSidePanel,
}));
import definition from 'src/components/create-template.front-component';
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
    ).toBe(true);
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
    expect(navigate).toHaveBeenCalledWith(
      '/object/:objectNameSingular/:objectRecordId',
      { objectNameSingular: 'messageTemplate', objectRecordId: draftId },
    );
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
    await screen.findByText('The template could not be saved.');
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
    ).toBe(true);
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
});
