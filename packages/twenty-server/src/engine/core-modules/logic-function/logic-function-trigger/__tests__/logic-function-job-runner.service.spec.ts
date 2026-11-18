import {
  RETRYABLE_LOGIC_FUNCTION_ERROR_NAME,
  RetryableLogicFunctionError,
} from 'twenty-shared/logic-function';
import { Logger } from '@nestjs/common';

import { type LogicFunctionExecutorService } from 'src/engine/core-modules/logic-function/logic-function-executor/logic-function-executor.service';
import { LogicFunctionJobRunnerService } from 'src/engine/core-modules/logic-function/logic-function-trigger/logic-function-job-runner.service';
import {
  LogicFunctionException,
  LogicFunctionExceptionCode,
} from 'src/engine/metadata-modules/logic-function/logic-function.exception';

describe('LogicFunctionJobRunnerService', () => {
  const logicFunctionPayload = {
    logicFunctionId: 'logic-function-id',
    workspaceId: 'workspace-id',
    payload: { newVersion: '1.4.1' },
  };

  const buildService = (
    execute: jest.Mock,
  ): {
    service: LogicFunctionJobRunnerService;
    persistRetryCount: jest.Mock;
  } => ({
    service: new LogicFunctionJobRunnerService({
      execute,
    } as unknown as LogicFunctionExecutorService),
    persistRetryCount: jest.fn(),
  });

  it('does not retry a successful execution', async () => {
    const execute = jest.fn().mockResolvedValue({});
    const { service, persistRetryCount } = buildService(execute);

    await service.run({
      logicFunctionPayload,
      retryLimit: 3,
      persistRetryCount,
    });

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        logicFunctionId: 'logic-function-id',
        workspaceId: 'workspace-id',
        retry: { retryCount: 0, maxRetries: 3 },
      }),
    );
    expect(persistRetryCount).not.toHaveBeenCalled();
  });

  it('persists the next retry count and fails the job on a retryable error', async () => {
    const execute = jest.fn().mockResolvedValue({
      error: {
        errorType: RETRYABLE_LOGIC_FUNCTION_ERROR_NAME,
        errorMessage: 'sandbox unavailable',
      },
    });
    const { service, persistRetryCount } = buildService(execute);

    await expect(
      service.run({
        logicFunctionPayload: {
          ...logicFunctionPayload,
          applicationRetryCount: 1,
        },
        retryLimit: 3,
        persistRetryCount,
      }),
    ).rejects.toThrow(RetryableLogicFunctionError);

    expect(persistRetryCount).toHaveBeenCalledWith(2);
  });

  it('stops retrying once the retry limit is reached', async () => {
    const execute = jest.fn().mockResolvedValue({
      error: {
        errorType: RETRYABLE_LOGIC_FUNCTION_ERROR_NAME,
        errorMessage: 'sandbox unavailable',
      },
    });
    const { service, persistRetryCount } = buildService(execute);

    await service.run({
      logicFunctionPayload: {
        ...logicFunctionPayload,
        applicationRetryCount: 3,
      },
      retryLimit: 3,
      persistRetryCount,
    });

    expect(persistRetryCount).not.toHaveBeenCalled();
  });

  it('does not fail the job when the application is stopped', async () => {
    const execute = jest
      .fn()
      .mockRejectedValue(
        new LogicFunctionException(
          'Application is stopped',
          LogicFunctionExceptionCode.LOGIC_FUNCTION_DISABLED,
        ),
      );
    const { service, persistRetryCount } = buildService(execute);

    await service.run({
      logicFunctionPayload,
      retryLimit: 3,
      persistRetryCount,
    });

    expect(persistRetryCount).not.toHaveBeenCalled();
  });

  describe('observability of a discarded failure', () => {
    let warn: jest.SpyInstance;

    beforeEach(() => {
      warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
    });

    afterEach(() => {
      warn.mockRestore();
    });

    const findWarning = (): string | undefined =>
      warn.mock.calls
        .map((call) => String(call[0]))
        .find((line) => line.startsWith('Execution failed without retry:'));

    it('records a non-retryable failure instead of discarding it silently', async () => {
      const execute = jest.fn().mockResolvedValue({
        status: 'ERROR',
        logs: '',
        error: {
          errorType: 'RecordGraphqlError',
          errorMessage: 'READ_LEAD:REJECTED',
          stackTrace: [],
        },
      });
      const { service, persistRetryCount } = buildService(execute);

      await service.run({
        logicFunctionPayload,
        retryLimit: 3,
        persistRetryCount,
      });

      const line = findWarning();

      expect(line).toBeDefined();
      expect(line).toContain('functionId=logic-function-id');
      expect(line).toContain('status=ERROR');
      expect(line).toContain('errorType=RecordGraphqlError');
      expect(line).toContain('errorCode=READ_LEAD:REJECTED');
      expect(line).toContain('retryCount=0/3');
      expect(line).toContain('logLineCount=0');

      // The behaviour under test is unchanged: still no retry persisted.
      expect(persistRetryCount).not.toHaveBeenCalled();
    });

    it('never emits the error message when it is free text', async () => {
      const execute = jest.fn().mockResolvedValue({
        status: 'ERROR',
        logs: '',
        error: {
          errorType: 'Error',
          errorMessage:
            'request to https://api.example.com/v1/KEY-SECRET failed for Sara Rezaei',
          stackTrace: [],
        },
      });
      const { service } = buildService(execute);

      await service.run({
        logicFunctionPayload,
        retryLimit: 3,
        persistRetryCount: jest.fn(),
      });

      const line = findWarning() ?? '';

      expect(line).toContain('errorCode=<redacted>');
      expect(line).not.toContain('KEY-SECRET');
      expect(line).not.toContain('example.com');
      expect(line).not.toContain('Sara');
    });

    it('never emits a payload, a token or a customer value', async () => {
      const execute = jest.fn().mockResolvedValue({
        status: 'ERROR',
        logs: 'boom',
        error: {
          errorType: 'Error',
          errorMessage: 'x',
          stackTrace: ['at secret(token=abc)'],
        },
      });
      const { service } = buildService(execute);

      await service.run({
        logicFunctionPayload: {
          ...logicFunctionPayload,
          payload: { personId: 'person-1', phone: '09120000000' },
          userId: 'user-1',
        },
        retryLimit: 3,
        persistRetryCount: jest.fn(),
      });

      const line = findWarning() ?? '';

      expect(line).not.toContain('person-1');
      expect(line).not.toContain('09120000000');
      expect(line).not.toContain('user-1');
      expect(line).not.toContain('token=abc');
      expect(line).toContain('logLineCount=1');
    });

    it('counts captured log lines without emitting their content', async () => {
      const execute = jest.fn().mockResolvedValue({
        status: 'ERROR',
        logs: 'line one\n\nline two\n',
        error: {
          errorType: 'Error',
          errorMessage: '',
          stackTrace: [],
        },
      });
      const { service } = buildService(execute);

      await service.run({
        logicFunctionPayload,
        retryLimit: 3,
        persistRetryCount: jest.fn(),
      });

      const line = findWarning() ?? '';

      expect(line).toContain('logLineCount=2');
      expect(line).not.toContain('line one');
    });

    it('does not warn on a successful execution', async () => {
      const execute = jest.fn().mockResolvedValue({
        status: 'SUCCESS',
        logs: '',
        data: {},
      });
      const { service } = buildService(execute);

      await service.run({
        logicFunctionPayload,
        retryLimit: 3,
        persistRetryCount: jest.fn(),
      });

      expect(findWarning()).toBeUndefined();
    });

    it('records a failure whose retries are exhausted', async () => {
      const execute = jest.fn().mockResolvedValue({
        status: 'ERROR',
        logs: '',
        error: {
          errorType: RETRYABLE_LOGIC_FUNCTION_ERROR_NAME,
          errorMessage: 'sandbox unavailable',
          stackTrace: [],
        },
      });
      const { service, persistRetryCount } = buildService(execute);

      await service.run({
        logicFunctionPayload: {
          ...logicFunctionPayload,
          applicationRetryCount: 3,
        },
        retryLimit: 3,
        persistRetryCount,
      });

      const line = findWarning() ?? '';

      // Retries exhausted: reported, and the retry count is NOT persisted again.
      expect(line).toContain('retryCount=3/3');
      expect(line).toContain('errorCode=<redacted>');
      expect(persistRetryCount).not.toHaveBeenCalled();
    });

    it('still throws for a retryable failure with attempts left', async () => {
      const execute = jest.fn().mockResolvedValue({
        status: 'ERROR',
        logs: '',
        error: {
          errorType: RETRYABLE_LOGIC_FUNCTION_ERROR_NAME,
          errorMessage: 'sandbox unavailable',
          stackTrace: [],
        },
      });
      const { service, persistRetryCount } = buildService(execute);

      await expect(
        service.run({
          logicFunctionPayload,
          retryLimit: 3,
          persistRetryCount,
        }),
      ).rejects.toThrow(RetryableLogicFunctionError);

      // The retry path is untouched: no discard warning, retry persisted.
      expect(findWarning()).toBeUndefined();
      expect(persistRetryCount).toHaveBeenCalledWith(1);
    });
  });
});
