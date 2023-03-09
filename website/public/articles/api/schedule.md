# Schedule a trigger

A 'trigger' is a scheduled HTTP request.

Our api is designed for minimal changes to your existing code.
We chose to use headers to pass the information we need to schedule a trigger.
There are 3 headers you have to add to your request. All the rest of the request stays the same.

- Put the URL you want to hit in header `ttr-url`
  Change your request url to `https://api.timetriggers.io/schedule`
- Add the following headers to your request:
  - `ttr-api-key` : your Api Key (see your [Project Settings](https://timetriggers.io/projects))
  - `ttr-scheduled-at` : the moment we should schedule the request, in the format `yyyy-MM-dd'T'HH:mm:ss.SSSxxx`

That's it ! No need to change your method, body or anything else. We'll reply without any body, only with a header `ttr-trigger-id`

{% callout type="info" %}
We support simple operations on dates in the `ttr-scheduled-at` header.

You can add or subtract days, hours, minutes or seconds to the date. For example, if you want to schedule a trigger in 2 days, you can use:

`ttr-scheduled-at: 2023-01-01T00:00:00.000+01:00 | +2d`

This is useful when used with Zapier or IFTTT, where it's sometimes tricky to make operations on dates.
{% /callout %}

## Idempotency keys

If you want to schedule a trigger that is idempotent, you can add the header `ttr-trigger-key` with a value that will be used to identify the trigger. If you schedule a trigger with the same idempotency key, we'll return the same task id.

## Scheduling a trigger with a cron expression

This is not currently available. It's on the roadmap.
