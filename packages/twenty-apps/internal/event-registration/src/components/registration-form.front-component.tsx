import { defineFrontComponent } from 'twenty-sdk/define';

import { RegistrationForm } from 'src/components/registration-form';
import { REGISTRATION_FORM_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineFrontComponent({
  universalIdentifier: REGISTRATION_FORM_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'event-registration-form',
  description:
    'The shared registration form, opened from a lead or a sales interaction record.',
  component: RegistrationForm,
});
