import { defineFrontComponent } from 'twenty-sdk/define';

import { TemplateEditor } from 'src/components/template-editor';
import { MESSAGE_TEMPLATE_VARIABLE_GUIDE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export { insertTokenIntoBody } from 'src/components/template-editor';

export default defineFrontComponent({
  universalIdentifier:
    MESSAGE_TEMPLATE_VARIABLE_GUIDE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'template-variable-guide',
  description: 'Shared inline template editor on the native record page.',
  component: TemplateEditor,
});
