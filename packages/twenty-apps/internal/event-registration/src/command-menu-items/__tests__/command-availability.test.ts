import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { evaluateConditionalAvailabilityExpression } from 'twenty-shared/utils';

// The condition is declared with `twenty-sdk/define` placeholders, which THROW
// when touched at runtime (that is how the SDK prevents them from being
// evaluated outside an expression). The build plugin rewrites them into the
// expr-eval string that actually ships.
//
// So the thing worth proving is the BUILT manifest, not the TypeScript module.
// When the app has not been built the suite says so instead of pretending.
const MANIFEST_PATH = fileURLToPath(
  new URL('../../../.twenty/output/manifest.json', import.meta.url),
);

const readManifest = (): {
  commandMenuItems: Array<{
    label: string;
    conditionalAvailabilityExpression?: string;
    frontComponentUniversalIdentifier?: string;
  }>;
} | null => {
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  } catch {
    return null;
  }
};

const manifest = readManifest();

describe.skipIf(manifest === null)('built command availability', () => {
  const commands = manifest?.commandMenuItems ?? [];

  const expressions = commands.map(
    (command) => command.conditionalAvailabilityExpression ?? '',
  );

  const contextFor = (nameSingular: string, selected: number) => ({
    objectMetadataItem: { nameSingular },
    numberOfSelectedRecords: selected,
  });

  it('ships exactly one lead entry point and one interaction entry point', () => {
    expect(commands).toHaveLength(2);
  });

  it('ships a real expression, not a placeholder identifier', () => {
    for (const expression of expressions) {
      expect(expression).toContain('objectMetadataItem.nameSingular ==');
      expect(expression).toContain('numberOfSelectedRecords == 1');
      // A quoted-literal mistake ships with the surrounding quotes intact.
      expect(expression.startsWith('\'')).toBe(false);
    }
  });

  it('shows on a single lead and on a single interaction', () => {
    const leadExpression = expressions.find((value) =>
      value.includes('eventLead'),
    );
    const interactionExpression = expressions.find((value) =>
      value.includes('salesInteraction'),
    );

    expect(
      evaluateConditionalAvailabilityExpression(
        leadExpression,
        contextFor('eventLead', 1),
      ),
    ).toBe(true);
    expect(
      evaluateConditionalAvailabilityExpression(
        interactionExpression,
        contextFor('salesInteraction', 1),
      ),
    ).toBe(true);
  });

  it('hides on other objects and on multi-selection', () => {
    const leadExpression = expressions.find((value) =>
      value.includes('eventLead'),
    );

    expect(
      evaluateConditionalAvailabilityExpression(
        leadExpression,
        contextFor('person', 1),
      ),
    ).toBe(false);
    expect(
      evaluateConditionalAvailabilityExpression(
        leadExpression,
        contextFor('eventLead', 3),
      ),
    ).toBe(false);
  });

  it('points both entry points at the same front component', () => {
    expect(commands[0].frontComponentUniversalIdentifier).toBe(
      commands[1].frontComponentUniversalIdentifier,
    );
  });
});
