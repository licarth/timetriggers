import { addMinutes } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import code from './code';
import { CodeSample } from './CodeSample';

export const CodeExample = ({
  example = 'curl',
  apiKey,
  date = new Date(),
}: {
  example: 'curl' | 'node-fetch-typescript';
  apiKey?: string;
  date: Date;
}) => {
  return (
    <CodeSample
      code={code[example]
        .c({
          apiKey: apiKey || '<YOUR_API_KEY>',
          formattedDate: formatInTimeZone(
            addMinutes(date, 1),
            'Z',
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
          ),
        })
        .trim()}
      copyToClipboardButton
      language="bash"
      legend={code[example].title}
    />
  );
};
