import { AppI18nProvider, initIntl } from "@canva/app-i18n-kit";
import { AppUiProvider } from "@canva/app-ui-kit";
import type {
  ContentPublisherIntent,
  GetPublishConfigurationResponse,
  PublishContentRequest,
  PublishContentResponse,
  RenderPreviewUiRequest,
  RenderSettingsUiRequest,
} from "@canva/intents/content";
import { createRoot } from "react-dom/client";
import "@canva/app-ui-kit/styles.css";
import { PreviewUi } from "./preview_ui";
import { SettingsUi } from "./settings_ui";
import type { PublishSettings } from "./types";

// TODO: Update this to your deployed Workers URL
const WORKER_BASE_URL = "https://send-canva-worker.brickstack.workers.dev";

const intl = initIntl();

function renderSettingsUi(request: RenderSettingsUiRequest) {
  const root = createRoot(document.getElementById("root") as Element);
  root.render(
    <AppI18nProvider>
      <AppUiProvider>
        <SettingsUi {...request} />
      </AppUiProvider>
    </AppI18nProvider>,
  );
}

function renderPreviewUi(request: RenderPreviewUiRequest) {
  const root = createRoot(document.getElementById("root") as Element);
  root.render(
    <AppI18nProvider>
      <AppUiProvider>
        <PreviewUi {...request} />
      </AppUiProvider>
    </AppI18nProvider>,
  );
}

async function getPublishConfiguration(): Promise<GetPublishConfigurationResponse> {
  return {
    status: "completed",
    outputTypes: [
      {
        id: "tracked-document",
        displayName: "Tracked Document",
        mediaSlots: [
          {
            id: "media",
            displayName: "Document",
            fileCount: { exact: 1 },
            accepts: {
              image: {
                format: "png",
                aspectRatio: { min: 0.5, max: 2 },
              },
            },
          },
        ],
      },
    ],
  };
}

async function publishContent(
  request: PublishContentRequest,
): Promise<PublishContentResponse> {
  // Parse the settings from publishRef
  const settings: PublishSettings = request.publishRef
    ? JSON.parse(request.publishRef)
    : { slug: "", allowDownload: false, allowPrint: false };

  // Get the exported media URL from Canva
  const mediaSlot = request.outputMedia?.find((m) => m.mediaSlotId === "media");
  const mediaFile = mediaSlot?.files?.[0];

  if (!mediaFile?.url) {
    return {
      status: "app_error",
      message: "No file was exported from Canva",
    };
  }

  // Use the slug as a title fallback, or "Untitled Document"
  const title = settings.slug || "Untitled Document";

  try {
    // Post to our Workers API
    const response = await fetch(`${WORKER_BASE_URL}/api/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileUrl: mediaFile.url,
        title,
        slug: settings.slug || undefined,
        allowDownload: settings.allowDownload,
        allowPrint: settings.allowPrint,
      }),
    });

    if (!response.ok) {
      return {
        status: "remote_request_failed",
      };
    }

    const result = await response.json() as {
      id: string;
      slug: string;
      viewUrl: string;
      statsUrl: string;
    };

    return {
      status: "completed",
      externalId: result.id,
      externalUrl: result.statsUrl,
    };
  } catch {
    return {
      status: "remote_request_failed",
    };
  }
}

const contentPublisher: ContentPublisherIntent = {
  renderSettingsUi,
  renderPreviewUi,
  getPublishConfiguration,
  publishContent,
};

export default contentPublisher;
