import { addMinutes, format } from "date-fns";
import code from "./code";
import { CodeSample } from "./CodeSample";

export const CodeExample = ({
  example,
  apiKey,
}: {
  example: "curl" | "node-fetch-typescript";
  apiKey?: string;
}) => {
  return (
    <CodeSample
      code={code[example]
        .c({
          apiKey: apiKey || "<YOUR_API_KEY>",
          formattedDate: format(
            addMinutes(new Date(), 1),
            "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"
          ),
        })
        .trim()}
      copyToClipboardButton
      language="bash"
      legend={code[example].title}
    />
  );
};
