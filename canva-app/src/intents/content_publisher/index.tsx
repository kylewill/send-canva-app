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
import { auth } from "@canva/user";
import { createRoot } from "react-dom/client";
import "@canva/app-ui-kit/styles.css";
import { PreviewUi } from "./preview_ui";
import { SettingsUi } from "./settings_ui";

const SEND_UPLOAD_URL = "https://www.send.co/api/uploads/ingest-from-url";

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
              document: {
                format: "pdf_standard",
                size: "letter",
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
  // Get the exported media URL from Canva
  const mediaSlot = request.outputMedia?.find((m) => m.mediaSlotId === "media");
  const mediaFile = mediaSlot?.files?.[0];

  if (!mediaFile?.url) {
    return {
      status: "app_error",
      message: "No file was exported from Canva",
    };
  }

  try {
    const userToken = await auth.getCanvaUserToken();

    const response = await fetch(SEND_UPLOAD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileUrl: mediaFile.url,
        canvaUserToken: userToken,
      }),
    });

    if (!response.ok) {
      return {
        status: "remote_request_failed",
      };
    }

    const result = await response.json() as {
      url: string;
      shareId: string;
      linkId: string;
    };

    return {
      status: "completed",
      externalId: result.shareId,
      externalUrl: result.url,
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
