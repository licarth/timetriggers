---
title: Api
description: Api documentation for timetriggers.io
date: 2023-03-11
---

# Api

## Authentication

We use api keys to authenticate requests. You can find your api key in your [project settings](https://timetriggers.io/projects).

The API is available at `https://api.timetriggers.io/`

## Endpoints

There are 3 endpoints:

- [`{ANY METHOD} /schedule` - schedule a trigger](api/schedule)
- [`GET /cancel` - cancels a trigger](api/cancel)
- [`GET /reschedule` - reschedules a trigger](api/reschedule)
