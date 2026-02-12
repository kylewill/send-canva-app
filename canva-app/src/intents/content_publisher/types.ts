export interface PublishSettings {
  slug: string;
  allowDownload: boolean;
  allowPrint: boolean;
}

export function parsePublishSettings(
  publishRef?: string,
): PublishSettings | undefined {
  if (!publishRef) return undefined;

  try {
    return JSON.parse(publishRef) as PublishSettings;
  } catch {
    return undefined;
  }
}
