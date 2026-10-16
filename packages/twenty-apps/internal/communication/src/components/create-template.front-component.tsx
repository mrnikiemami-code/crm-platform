import { defineFrontComponent } from 'twenty-sdk/define';

import { TemplateEditor } from 'src/components/template-editor';
import { CREATE_TEMPLATE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const CreateTemplate = () => <TemplateEditor mode="create" />;

export default defineFrontComponent({
  universalIdentifier: CREATE_TEMPLATE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'create-message-template',
  description:
    'The shared template editor, with preview before the first save.',
  component: CreateTemplate,
});
