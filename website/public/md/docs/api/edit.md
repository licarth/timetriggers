# Edit a trigger

Editing happens via the same endpoint as scheduling, but specifying either the trigger id via {% http_header %}ttr-trigger-id{% /http_header %} or a custom key via {% http_header %}ttr-custom-key{% /http_header %}.

By "editing", we mean editing anything in the trigger (not only its `scheduledAt` time). The trigger will be marked as `cancelled` and a new trigger will be created, with a new id, and erasing all existing data with the newly provided data.

## Use {% http_header %}ttr-trigger-id{% /http_header %} to re-schedule an existing trigger

You can simply use the trigger id to reschedule an existing trigger. Existing trigger will be marked as `cancelled` and a new trigger will be created, with a new {% http_header %}ttr-trigger-id{% /http_header %}

## Use {% http_header %}ttr-custom-key{% /http_header %} to re-schedule an existing trigger that has a custom key

If you initially provided a {% http_header %}ttr-custom-key{% /http_header %}, then any subsequent calls to `/schedule` specifying the same {% http_header %}ttr-custom-key{% /http_header %} will re-schedule the existing trigger, provided that it hasn't been already executed.
