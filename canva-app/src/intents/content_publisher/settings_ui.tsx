import {
  Checkbox,
  FormField,
  Rows,
  Text,
  TextInput,
} from "@canva/app-ui-kit";
import type {
  PublishRefValidityState,
  RenderSettingsUiRequest,
} from "@canva/intents/content";
import { useCallback, useState } from "react";
import * as styles from "styles/components.css";
import type { PublishSettings } from "./types";

export const SettingsUi = ({
  updatePublishSettings,
}: RenderSettingsUiRequest) => {
  const [settings, setSettings] = useState<PublishSettings>({
    slug: "",
    allowDownload: false,
    allowPrint: false,
  });

  const setAndPropagateSettings = useCallback(
    (updatedSettings: PublishSettings) => {
      setSettings(updatedSettings);
      updatePublishSettings({
        publishRef: JSON.stringify(updatedSettings),
        validityState: validateSettings(updatedSettings),
      });
    },
    [updatePublishSettings],
  );

  return (
    <div className={styles.scrollContainer}>
      <Rows spacing="2u">
        <Text size="small" tone="tertiary">
          Create a tracked link for your design. Recipients can view the
          document and you can see who opened it.
        </Text>

        <FormField
          label="Custom slug (optional)"
          description="Leave blank for auto-generated slug"
          control={(props) => (
            <TextInput
              {...props}
              value={settings.slug}
              placeholder="my-proposal"
              onChange={(slug) => {
                setAndPropagateSettings({ ...settings, slug });
              }}
            />
          )}
        />

        <Rows spacing="1u">
          <Text size="small" variant="bold">
            Permissions
          </Text>
          <Checkbox
            label="Allow download"
            checked={settings.allowDownload}
            onChange={(_value, checked) => {
              setAndPropagateSettings({ ...settings, allowDownload: checked });
            }}
          />
          <Checkbox
            label="Allow print"
            checked={settings.allowPrint}
            onChange={(_value, checked) => {
              setAndPropagateSettings({ ...settings, allowPrint: checked });
            }}
          />
        </Rows>
      </Rows>
    </div>
  );
};

const validateSettings = (settings: PublishSettings): PublishRefValidityState => {
  // Slug format validation if provided
  if (settings.slug && !/^[a-z0-9-]*$/i.test(settings.slug)) {
    return "invalid_missing_required_fields";
  }
  return "valid";
};
