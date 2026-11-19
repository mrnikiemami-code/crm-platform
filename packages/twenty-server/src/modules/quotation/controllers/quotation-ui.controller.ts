import {
  Body,
  Controller,
  Headers,
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
import { QuotationCustomerLinkService } from 'src/modules/quotation/services/quotation-customer-link.service';
import { QuotationPdfService } from 'src/modules/quotation/services/quotation-pdf.service';
import { QuotationShareService } from 'src/modules/quotation/services/quotation-share.service';
import { QuotationUiService } from 'src/modules/quotation/services/quotation-ui.service';
import { persianMessageForQuotationCode } from 'src/modules/quotation/utils/quotation-ui-messages.util';

type QuotationUiActionBody = {
  action?: unknown;
  quotationId?: unknown;
  toStatus?: unknown;
  version?: unknown;
  linkId?: unknown;
  ttlHours?: unknown;
  channel?: unknown;
  chatId?: unknown;
};

const ALLOWED_ACTIONS = new Set([
  'get-lifecycle',
  'transition',
  'generate-pdf',
  'create-customer-link',
  'revoke-customer-link',
  'share-quotation',
]);

@Controller(`${ApiPath.Rest}/quotation`)
@UseGuards(JwtAuthGuard, WorkspaceAuthGuard)
@UseFilters(AuthRestApiExceptionFilter)
export class QuotationUiController {
  constructor(
    private readonly quotationUiService: QuotationUiService,
    private readonly quotationPdfService: QuotationPdfService,
    private readonly quotationCustomerLinkService: QuotationCustomerLinkService,
    private readonly quotationShareService: QuotationShareService,
  ) {}

  @Post('actions')
  async actions(
    @Body() body: QuotationUiActionBody,
    @Headers('authorization') authorizationHeader?: string,
  ): Promise<unknown> {
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

      if (action === 'create-customer-link') {
        const ttlHours =
          typeof body.ttlHours === 'number' && Number.isFinite(body.ttlHours)
            ? body.ttlHours
            : undefined;
        const created =
          await this.quotationCustomerLinkService.createCustomerLink({
            authContext,
            quotationId,
            ttlHours,
          });

        return { success: true, ...created };
      }

      if (action === 'revoke-customer-link') {
        const linkId =
          typeof body.linkId === 'string' ? body.linkId.trim() : '';

        if (!isNonEmptyString(linkId)) {
          return {
            success: false,
            code: 'INVALID_INPUT',
            message: persianMessageForQuotationCode('INVALID_INPUT'),
          };
        }

        const revoked =
          await this.quotationCustomerLinkService.revokeCustomerLink({
            authContext,
            quotationId,
            linkId,
          });

        return { success: true, ...revoked };
      }

      if (action === 'share-quotation') {
        const channel =
          typeof body.channel === 'string' ? body.channel.trim() : '';
        const chatId =
          typeof body.chatId === 'string' ? body.chatId.trim() : undefined;
        const ttlHours =
          typeof body.ttlHours === 'number' && Number.isFinite(body.ttlHours)
            ? body.ttlHours
            : undefined;

        if (!isNonEmptyString(channel)) {
          return {
            success: false,
            code: 'INVALID_INPUT',
            message: persianMessageForQuotationCode('INVALID_INPUT'),
          };
        }

        const shared = await this.quotationShareService.shareQuotation({
          authContext,
          quotationId,
          channel,
          ttlHours,
          chatId,
          authorizationHeader:
            typeof authorizationHeader === 'string'
              ? authorizationHeader
              : null,
        });

        return { success: true, ...shared };
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
