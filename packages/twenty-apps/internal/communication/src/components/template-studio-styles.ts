// Studio-specific presentation added on top of the shared `composerStyles`.
// Kept as plain data so RTL only has to flip alignment, not layout.
export const templateStudioStyles = {
  page: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
    maxWidth: '100%',
    boxSizing: 'border-box' as const,
  },
  pageHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap' as const,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap' as const,
  },
  searchInput: {
    width: 240,
    maxWidth: '100%',
  },
  // A real table: fixed layout plus wrapping cells keeps it responsive without
  // ever producing a horizontal scrollbar.
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    tableLayout: 'fixed' as const,
    fontSize: 13,
  },
  tableHeaderCell: {
    textAlign: 'start' as const,
    padding: '8px 10px',
    fontSize: 12,
    fontWeight: 600,
    color: '#555',
    borderBottom: '1px solid #e4e4e4',
    background: '#fafafa',
  },
  tableCell: {
    padding: '8px 10px',
    color: '#111',
    borderBottom: '1px solid #f0f0f0',
    overflowWrap: 'anywhere' as const,
    verticalAlign: 'middle' as const,
  },
  tableActionsCell: {
    padding: '8px 10px',
    borderBottom: '1px solid #f0f0f0',
    verticalAlign: 'middle' as const,
    whiteSpace: 'nowrap' as const,
    textAlign: 'end' as const,
  },
  tableActions: {
    display: 'flex',
    gap: 6,
    justifyContent: 'flex-end',
  },
  compactButton: {
    padding: '4px 10px',
    fontSize: 12,
    fontFamily: 'inherit',
    color: '#333',
    background: '#fff',
    border: '1px solid #d6d6d6',
    borderRadius: 4,
    cursor: 'pointer',
  },
  // Delete is visually distinct: a danger button, not a second neutral one.
  dangerButton: {
    padding: '4px 10px',
    fontSize: 12,
    fontFamily: 'inherit',
    fontWeight: 500,
    color: '#b42318',
    background: '#fef3f2',
    border: '1px solid #fecdca',
    borderRadius: 4,
    cursor: 'pointer',
  },
  // The overlay is portaled to `<body>`, so it must outrank the host's own
  // layers and must explicitly accept pointer events (an ancestor inside the
  // widget may have disabled them).
  modalBackdrop: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(16, 24, 40, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 2147483000,
    pointerEvents: 'auto' as const,
    boxSizing: 'border-box' as const,
    // The backdrop itself never scrolls: the dialog owns its own scrolled body,
    // so content can never escape below the viewport.
    overflow: 'hidden' as const,
  },
  // A three-row dialog: a FIXED header, a SCROLLING body and a FIXED action row.
  // `height` is capped in viewport units and `overflow: hidden` keeps the rows
  // inside it, while the body row subtracts the header/footer from the height so
  // nothing can push the actions off-screen.
  modal: {
    display: 'flex',
    flexDirection: 'column' as const,
    width: '100%',
    maxWidth: 760,
    height: '86vh',
    maxHeight: 720,
    minHeight: 320,
    overflow: 'hidden' as const,
    boxSizing: 'border-box' as const,
    background: '#fff',
    border: '1px solid #e4e4e4',
    borderRadius: 8,
    boxShadow: '0 12px 32px rgba(16, 24, 40, 0.18)',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 13,
    color: '#333',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flex: '0 0 auto',
    padding: '14px 20px',
    borderBottom: '1px solid #ececec',
    background: '#fff',
  },
  // The ONLY scrolling row. `overflowY: auto` plus a bounded height is what makes
  // the modal viewport-safe.
  modalBody: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 14,
    flex: '1 1 auto',
    minHeight: 0,
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
    padding: '16px 20px',
    boxSizing: 'border-box' as const,
  },
  modalFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    flex: '0 0 auto',
    padding: '12px 20px',
    borderTop: '1px solid #ececec',
    background: '#fafafa',
  },
  // The variable palette scrolls independently of the body, so a long catalog
  // never grows the dialog.
  variablePalette: {
    maxHeight: 220,
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
    paddingInlineEnd: 4,
  },
  modalColumns: {
    display: 'flex',
    gap: 16,
    alignItems: 'flex-start',
    flexWrap: 'wrap' as const,
  },
  modalMain: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
    flex: '2 1 340px',
    minWidth: 240,
  },
  modalSide: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
    flex: '1 1 240px',
    minWidth: 220,
  },
  // A bounded, internally scrolling result list: a long catalog or People list
  // scrolls here instead of stretching the dialog.
  comboboxList: {
    margin: 0,
    marginTop: 4,
    padding: 4,
    listStyle: 'none',
    maxHeight: 180,
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
    background: '#fff',
    border: '1px solid #d6d6d6',
    borderRadius: 4,
    boxShadow: '0 6px 16px rgba(16, 24, 40, 0.1)',
  },
  // The same list, but portaled to `<body>` and pinned to the input. `top` and
  // `maxHeight` are supplied per render from the input's measured rectangle.
  comboboxListFixed: {
    position: 'fixed' as const,
    zIndex: 2147483001,
    pointerEvents: 'auto' as const,
    margin: 0,
    padding: 4,
    listStyle: 'none',
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
    background: '#fff',
    border: '1px solid #d6d6d6',
    borderRadius: 4,
    boxShadow: '0 8px 20px rgba(16, 24, 40, 0.16)',
    boxSizing: 'border-box' as const,
  },
  // The loading / empty / loading-more row inside a listbox.
  comboboxStatus: {
    padding: '8px 8px',
    fontSize: 12,
    color: '#666',
  },
  // An always-visible notice row pinned under the dialog header, so a validation
  // or save failure can never be hidden inside the scrolling body.
  modalNotice: {
    flex: '0 0 auto' as const,
    margin: 0,
    padding: '8px 20px',
    fontSize: 12,
    color: '#8a1f11',
    background: '#fdecea',
    borderBottom: '1px solid #f5c6c0',
  },
  listHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  item: {
    padding: '6px 8px',
    fontSize: 13,
    fontFamily: 'inherit',
    textAlign: 'start' as const,
    color: '#333',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: 4,
    cursor: 'pointer',
  },
  rowActions: {
    display: 'flex',
    gap: 8,
  },
  // A large, RTL-aware editor surface: the body is Persian text first, and the
  // height is generous so line breaks are visible while writing.
  body: {
    minHeight: 180,
    lineHeight: 1.8,
    resize: 'vertical' as const,
    whiteSpace: 'pre-wrap' as const,
    textAlign: 'start' as const,
  },
  fieldGrid: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  // The FIELD button shows the user-facing label prominently and the stable
  // technical token secondarily.
  fieldButton: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-start',
    gap: 2,
    padding: '6px 10px',
    fontFamily: 'inherit',
    background: '#fff',
    border: '1px solid #d6d6d6',
    borderRadius: 6,
    cursor: 'grab',
    textAlign: 'start' as const,
    maxWidth: '100%',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: '#111',
  },
  // Forced LTR plus bidi isolation, so a token always READS as
  // `@person.firstName` even inside the RTL panel.
  fieldToken: {
    fontSize: 12,
    color: '#666',
    direction: 'ltr' as const,
    unicodeBidi: 'isolate' as const,
    display: 'inline-block',
  },
  // The selected field is clearly highlighted without looking disabled, and the
  // card advertises its draggability through the grab cursor.
  fieldButtonSelected: {
    background: '#f2f4f7',
    borderColor: '#667085',
    boxShadow: '0 0 0 1px #667085 inset',
  },
  // The textarea shows a visible drop-active state while a field is over it.
  bodyDropActive: {
    borderColor: '#667085',
    boxShadow: '0 0 0 2px #d0d5dd inset',
    background: '#fbfbfd',
  },
  // --- combobox -------------------------------------------------------------
  combobox: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    position: 'relative' as const,
  },
  comboboxInput: {
    flex: 1,
  },
  comboboxClear: {
    flex: '0 0 auto',
    width: 26,
    height: 26,
    fontFamily: 'inherit',
    fontSize: 15,
    lineHeight: 1,
    color: '#666',
    background: '#fff',
    border: '1px solid #d6d6d6',
    borderRadius: 4,
    cursor: 'pointer',
  },
  comboboxOption: {
    padding: '6px 8px',
    fontSize: 13,
    color: '#333',
    borderRadius: 4,
    cursor: 'pointer',
  },
  comboboxOptionActive: {
    padding: '6px 8px',
    fontSize: 13,
    color: '#111',
    background: '#f2f4f7',
    borderRadius: 4,
    cursor: 'pointer',
  },
  notice: {
    margin: 0,
    padding: '8px 10px',
    fontSize: 12,
    color: '#027a48',
    background: '#ecfdf3',
    border: '1px solid #abefc6',
    borderRadius: 4,
  },
};
