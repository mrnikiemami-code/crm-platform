import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';

import { ROUNDING_RULES_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  selectDefaultRoundingRule,
  type RoundingRuleCatalogEntry,
} from 'src/domain/money/rounding-rule';
import {
  bootstrapRoundingRules,
  countQuotationsPerRoundingRule,
  deactivateRoundingRule,
  deleteRoundingRule,
  listRoundingRulesFromServer,
  loadRoundingRules,
  saveRoundingRule,
  setDefaultRoundingRule,
} from 'src/services/rounding-rule.service';
import {
  appNotInstalled,
  failure,
  isAppInstalled,
  readBody,
  readString,
} from 'src/logic-functions/accounting-route-helpers';

const describeRule = (
  entry: RoundingRuleCatalogEntry,
  usage: Map<string, number>,
) => ({
  recordId: entry.recordId,
  code: entry.id,
  name: entry.label,
  stepRials: entry.stepRials.toString(),
  isActive: entry.isActive,
  isDefault: entry.isDefault,
  quotationCount: usage.get(entry.id) ?? 0,
});

const describeCatalog = (
  entries: RoundingRuleCatalogEntry[],
  usage: Map<string, number>,
) => ({
  rules: entries.map((entry) => describeRule(entry, usage)),
  defaultCode: selectDefaultRoundingRule(entries)?.id ?? null,
});

const readBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const readCallerAuthorization = (
  headers: Record<string, string | undefined>,
): string | null => {
  const authorization = headers.authorization;

  return typeof authorization === 'string' && authorization.trim() !== ''
    ? authorization
    : null;
};

const handler = async (event: RoutePayload<unknown>) => {
  const body = readBody(event);
  const action = readString(body.action);

  if (!isAppInstalled()) {
    return appNotInstalled();
  }

  const authorizationHeader = readCallerAuthorization(event.headers);

  try {
    if (action === 'list' || action === '') {
      const listed = await listRoundingRulesFromServer({
        authorizationHeader,
      });

      if (listed.ok) {
        const usage = new Map(
          listed.value.map((entry) => [entry.id, 0] as const),
        );

        return { success: true, ...describeCatalog(listed.value, usage) };
      }

      const entries = await loadRoundingRules();
      const usage = await countQuotationsPerRoundingRule();

      return { success: true, ...describeCatalog(entries, usage) };
    }

    if (action === 'bootstrap') {
      const bootstrapped = await bootstrapRoundingRules({
        authorizationHeader,
      });

      if (!bootstrapped.ok) {
        return failure(bootstrapped.refusal.code, bootstrapped.refusal.detail);
      }

      const usage = await countQuotationsPerRoundingRule();

      return {
        success: true,
        ...describeCatalog(bootstrapped.value, usage),
      };
    }

    if (action === 'save') {
      const saved = await saveRoundingRule(
        {
          recordId: readString(body.recordId) || null,
          name: readString(body.name),
          stepRialsText: readString(body.stepRialsText),
          isActive: readBoolean(body.isActive, true),
          isDefault: body.isDefault === true,
        },
        { authorizationHeader },
      );

      if (!saved.ok) {
        return failure(saved.refusal.code, saved.refusal.detail);
      }

      const usage = await countQuotationsPerRoundingRule();

      return { success: true, ...describeCatalog(saved.value, usage) };
    }

    const recordId = readString(body.recordId);

    if (recordId === '') {
      return failure('ROUNDING_RULE_REQUIRED', 'قاعده رُند را انتخاب کنید');
    }

    if (action === 'set-default') {
      const updated = await setDefaultRoundingRule(recordId, {
        authorizationHeader,
      });

      if (!updated.ok) {
        return failure(updated.refusal.code, updated.refusal.detail);
      }

      const usage = await countQuotationsPerRoundingRule();

      return { success: true, ...describeCatalog(updated.value, usage) };
    }

    if (action === 'delete') {
      const deleted = await deleteRoundingRule(recordId, {
        authorizationHeader,
      });

      if (!deleted.ok) {
        return failure(deleted.refusal.code, deleted.refusal.detail);
      }

      const usage = await countQuotationsPerRoundingRule();

      return { success: true, ...describeCatalog(deleted.value, usage) };
    }

    if (action === 'deactivate') {
      const deactivated = await deactivateRoundingRule(recordId, {
        authorizationHeader,
      });

      if (!deactivated.ok) {
        return failure(deactivated.refusal.code, deactivated.refusal.detail);
      }

      const usage = await countQuotationsPerRoundingRule();

      return { success: true, ...describeCatalog(deactivated.value, usage) };
    }

    return failure('INVALID_INPUT', 'عملیات قواعد رُند ناشناخته است');
  } catch {
    return failure('PERSISTENCE_FAILED', 'ذخیرهٔ قواعد رُند انجام نشد');
  }
};

export default defineLogicFunction({
  universalIdentifier: ROUNDING_RULES_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'rounding-rules',
  description: 'Catalog and mutate named payable rounding rules for a workspace',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/quotation/rounding-rules',
    httpMethod: 'POST',
    isAuthRequired: true,
    // Server boundary checks the caller role; forward the human Authorization.
    forwardedRequestHeaders: ['authorization'],
  },
});
