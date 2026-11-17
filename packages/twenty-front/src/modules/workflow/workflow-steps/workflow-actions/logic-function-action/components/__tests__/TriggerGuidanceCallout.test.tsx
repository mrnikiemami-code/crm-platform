import { render, screen } from '@testing-library/react';
import { TRIGGER_STEP_ID } from 'twenty-shared/workflow';

const setWorkflowSelectedNode = jest.fn();

jest.mock(
  '@/ui/utilities/state/jotai/hooks/useSetAtomComponentState',
  () => ({
    useSetAtomComponentState: () => setWorkflowSelectedNode,
  }),
);

jest.mock('twenty-ui/primitives/feedback', () => ({
  Callout: ({
    title,
    description,
    action,
  }: {
    title: string;
    description: string;
    action?: { label: string; onClick: () => void };
  }) => (
    <div>
      <span>{title}</span>
      <span>{description}</span>
      {action ? (
        <button type="button" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </div>
  ),
}));

// Imported after the mocks so the module picks them up.
import { TriggerGuidanceCallout } from '@/workflow/workflow-steps/workflow-actions/logic-function-action/components/TriggerGuidanceCallout';

describe('TriggerGuidanceCallout', () => {
  beforeEach(() => {
    setWorkflowSelectedNode.mockReset();
  });

  it('shows a Persian title instead of the previous English one', () => {
    render(<TriggerGuidanceCallout />);

    expect(screen.getByText('محرک نیاز به تنظیم دارد')).toBeInTheDocument();
    expect(screen.queryByText('Trigger not configured')).toBeNull();
  });

  it('explains the fix in one short Persian sentence', () => {
    render(<TriggerGuidanceCallout />);

    expect(
      screen.getByText(
        'برای ارسال پیامک هنگام تغییر اطلاعات، رویداد «ویرایش رکورد» و ستون موردنظر را انتخاب کنید.',
      ),
    ).toBeInTheDocument();
  });

  it('offers the app-owned copy when the action supplies one', () => {
    render(<TriggerGuidanceCallout description="متن اختصاصی اپ" />);

    expect(screen.getByText('متن اختصاصی اپ')).toBeInTheDocument();
  });

  it('is actionable: it selects the trigger node', () => {
    render(<TriggerGuidanceCallout />);

    screen.getByRole('button', { name: 'تنظیم محرک' }).click();

    expect(setWorkflowSelectedNode).toHaveBeenCalledWith(TRIGGER_STEP_ID);
  });

  it('does not offer the action in a read-only view', () => {
    render(<TriggerGuidanceCallout readonly />);

    expect(screen.queryByRole('button', { name: 'تنظیم محرک' })).toBeNull();
  });
});
