import type { CodeArgs } from './CodeArgs';

export default {
  curl: {
    c: ({ apiKey, formattedDate }: CodeArgs) => {
      return `
curl \\
  -H "ttr-url: https://your-domain.com/endpoint" \\
  -H "Content-type: application/json" \\
  -X PUT \\
  -d '{
    "hello": "world"
  }' \\
  -H "ttr-scheduled-at: ${formattedDate}" \\
  -H "ttr-api-key: ${apiKey}" \\
  'https://api.timetriggers.io/schedule'
  `;
      // # ⬆ Everything above is your original request, let's do a PUT on ⬆
      // # ⬇ Everything below is the TimeTriggers request ⬇
    },
    title: (
      <>
        Usage with <code>curl</code>
      </>
    ),
  },

  'node-fetch-typescript': {
    c: ({ apiKey, formattedDate }: CodeArgs) => {
      return `
fetch("https://api.timetriggers.io/schedule", {
  method: "POST",
  headers: {
    "ttr-api-key": "${apiKey}",   // your API key
    "ttr-url": "https://yourdomain.com/endpoint",    // The url to call
    "ttr-scheduled-at": "${formattedDate}",       // 1 minute from now
  },
});
  `;
    },
    title: (
      <>
        Usage with <code>fetch</code> in Node.js
      </>
    ),
  },
};
