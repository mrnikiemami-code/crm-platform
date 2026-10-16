type CreationObject = {
  universalIdentifier?: string | null;
  applicationId?: string;
};

type CreationComponent = {
  id: string;
  universalIdentifier?: string | null;
  applicationId: string;
};

export const resolveTemplateCreationEditor = (
  object: CreationObject | undefined,
  components: CreationComponent[],
):
  | { kind: 'NATIVE' }
  | { kind: 'UNAVAILABLE' }
  | { kind: 'EDITOR'; componentId: string } => {
  // Names can collide across applications; identifiers and ownership cannot.
  if (object?.universalIdentifier !== '96ca95ed-5b34-41be-9b11-12dbca202a39') {
    return { kind: 'NATIVE' };
  }
  const component = components.find(
    (candidate) =>
      candidate.universalIdentifier ===
        '937d230a-4116-4e24-a227-2c113ec3da80' &&
      candidate.applicationId === object.applicationId,
  );
  return component === undefined
    ? { kind: 'UNAVAILABLE' }
    : { kind: 'EDITOR', componentId: component.id };
};
