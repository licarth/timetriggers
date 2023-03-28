import type { LoaderFunction } from '@remix-run/server-runtime';
import { redirect } from '@remix-run/server-runtime';

export const loader: LoaderFunction = ({ request }) => {
  // Get current location
  const url = new URL(request.url);
  const params = new URLSearchParams(url.search);

  return redirect(`api_keys?${params.toString()}`);
};
