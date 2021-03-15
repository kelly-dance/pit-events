# Pit Events Bot

Provides and an API for seeing upcoming events in pit. Is somewhat risky that the bot could get banned.

There is a running copy of this API at https://events.mcpqndq.dev.

Currently, only supports Microsoft accounts. This is a trivial fix if someone wants to make a PR.

## Setup

Make a `.env` file with these properties:
```
EMAIL=account username or email
PASSWORD=account password
APIKEY=hypixel api key
```

If you add `ENV=DEV` it will skip logging in and just generate some fake events.
