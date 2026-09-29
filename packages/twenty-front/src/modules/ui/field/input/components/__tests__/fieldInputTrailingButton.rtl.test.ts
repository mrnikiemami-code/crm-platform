import { readFileSync } from 'fs';
import { join } from 'path';

const SRC_DIR = join(__dirname, '../../../../../..');

// Field inputs render inside RTL layouts, so trailing buttons and the space
// reserved for them must follow the inline direction.
const FIELD_INPUTS_WITH_TRAILING_BUTTON = [
  'modules/ui/field/input/components/TextAreaInput.tsx',
  'modules/object-record/record-field/ui/meta-types/input/components/MultiItemBaseInput.tsx',
];

const PHYSICAL_HORIZONTAL_PROPERTY =
  /^\s*(left|right|padding-left|padding-right|margin-left|margin-right):/m;

describe('field inputs with a trailing button', () => {
  it.each(FIELD_INPUTS_WITH_TRAILING_BUTTON)(
    '%s positions the button and its reserved space logically',
    (relativePath) => {
      const source = readFileSync(join(SRC_DIR, relativePath), 'utf8');

      expect(source).not.toMatch(PHYSICAL_HORIZONTAL_PROPERTY);
      expect(source).toMatch(/inset-inline-end:/);
    },
  );
});
