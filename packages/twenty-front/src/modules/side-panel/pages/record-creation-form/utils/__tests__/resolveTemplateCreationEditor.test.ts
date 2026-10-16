import { resolveTemplateCreationEditor } from '../resolveTemplateCreationEditor';

const object = {
  universalIdentifier: '96ca95ed-5b34-41be-9b11-12dbca202a39',
  applicationId: 'communication-app',
};
const component = {
  id: 'create-editor-id',
  universalIdentifier: '937d230a-4116-4e24-a227-2c113ec3da80',
  applicationId: 'communication-app',
};

describe('template creation routing', () => {
  it('routes the template object to its own shared create editor', () => {
    expect(resolveTemplateCreationEditor(object, [component])).toEqual({
      kind: 'EDITOR',
      componentId: component.id,
    });
  });
  it('keeps other objects on the native creation form', () => {
    expect(
      resolveTemplateCreationEditor(
        { ...object, universalIdentifier: 'other-object' },
        [component],
      ),
    ).toEqual({ kind: 'NATIVE' });
  });
  it('does not silently show the old incomplete form on an older application', () => {
    expect(resolveTemplateCreationEditor(object, [])).toEqual({
      kind: 'UNAVAILABLE',
    });
  });
  it('refuses a component from another application even if its identifier matches', () => {
    expect(
      resolveTemplateCreationEditor(object, [
        { ...component, applicationId: 'impostor' },
      ]),
    ).toEqual({ kind: 'UNAVAILABLE' });
  });
});
