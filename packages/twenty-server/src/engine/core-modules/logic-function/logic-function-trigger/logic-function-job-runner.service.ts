import { Injectable, Logger } from '@nestjs/common';

import { RetryableLogicFunctionError } from 'twenty-shared/logic-function';
import { isDefined } from 'twenty-shared/utils';

import { LogicFunctionExecutorService } from 'src/engine/core-modules/logic-function/logic-function-executor/logic-function-executor.service';
import { type LogicFunctionExecuteError } from 'src/engine/core-modules/logic-function/logic-function-drivers/interfaces/logic-function-driver.interface';
import { type LogicFunctionExecutionStatus } from 'src/engine/metadata-modules/logic-function/dtos/logic-function-execution-result.dto';
import { LOGIC_FUNCTION_APPLICATION_RETRY_LIMIT } from 'src/engine/core-modules/logic-function/logic-function-trigger/constants/logic-function-application-retry-limit.constant';
import { isRetryableLogicFunctionExecutionError } from 'src/engine/core-modules/logic-function/logic-function-trigger/utils/is-retryable-logic-function-execution-error.util';
import {
  LogicFunctionException,
  LogicFunctionExceptionCode,
} from 'src/engine/metadata-modules/logic-function/logic-function.exception';

export type LogicFunctionJobPayload = {
  logicFunctionId: string;
  workspaceId: string;
  payload?: object;
  userId?: string;
  userWorkspaceId?: string;
  applicationRetryCount?: number;
};

// A structured code: uppercase words joined by single colons, e.g.
// `READ_LEAD:REJECTED`. Deliberately strict — anything with a space, a quote, an
// `@`, a slash or a dot is free text and could carry data.
const STRUCTURED_ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]*(?::[A-Z][A-Z0-9_]*)*$/;
const MAX_LOGGED_CODE_LENGTH = 120;
const REDACTED = '<redacted>';

const toSafeStructuredCode = (message: string): string =>
  typeof message === 'string' &&
  message.length <= MAX_LOGGED_CODE_LENGTH &&
  STRUCTURED_ERROR_CODE_PATTERN.test(message)
    ? message
    : REDACTED;

// An error type is a JavaScript class name. Anything else is treated as free text.
const toSafeIdentifier = (value: unknown): string =>
  typeof value === 'string' && /^[A-Za-z_$][A-Za-z0-9_$]{0,60}$/.test(value)
    ? value
    : 'UnknownError';

// The execution status is an enum value; anything unexpected is reported as
// `Unknown` rather than as `undefined`.
const toSafeStatus = (value: unknown): string =>
  typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,30}$/.test(value)
    ? value
    : 'Unknown';

const countLines = (logs: string): number =>
  typeof logs === 'string' && logs.length > 0
    ? logs.split('\n').filter((line) => line.trim().length > 0).length
    : 0;

@Injectable()
export class LogicFunctionJobRunnerService {
  private readonly logger = new Logger(LogicFunctionJobRunnerService.name);

  constructor(
    private readonly logicFunctionExecutorService: LogicFunctionExecutorService,
  ) {}

  async run({
    logicFunctionPayload,
    retryLimit,
    persistRetryCount,
  }: {
    logicFunctionPayload: LogicFunctionJobPayload;
    retryLimit: number;
    persistRetryCount: (applicationRetryCount: number) => Promise<void>;
  }): Promise<void> {
    try {
      const retryCount = logicFunctionPayload.applicationRetryCount ?? 0;
      const maxRetries = Math.min(
        LOGIC_FUNCTION_APPLICATION_RETRY_LIMIT,
        retryLimit,
      );
      const logicFunctionExecutionResult =
        await this.logicFunctionExecutorService.execute({
          logicFunctionId: logicFunctionPayload.logicFunctionId,
          workspaceId: logicFunctionPayload.workspaceId,
          payload: logicFunctionPayload.payload ?? {},
          userId: logicFunctionPayload.userId,
          userWorkspaceId: logicFunctionPayload.userWorkspaceId,
          retry: { retryCount, maxRetries },
        });

      if (
        !isRetryableLogicFunctionExecutionError(
          logicFunctionExecutionResult.error,
        ) ||
        retryCount >= maxRetries
      ) {
        // This is the only place a failed execution is DISCARDED: the job is
        // reported as completed and the queue never retries, so without this
        // line the failure leaves no trace anywhere — not in the job, not in
        // the logs. Behaviour is unchanged; only the trace is added.
        if (isDefined(logicFunctionExecutionResult.error)) {
          this.logSkippedExecution({
            logicFunctionId: logicFunctionPayload.logicFunctionId,
            workspaceId: logicFunctionPayload.workspaceId,
            error: logicFunctionExecutionResult.error,
            status: logicFunctionExecutionResult.status,
            retryCount,
            maxRetries,
            logs: logicFunctionExecutionResult.logs,
          });
        }

        return;
      }

      await persistRetryCount(retryCount + 1);

      throw new RetryableLogicFunctionError(
        logicFunctionExecutionResult.error.errorMessage,
      );
    } catch (error) {
      // A stopped application must not fail the job: failing would make
      // the queue retry an execution that is intentionally blocked.
      if (
        error instanceof LogicFunctionException &&
        error.code === LogicFunctionExceptionCode.LOGIC_FUNCTION_DISABLED
      ) {
        return;
      }

      if (
        error instanceof LogicFunctionException &&
        error.code ===
          LogicFunctionExceptionCode.LOGIC_FUNCTION_DEPENDENCIES_SIZE_EXCEEDED
      ) {
        this.logger.warn(
          `Skipping function ${logicFunctionPayload.logicFunctionId} (workspace ${logicFunctionPayload.workspaceId}): ${error.message}`,
        );

        return;
      }

      throw error;
    }
  }

  /**
   * Records a discarded execution failure WITHOUT its text.
   *
   * An error message is arbitrary text: a driver failure can embed a URL, a
   * credential, a customer value or a whole response body, and these logs are
   * readable by workspace members. So only two things are emitted verbatim — the
   * error TYPE (a JavaScript identifier) and the wording when it is a STRUCTURED
   * code such as `READ_LEAD:REJECTED`, which is an allow-listed shape of
   * uppercase words and colons that cannot carry data. Anything else becomes
   * `<redacted>`, and the stack trace is never emitted.
   *
   * `logLineCount` is emitted because it answers the question that matters first:
   * an execution that produced no logs never reached the handler at all.
   */
  private logSkippedExecution({
    logicFunctionId,
    workspaceId,
    error,
    status,
    retryCount,
    maxRetries,
    logs,
  }: {
    logicFunctionId: string;
    workspaceId: string;
    error: LogicFunctionExecuteError;
    status: LogicFunctionExecutionStatus;
    retryCount: number;
    maxRetries: number;
    logs: string;
  }): void {
    this.logger.warn(
      `Execution failed without retry: ` +
        `functionId=${logicFunctionId}, ` +
        `workspaceId=${workspaceId}, ` +
        `status=${toSafeStatus(status)}, ` +
        `errorType=${toSafeIdentifier(error.errorType)}, ` +
        `errorCode=${toSafeStructuredCode(error.errorMessage)}, ` +
        `retryCount=${retryCount}/${maxRetries}, ` +
        `logLineCount=${countLines(logs)}`,
    );
  }
}
