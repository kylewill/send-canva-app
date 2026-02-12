import { Box, Rows, Text } from "@canva/app-ui-kit";
import type { OutputType, PreviewMedia } from "@canva/intents/content";
import { useEffect, useState } from "react";
import * as styles from "../../../styles/preview_ui.css";
import { DocumentPreview } from "./post_preview";
import { parsePublishSettings } from "./types";

interface PreviewUiProps {
  registerOnPreviewChange: (
    callback: (opts: {
      previewMedia: PreviewMedia[];
      outputType: OutputType;
      publishRef?: string;
    }) => void,
  ) => () => void;
}

export const PreviewUi = ({ registerOnPreviewChange }: PreviewUiProps) => {
  const [previewData, setPreviewData] = useState<{
    previewMedia: PreviewMedia[];
    outputType: OutputType;
    publishRef?: string;
  } | null>(null);

  useEffect(() => {
    const dispose = registerOnPreviewChange((data) => {
      setPreviewData(data);
    });
    return dispose;
  }, [registerOnPreviewChange]);

  const { previewMedia, publishRef } = previewData ?? {};
  const publishSettings = parsePublishSettings(publishRef);

  return (
    <Box
      className={styles.container}
      display="flex"
      alignItems="center"
      justifyContent="center"
      flexDirection="column"
      width="full"
      height="full"
    >
      <DocumentPreview
        previewMedia={previewMedia}
        settings={publishSettings}
      />
    </Box>
  );
};
