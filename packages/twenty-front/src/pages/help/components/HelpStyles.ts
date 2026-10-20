import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

/**
 * Layout shell for the in-app help centre.
 *
 * Built from the same tokens the rest of the product uses (`themeCssVariables`)
 * so it inherits light/dark and RTL without a new UI kit or a new dependency.
 *
 * `direction: rtl` is set on the shell rather than on each block: the help
 * content is Persian, and an RTL container is what makes lists, bullets and
 * punctuation align the way a Persian reader expects. Latin tokens (URLs, code)
 * are forced LTR locally where they appear.
 */
export const StyledHelpContainer = styled.div`
  box-sizing: border-box;
  direction: rtl;
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  height: 100%;
  margin: 0 auto;
  max-width: 780px;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[6]} ${themeCssVariables.spacing[6]};
  width: 100%;
`;

export const StyledHelpHeader = styled.header`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
`;

export const StyledHelpTitle = styled.h1`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.xl};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin: 0;
`;

export const StyledHelpSubtitle = styled.p`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.md};
  line-height: 1.7;
  margin: 0;
`;

export const StyledHelpSearchRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
`;

export const StyledHelpSearchInput = styled.input`
  background: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.primary};
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.md};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  width: 100%;

  &:focus {
    border-color: ${themeCssVariables.color.blue};
    outline: none;
  }
`;

export const StyledHelpList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  list-style: none;
  margin: 0;
  padding: 0;
`;

export const StyledHelpCard = styled.li`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
`;

export const StyledHelpCardLink = styled.a`
  color: ${themeCssVariables.font.color.tertiary};
  cursor: pointer;
  display: block;
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

export const StyledHelpExcerpt = styled.p`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.8;
  margin: ${themeCssVariables.spacing[1]} 0 0;
`;

export const StyledHelpParagraph = styled.p`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  line-height: 2;
  margin: 0 0 ${themeCssVariables.spacing[3]};
`;

export const StyledHelpMuted = styled.p`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.8;
  margin: 0;
`;

export const StyledHelpBackRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

/**
 * A back link. Kept as an anchor (not a router `Link`) so this module does not
 * need a router import; the caller intercepts the click and navigates, which
 * keeps the page usable in tests and in any router.
 */
export const StyledHelpBackLink = styled.a`
  color: ${themeCssVariables.font.color.tertiary};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.sm};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;
