import type { CodeArgs } from './CodeArgs';

export default {
  curl: {
    c: ({ apiKey, formattedDate }: CodeArgs) => {
      return `
curl \\
  -H "X-TimeTriggers-Url: https://your-domain.com/endpoint" \\
  -H "Content-type: application/json" \\
  -X PUT \\
  -d '{
    "hello": "world"
  }' \\
  -H "X-TimeTriggers-At: ${formattedDate}" \\
  -H "X-TimeTriggers-Key: ${apiKey}" \\
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
    "X-TimeTriggers-Key": "${apiKey}",   // your API key
    "X-TimeTriggers-Url": "https://yourdomain.com/endpoint",    // The url to call
    "X-TimeTriggers-At": "${formattedDate}",       // 1 minute from now
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
