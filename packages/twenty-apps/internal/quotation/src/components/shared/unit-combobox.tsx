import { useId, useState } from 'react';

export type UnitOption = { id: string; name: string; accountingCode?: string };
type Props = { units: UnitOption[]; value: string; onChange: (id: string) => void; disabled?: boolean };

export const UnitCombobox = ({ units, value, onChange, disabled = false }: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const selected = units.find(unit => unit.id === value);
  const matches = units.filter(unit => (unit.name + ' ' + (unit.accountingCode ?? '')).toLowerCase().includes(query.trim().toLowerCase()));
  const choose = (id: string) => { onChange(id); setOpen(false); setQuery(''); setActive(0); };
  return <div dir="rtl" style={{ display: 'grid', gap: 4 }}>
    <label>واحد اندازه‌گیری
      <input role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? listId + '-' + active : undefined}
        disabled={disabled} value={open ? query : selected?.name ?? ''} placeholder="انتخاب یا جست‌وجوی واحد"
        style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: 9, borderRadius: 6, background: 'var(--t-color-gray1)', color: 'var(--t-color-gray12)', border: '1px solid var(--t-color-gray6)' }}
        onFocus={() => { setOpen(true); setQuery(''); setActive(0); }}
        onChange={event => { setOpen(true); setQuery(event.target.value); setActive(0); }}
        onKeyDown={event => {
          if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
          else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); setActive(index => Math.max(0, Math.min(matches.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))); }
          else if (event.key === 'Enter' && open && matches[active]) { event.preventDefault(); choose(matches[active].id); }
        }} />
    </label>
    {open && <div role="listbox" id={listId} aria-label="واحدهای فعال" style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--t-color-gray6)', borderRadius: 6 }}>
      {matches.length === 0 ? <div style={{ padding: 8 }}>واحدی یافت نشد</div> : matches.map((unit, index) =>
        <button key={unit.id} id={listId + '-' + index} type="button" role="option" aria-selected={unit.id === value} disabled={disabled} onClick={() => choose(unit.id)}
          style={{ display: 'block', width: '100%', textAlign: 'start', border: 0, padding: 8, cursor: 'pointer', color: 'inherit', background: index === active ? 'var(--t-color-gray4)' : 'transparent' }}>
          {unit.name}{unit.accountingCode ? ' — ' + unit.accountingCode : ''}
        </button>)}
    </div>}
  </div>;
};
