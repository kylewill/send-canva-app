import { prepareContentPublisher } from "@canva/intents/content";
import { prepareDesignEditor } from "@canva/intents/design";
import contentPublisher from "./intents/content_publisher";

prepareDesignEditor({
  render: () => {
    // Design Editor intent is required as a base.
    // Our app's UI is handled by the Content Publisher intent.
  },
});

prepareContentPublisher(contentPublisher);
