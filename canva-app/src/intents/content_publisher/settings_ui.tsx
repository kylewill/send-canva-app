import { Rows, Text } from "@canva/app-ui-kit";
import type { RenderSettingsUiRequest } from "@canva/intents/content";
import { useEffect } from "react";
import * as styles from "styles/components.css";

const FEATURES = [
  "Know when it's viewed",
  "Capture leads with name, email & phone gates",
  "Identify your most engaged viewers",
  "Know what people read and what they skipped",
  "AI answers questions about your document",
];

export const SettingsUi = ({
  updatePublishSettings,
}: RenderSettingsUiRequest) => {
  useEffect(() => {
    updatePublishSettings({
      publishRef: JSON.stringify({}),
      validityState: "valid",
    });
  }, [updatePublishSettings]);

  return (
    <div className={styles.scrollContainer}>
      <Rows spacing="1u">
        <Text size="medium" variant="bold">
          Track this document
        </Text>
        {FEATURES.map((feature) => (
          <Text key={feature} size="small" tone="tertiary">
            ✓ {feature}
          </Text>
        ))}
      </Rows>
    </div>
  );
};
