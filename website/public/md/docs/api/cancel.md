# Cancel a trigger

### Status codes

| Status code                            | Possible explanation                                                                                             |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| {% status_code %}200{% /status_code %} | Your trigger has been cancelled                                                                                  |
| {% status_code %}400{% /status_code %} | Bad request. See {% http_header %}ttr-error{% /http_header %} for details                                        |
| {% status_code %}401{% /status_code %} | Make sure your api key is correct (in {% http_header %}ttr-api-key{% /http_header %})                            |
| {% status_code %}404{% /status_code %} | Either could not find your project or your trigger, see {% http_header %}ttr-error{% /http_header %} for details |
| {% status_code %}410{% /status_code %} | Your job is not in 'registered' state anymore. It was either already cancelled or executed.                      |
