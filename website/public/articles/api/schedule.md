# Schedule a trigger

A 'trigger' is a scheduled HTTP request.

## Headers

Our api is designed for minimal changes to your existing code / way of triggering HTTP requests. **It heavily relies on HTTP headers**.

Think about timetriggers.io as a proxy that will repeat the request for you, at the scheduled time. We will do a `PUT` request if you send us a `PUT` request, a `HEAD` request if you send us a `HEAD` request, etc.

We transparently pass any headers you set on your request (except headers prefixed with `ttr-`). See below.

### `ttr-` prefixed headers

Headers prefixed with `ttr-` are used to authenticate against our service, and to pass scheduling options for your request. See the [Request](#request) and [Response](#response) sections for more details.

## Request

There are **3 headers** you have to add to your original request to schedule it via TimeTriggers.

These are {% http_header %}ttr-url{% /http_header %}, {% http_header %}ttr-api-key{% /http_header %} and {% http_header %}ttr-scheduled-at{% /http_header %}.

As you'll point your HTTP request to our API endpoint (`https://api.timetriggers.io/schedule`), you'll have to tell us the ultimate URL you want to hit. This is the value of the {% http_header %}ttr-url{% /http_header %} header.

Finally, add the following headers to your request:

- {% http_header %}ttr-api-key{% /http_header %} : your Api Key (see your [Project Settings](https://timetriggers.io/projects))
- {% http_header %}ttr-scheduled-at{% /http_header %} : the moment we should execute the request, in an [ISO-8601-compliant](https://en.wikipedia.org/wiki/ISO_8601) format.
  It's also possible to use `now` as a value, combined with [operations on dates](#operations-on-ttr-scheduled-at) like `now | add 2d`.

### Request headers

There are other headers you can add to your request, but they are optional. Here're a recap of all the `ttr-` headers we support:

| Header                                              | Example                            | Description                                                                                                     |
| --------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| {% http_header %}ttr-url{% /http_header %}          | `https://my-domain.com`            | The URL you want to hit                                                                                         |
| {% http_header %}ttr-api-key{% /http_header %}      | `F4nzMW7aBXfb3yeHTcz8cbD3pvtmPTHa` |                                                                                                                 |
| {% http_header %}ttr-scheduled-at{% /http_header %} | `2024-02-23T20:10:00+0100`         | The date at which the trigger is scheduled, in an ISO-8601-compliant format                                     |
| {% http_header %}ttr-custom-key{% /http_header %}   | `my-customer-id:billing:2023-03`   | A custom key for your trigger, for idempotency or ease-of-use. See the [dedicated section](#custom-trigger-key) |

That's it ! No need to change your method, body or anything else.

## Response

We'll reply without any body, only with headers starting with prefix `ttr-`. This is to support all HTTP methods, including `HEAD`, which is not supposed to return a body.

### Successful response

The headers we'll return are:

| Header                                                       | Example                | Description                                                                  |
| ------------------------------------------------------------ | ---------------------- | ---------------------------------------------------------------------------- |
| {% http_header %}ttr-trigger-id{% /http_header %}            | `w2konzx5604z3v9x`     | A cross-project unique id of the trigger we just scheduled                   |
| {% http_header %}ttr-scheduled-at{% /http_header %}          | `2023-03-09T18:00:00Z` | The date at which the trigger is scheduled (at the nearest second)           |
| {% http_header %}ttr-month-quota-remaining{% /http_header %} | `455`                  | The number of triggers remaining in your plan for the current calendar month |

### Status codes

| Status code                            | Possible explanation                                                                                                                                                                                                                               |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| {% status_code %}200{% /status_code %} | Your trigger has been overwritten. This happens when you set some {% http_header %}ttr-custom-key{% /http_header %} and have `upsert` in your list of {% http_header %}ttr-flags{% /http_header %}.                                                |
| {% status_code %}201{% /status_code %} | Your trigger has been scheduled                                                                                                                                                                                                                    |
| {% status_code %}400{% /status_code %} | See {% http_header %}ttr-error{% /http_header %} ([section below](#error-headers)) for details                                                                                                                                                     |
| {% status_code %}401{% /status_code %} | Make sure your api key is correct (in {% http_header %}ttr-api-key{% /http_header %})                                                                                                                                                              |
| {% status_code %}402{% /status_code %} | Out of quota or billing disabled                                                                                                                                                                                                                   |
| {% status_code %}409{% /status_code %} | You probably used a key in {% http_header %}ttr-custom-key{% /http_header %} that's already existing. If this is intentional, and you want to overwrite that job, then you can always set {% http_header %}ttr-flags{% /http_header %} to `upsert` |
| {% status_code %}429{% /status_code %} | You've hit our API rate limit. Please send `/schedule` requests at a lower rate. We have a limit around {% sup %}100{% /sup %}/{% sub %}second{% /sub %}                                                                                           |

### Error response

#### Error Headers

| Header                                       | Example                 | Description                        |
| -------------------------------------------- | ----------------------- | ---------------------------------- |
| {% http_header %}ttr-error{% /http_header %} | `Monthly quota reached` | A (hopefully) useful error message |

# Advanced Usage

## Operations on {% http_header %}ttr-scheduled-at{% /http_header %}

We support simple operations on dates in the {% http_header %}ttr-scheduled-at{% /http_header %} header.

You can add or subtract days, hours, minutes or seconds to the date.

| When to schedule           | Header Value                                                          |
| -------------------------- | --------------------------------------------------------------------- |
| 2 days before a given date | `2023-01-01T20:00:00Z                                     \| add -2d` |
| 2 days from now            | `now \| add 2d`                                                       |

This is useful when used with Zapier or IFTTT, where it's sometimes tricky to make operations on dates.

### Try it out

{% date_functions_calculator/ %}

## Custom trigger keys

If you want to schedule a trigger that is idempotent, you can add the header {% http_header %}ttr-custom-key{% /http_header %} with a value that will be used to identify the trigger. If you schedule a trigger with the same idempotency key, we'll return the same task id.

## Scheduling a trigger with a cron expression

This is not currently available. It's on the roadmap.
