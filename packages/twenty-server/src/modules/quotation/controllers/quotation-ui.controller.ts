import {
  Body,
  Controller,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';

import { ApiPath } from 'twenty-shared/types';
import { isNonEmptyString } from 'twenty-shared/utils';

import { getWorkspaceAuthContext } from 'src/engine/core-modules/auth/storage/workspace-auth-context.storage';
import { AuthRestApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-rest-api-exception.filter';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { QuotationPdfService } from 'src/modules/quotation/services/quotation-pdf.service';
import { QuotationUiService } from 'src/modules/quotation/services/quotation-ui.service';
import { persianMessageForQuotationCode } from 'src/modules/quotation/utils/quotation-ui-messages.util';

type QuotationUiActionBody = {
  action?: unknown;
  quotationId?: unknown;
  toStatus?: unknown;
  version?: unknown;
};

const ALLOWED_ACTIONS = new Set([
  'get-lifecycle',
  'transition',
  'generate-pdf',
]);

@Controller(`${ApiPath.Rest}/quotation`)
@UseGuards(JwtAuthGuard, WorkspaceAuthGuard)
@UseFilters(AuthRestApiExceptionFilter)
export class QuotationUiController {
  constructor(
    private readonly quotationUiService: QuotationUiService,
    private readonly quotationPdfService: QuotationPdfService,
  ) {}

  @Post('actions')
  async actions(@Body() body: QuotationUiActionBody): Promise<unknown> {
    const action = typeof body.action === 'string' ? body.action : '';

    if (!ALLOWED_ACTIONS.has(action)) {
      return {
        success: false,
        code: 'INVALID_INPUT',
        message: persianMessageForQuotationCode('INVALID_INPUT'),
      };
    }

    const quotationId =
      typeof body.quotationId === 'string' ? body.quotationId.trim() : '';

    if (!isNonEmptyString(quotationId)) {
      return {
        success: false,
        code: 'INVALID_INPUT',
        message: persianMessageForQuotationCode('INVALID_INPUT'),
      };
    }

    const authContext = getWorkspaceAuthContext();

    try {
      if (action === 'get-lifecycle') {
        const lifecycle = await this.quotationUiService.getLifecycle({
          authContext,
          quotationId,
        });

        return { success: true, lifecycle };
      }

      if (action === 'transition') {
        const toStatus =
          typeof body.toStatus === 'string' ? body.toStatus.trim() : '';
        const version =
          typeof body.version === 'number'
            ? body.version
            : typeof body.version === 'string' && /^\d+$/.test(body.version)
              ? Number(body.version)
              : null;

        if (!isNonEmptyString(toStatus) || version === null) {
          return {
            success: false,
            code: 'INVALID_INPUT',
            message: persianMessageForQuotationCode('INVALID_INPUT'),
          };
        }

        const result = await this.quotationUiService.transition({
          authContext,
          quotationId,
          toStatus,
          version,
        });

        return { success: true, ...result };
      }

      const pdf = await this.quotationPdfService.generateQuotationPdf({
        authContext,
        quotationId,
      });

      return {
        success: true,
        fileName: pdf.fileName,
        pdfBase64: pdf.buffer.toString('base64'),
        // Generation uses the same ZWNJ-preserving stack as the S1 spike.
        // Browser pdf.js copy may still drop ZWNJ; MuPDF/Acrobat are fine.
        zwnjBrowserCopyLimitation: true,
        message: 'فایل PDF آمادهٔ دانلود است.',
      };
    } catch (error) {
      return this.quotationUiService.toPersianFailure(error);
    }
  }
}
