import { createContext, useContext, type ComponentPropsWithoutRef } from 'react';

// Presentation-only bridge to Twenty's existing Settings Table primitives.
// The semantic HTML fallback also works when rendered outside the CRM host.
// Grid layout is declared once per table, never copied into each business row.
const Columns = createContext('repeat(auto-fit, minmax(0, 1fr))');

export const NativeSettingsTable = ({ columns, children, ...props }: ComponentPropsWithoutRef<'table'> & { columns: string }) => (
  <Columns.Provider value={columns}>
    <table {...props} className="twenty-native-settings-table">{children}</table>
  </Columns.Provider>
);
export const NativeSettingsHead = (props: ComponentPropsWithoutRef<'thead'>) => <thead {...props} className="twenty-native-settings-head" />;
export const NativeSettingsBody = (props: ComponentPropsWithoutRef<'tbody'>) => <tbody {...props} className="twenty-native-settings-body" />;
export const NativeSettingsRow = ({ style, ...props }: ComponentPropsWithoutRef<'tr'>) => {
  const columns = useContext(Columns);
  return <tr {...props} className="twenty-native-settings-row" style={{ ...style, gridTemplateColumns: columns }} />;
};
export const NativeSettingsHeader = (props: ComponentPropsWithoutRef<'th'>) => <th {...props} className="twenty-native-settings-header" />;
export const NativeSettingsCell = (props: ComponentPropsWithoutRef<'td'>) => <td {...props} className="twenty-native-settings-cell" />;
