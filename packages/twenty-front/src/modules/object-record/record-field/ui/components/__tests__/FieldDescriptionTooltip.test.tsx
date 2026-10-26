import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip } from 'twenty-ui/primitives/surfaces';

import { FieldDescriptionTooltip } from '@/object-record/record-field/ui/components/FieldDescriptionTooltip';
import { FieldDescriptionTooltipProvider } from '@/object-record/record-field/ui/components/FieldDescriptionTooltipProvider';

describe('FieldDescriptionTooltip', () => {
  it('uses its shared provider through a disabled tooltip', async () => {
    const user = userEvent.setup();

    render(
      <FieldDescriptionTooltipProvider>
        <Tooltip content="Inline field" disabled>
          <div>
            <FieldDescriptionTooltip
              label="Company"
              description="Legal company name"
            />
          </div>
        </Tooltip>
      </FieldDescriptionTooltipProvider>,
    );

    await user.tab();

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Legal company name',
    );
  });

  it.each([
    ['Company'],
    ['شناسه اینستاگرام'],
  ])(
    'renders %s inside a width-bounded flex parent (header truncation contract)',
    (label) => {
      const { container } = render(
        <div data-testid="header-slot" style={{ display: 'flex', width: 48 }}>
          <FieldDescriptionTooltip label={label} />
        </div>,
      );

      expect(screen.getByText(label)).toBeInTheDocument();
      expect(
        container.querySelector('[data-testid="header-slot"]'),
      ).toHaveStyle({ width: '48px' });
    },
  );
});
