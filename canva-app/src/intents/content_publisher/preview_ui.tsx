import type { OutputType, PreviewMedia } from "@canva/intents/content";
import { useEffect } from "react";

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
  useEffect(() => {
    const dispose = registerOnPreviewChange(() => {});
    return dispose;
  }, [registerOnPreviewChange]);

  return null;
};
