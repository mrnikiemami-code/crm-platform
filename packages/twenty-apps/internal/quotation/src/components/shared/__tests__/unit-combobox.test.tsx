import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UnitCombobox } from 'src/components/shared/unit-combobox';

describe('shared reference unit combobox', () => {
  it('searches the operator code but emits only the primary key', () => {
    const onChange = vi.fn();
    render(<UnitCombobox units={[{ id: 'unit-uuid-1', name: 'عدد', accountingCode: '00100' }, { id: 'unit-uuid-2', name: 'متر', accountingCode: '00200' }]} value="" onChange={onChange} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '00200' } });
    expect(screen.queryByRole('option', { name: /عدد/ })).toBeNull();
    fireEvent.click(screen.getByRole('option', { name: /متر/ }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith('unit-uuid-2');
  });
  it('never submits typed arbitrary unit text', () => {
    const onChange = vi.fn();
    render(<UnitCombobox units={[]} value="" onChange={onChange} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'واحد ناموجود' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
  });
});
