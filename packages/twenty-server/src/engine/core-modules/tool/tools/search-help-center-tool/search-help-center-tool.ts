import { Injectable } from '@nestjs/common';

import {
  searchHelpArticles,
  HELP_ARTICLES,
} from 'twenty-shared/constants';

import { SearchHelpCenterInputZodSchema } from 'src/engine/core-modules/tool/tools/search-help-center-tool/search-help-center-tool.schema';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

/**
 * Searches the PRODUCT'S OWN help centre.
 *
 * It reads the same module the `/help` pages render, so the assistant and the UI
 * can never disagree about which articles exist or what they say. There is no
 * HTTP client, no retry, no API key and no fallback: the content is compiled into
 * this build, so the search works with the network entirely unavailable and
 * cannot leak a query to a third party.
 *
 * This deliberately replaces the previous implementation, which POSTed to
 * `twenty-help-search.com` and, when Mintlify credentials were configured, to
 * `api-dsc.mintlify.com`. Those settings may still exist in a workspace; they are
 * now unused, and a stale key can never cause an outbound request.
 */
@Injectable()
export class SearchHelpCenterTool implements Tool {
  description =
    "Search this application's built-in help centre (Persian) to find information about message templates: creating a template, editing and saving, source entities and variables, preview and save errors.";
  inputSchema = SearchHelpCenterInputZodSchema;

  async execute(
    parameters: ToolInput,
    _context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const query =
      typeof parameters.query === 'string' ? parameters.query : '';

    try {
      const results = searchHelpArticles(query);

      // An empty query BROWSES the help centre. Reported as success with the full
      // list, because "show me the help" is a valid request, not an error.
      if (query.trim().length === 0) {
        return {
          success: true,
          message: `Listing all ${results.length} help articles`,
          result: results,
        };
      }

      if (results.length === 0) {
        // A successful, empty result. The caller phrases "nothing found"; this
        // layer does not invent an article or fall back to a remote search.
        return {
          success: true,
          message: `No help articles found for "${query}"`,
          result: [],
        };
      }

      return {
        success: true,
        message: `Found ${results.length} help article${results.length === 1 ? '' : 's'} for "${query}"`,
        result: results,
      };
    } catch {
      // The search is local and pure, so this is only reachable if the tool is
      // called with a pathological input. Reported with a stable message: no
      // exception text, no path, no internal detail.
      const articleCount = Array.isArray(HELP_ARTICLES)
        ? HELP_ARTICLES.length
        : 0;

      return {
        success: false,
        message: `Failed to search the help centre for "${query}"`,
        error: `The built-in help centre could not be searched (${articleCount} articles are available).`,
      };
    }
  }
}
