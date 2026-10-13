// Studio-specific presentation added on top of the shared `composerStyles`.
// Kept as plain data so RTL only has to flip alignment, not layout.
export const templateStudioStyles = {
  columns: {
    display: 'flex',
    gap: 16,
    alignItems: 'flex-start',
    flexWrap: 'wrap' as const,
  },
  listColumn: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
    flex: '1 1 260px',
    minWidth: 240,
  },
  editorColumn: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
    flex: '2 1 420px',
    minWidth: 300,
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
  selectedItem: {
    padding: '6px 8px',
    fontSize: 13,
    fontFamily: 'inherit',
    fontWeight: 600,
    textAlign: 'start' as const,
    color: '#111',
    background: '#f2f4f7',
    border: '1px solid #d0d5dd',
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
    cursor: 'pointer',
    textAlign: 'start' as const,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: '#111',
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
