import { UseFilters, UseGuards, UsePipes } from '@nestjs/common';
import { Args, Context, Query } from '@nestjs/graphql';
import { SOURCE_LOCALE } from 'twenty-shared/translations';

import { MetadataResolver } from 'src/engine/api/graphql/graphql-config/decorators/metadata-resolver.decorator';
import { getWorkspaceAuthContext } from 'src/engine/core-modules/auth/storage/workspace-auth-context.storage';
import { ResolverValidationPipe } from 'src/engine/core-modules/graphql/pipes/resolver-validation.pipe';
import { type I18nContext } from 'src/engine/core-modules/i18n/types/i18n-context.type';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { PieChartDataInput } from 'src/modules/dashboard/chart-data/dtos/inputs/pie-chart-data.input';
import { PieChartDataDTO } from 'src/modules/dashboard/chart-data/dtos/pie-chart-data.dto';
import { ChartDataGraphqlApiExceptionFilter } from 'src/modules/dashboard/chart-data/filters/chart-data-graphql-api-exception.filter';
import { PieChartDataService } from 'src/modules/dashboard/chart-data/services/pie-chart-data.service';

@MetadataResolver()
@UseFilters(ChartDataGraphqlApiExceptionFilter)
@UseGuards(WorkspaceAuthGuard)
@UsePipes(ResolverValidationPipe)
export class PieChartDataResolver {
  constructor(private readonly pieChartDataService: PieChartDataService) {}

  @Query(() => PieChartDataDTO)
  @UseGuards(NoPermissionGuard)
  async pieChartData(
    @Args('input') input: PieChartDataInput,
    @Context() context: I18nContext,
  ): Promise<PieChartDataDTO> {
    const authContext = getWorkspaceAuthContext();

    return this.pieChartDataService.getPieChartData({
      objectMetadataId: input.objectMetadataId,
      configuration: input.configuration,
      workspaceId: authContext.workspace.id,
      authContext,
      locale: context.req.locale ?? SOURCE_LOCALE,
    });
  }
}
