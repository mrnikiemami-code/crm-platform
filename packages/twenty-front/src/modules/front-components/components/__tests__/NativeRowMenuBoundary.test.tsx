import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NativeRowMenuBoundary } from '@/front-components/components/NativeSettingsTableHost';

describe('native host row menu boundary', () => {
  afterEach(cleanup);
  it('dismisses from the real document without swallowing the outside action', () => {
    const close = jest.fn();
    const outside = jest.fn();
    render(<><NativeRowMenuBoundary title="open" onClick={close}><button aria-haspopup="menu">Menu</button><button role="menuitem">Edit</button></NativeRowMenuBoundary><button onClick={outside}>Outside</button></>);
    fireEvent.pointerDown(screen.getByRole('menuitem'));
    expect(close).not.toHaveBeenCalled();
    fireEvent.pointerDown(screen.getByText('Outside'));
    fireEvent.click(screen.getByText('Outside'));
    expect(close).toHaveBeenCalledWith({ type: 'click', target: { value: 'dismiss' } });
    expect(outside).toHaveBeenCalledTimes(1);
  });
  it('restores trigger focus on Escape and removes listeners on closure', () => {
    const close = jest.fn();
    const view = render(<NativeRowMenuBoundary title="open" onClick={close}><button aria-haspopup="menu">Menu</button><button role="menuitem">Edit</button></NativeRowMenuBoundary>);
    screen.getByRole('menuitem').focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(close).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(screen.getByText('Menu'));
    view.rerender(<NativeRowMenuBoundary title="closed" onClick={close}><button aria-haspopup="menu">Menu</button></NativeRowMenuBoundary>);
    fireEvent.pointerDown(document.body);
    expect(close).toHaveBeenCalledTimes(1);
  });
});
