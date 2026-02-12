import {
  Box,
  ImageCard,
  Placeholder,
  Rows,
  Text,
  TextPlaceholder,
} from "@canva/app-ui-kit";
import type { Preview, PreviewMedia } from "@canva/intents/content";
import * as styles from "../../../styles/preview_ui.css";
import type { PublishSettings } from "./types";

interface DocumentPreviewProps {
  previewMedia: PreviewMedia[] | undefined;
  settings: PublishSettings | undefined;
}

export const DocumentPreview = ({
  previewMedia,
  settings,
}: DocumentPreviewProps) => {
  const isLoading = !previewMedia;
  const slug = settings?.slug || "your-document";

  const previewWidth = 400 + 32 + 2;

  return (
    <div style={{ width: previewWidth }}>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        background="surface"
        borderRadius="large"
        padding="2u"
        border="standard"
      >
        <Rows spacing="2u">
          {/* Brand header */}
          <Box display="flex" alignItems="center">
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#E23D28",
                marginRight: 8,
              }}
            />
            <Text size="small" variant="bold" tone="tertiary">
              SEND
            </Text>
          </Box>

          {/* Document thumbnail */}
          <Box borderRadius="large" className={styles.imageContainer}>
            {isLoading ? (
              <div className={styles.imagePlaceholder}>
                <Placeholder shape="rectangle" />
              </div>
            ) : (
              <ImagePreview previewMedia={previewMedia} />
            )}
          </Box>

          {/* Link preview */}
          {isLoading ? (
            <div className={styles.textPlaceholder}>
              <TextPlaceholder size="medium" />
            </div>
          ) : (
            <Box
              background="neutralLow"
              borderRadius="standard"
              padding="1.5u"
            >
              <Text size="xsmall" tone="tertiary">
                send.co/view/{slug}
              </Text>
            </Box>
          )}

          {/* Settings summary */}
          <Box display="flex">
            <Text size="xsmall" tone="tertiary">
              {settings?.allowDownload ? "Download on" : "Download off"}
              {" · "}
              {settings?.allowPrint ? "Print on" : "Print off"}
            </Text>
          </Box>
        </Rows>
      </Box>
    </div>
  );
};

const ImagePreview = ({
  previewMedia,
}: {
  previewMedia: PreviewMedia[] | undefined;
}) => {
  const media = previewMedia?.find((m) => m.mediaSlotId === "media");

  if (!media?.previews.length) {
    return (
      <div className={styles.imagePlaceholder}>
        <Placeholder shape="rectangle" />
      </div>
    );
  }

  // Document previews come as kind: "document" with status: "thumbnail"
  // Image previews come as kind: "image" with status: "ready"
  const preview = media.previews.find(
    (p) =>
      (p.kind === "image" && p.status === "ready") ||
      (p.kind === "document" && p.status === "thumbnail"),
  ) as (Preview & { url?: string; thumbnailUrl?: string }) | undefined;

  const thumbnailUrl =
    (preview as any)?.thumbnailUrl || (preview as any)?.url;

  if (!thumbnailUrl) {
    return (
      <div className={styles.imagePlaceholder}>
        <Placeholder shape="rectangle" />
      </div>
    );
  }

  return (
    <div className={styles.image}>
      <ImageCard alt="Document preview" thumbnailUrl={thumbnailUrl} />
    </div>
  );
};
