import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';

import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsDiscoveryHeroCard } from '@/settings/components/SettingsDiscoveryHeroCard';
import { SettingsWorkspaceBlocklistSection } from '@/settings/workspace/components/SettingsWorkspaceBlocklistSection';
import { SettingsWorkspaceEmailGroupSection } from '@/settings/workspace/components/SettingsWorkspaceEmailGroupSection';
import { SettingsWorkspaceEmailSyncSection } from '@/settings/workspace/components/SettingsWorkspaceEmailSyncSection';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { SettingsTabBar } from '@/settings/components/layout/SettingsTabBar';
import { useSettingsActiveTabId } from '@/settings/components/layout/useSettingsActiveTabId';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';
import { FeatureFlagKey, SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';
import { Section } from 'twenty-ui/components';
import {
  IconBrandWhatsapp,
  IconMail,
  IconMailX,
  IconMessage,
  IconPhone,
} from 'twenty-ui/icon';
import coverDark from '~/pages/settings/communications/assets/cover-dark.png';
import coverLight from '~/pages/settings/communications/assets/cover-light.png';
import { SettingsCard } from '@/settings/components/SettingsCard';
import { useContext } from 'react';
import { ThemeContext, themeCssVariables } from 'twenty-ui/theme-constants';
import { useNavigateSettings } from '~/hooks/useNavigateSettings';
import { SettingsWorkspaceCommunicationsSmsTab } from '~/pages/settings/communications/SettingsWorkspaceCommunicationsSmsTab';

const COMMUNICATIONS_TABS_INSTANCE_ID = 'settings-communications-tabs';

const SMS_TAB_ID = 'sms';

const StyledCardsColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
`;

export const SettingsWorkspaceCommunications = () => {
  const { theme } = useContext(ThemeContext);

  const { t } = useLingui();

  const navigateSettings = useNavigateSettings();

  const isMessageCampaignFeatureEnabled = useIsFeatureEnabled(
    FeatureFlagKey.IS_MESSAGE_CAMPAIGN_ENABLED,
  );

  const tabs = [
    { id: 'emails', title: t`Emails`, Icon: IconMail },
    { id: SMS_TAB_ID, title: t`SMS system`, Icon: IconMessage },
    {
      id: 'whatsapp',
      title: t`Whatsapp`,
      Icon: IconBrandWhatsapp,
      disabled: true,
      pill: t`Soon`,
    },
    {
      id: 'calls',
      title: t`Calls`,
      Icon: IconPhone,
      disabled: true,
      pill: t`Soon`,
    },
  ];

  const activeTabId = useSettingsActiveTabId(
    COMMUNICATIONS_TABS_INSTANCE_ID,
    tabs.filter((tab) => !tab.disabled).map((tab) => tab.id),
  );

  const renderActiveTabContent = () => {
    switch (activeTabId) {
      case SMS_TAB_ID:
        return <SettingsWorkspaceCommunicationsSmsTab />;
      default:
        return (
          <>
            <SettingsWorkspaceEmailGroupSection />
            {isMessageCampaignFeatureEnabled && (
              <Section.Root>
                <Section.Header
                  title={t`Unsubscribe`}
                  description={t`Manage unsubscribers, opt-out topics, and the page recipients see`}
                />
                <StyledCardsColumn>
                  <SettingsCard
                    Icon={
                      <IconMailX
                        size={theme.icon.size.lg}
                        stroke={theme.icon.stroke.md}
                      />
                    }
                    title={t`Manage unsubscribe`}
                    onClick={() => navigateSettings(SettingsPath.Unsubscribe)}
                  />
                </StyledCardsColumn>
              </Section.Root>
            )}
            <SettingsWorkspaceEmailSyncSection />
            <SettingsWorkspaceBlocklistSection />
          </>
        );
    }
  };

  return (
    <SettingsPageLayout
      title={t`Communication`}
      secondaryBar={
        <SettingsTabBar
          aria-label={t`Workspace communications`}
          tabs={tabs}
          componentInstanceId={COMMUNICATIONS_TABS_INSTANCE_ID}
        />
      }
      links={[
        {
          children: t`Workspace`,
          href: getSettingsPath(SettingsPath.General),
        },
        { children: t`Communication` },
      ]}
    >
      <SettingsPageContainer>
        <Section.Root>
          <SettingsDiscoveryHeroCard
            lightSrc={coverLight}
            darkSrc={coverDark}
            instanceIdPrefix="settings-communications-hero"
            tabs={[]}
          />
        </Section.Root>
        {renderActiveTabContent()}
      </SettingsPageContainer>
    </SettingsPageLayout>
  );
};
