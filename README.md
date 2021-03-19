# Pit Events Bot

Provides and an API for seeing upcoming events in pit. Is somewhat risky that the bot could get banned.

There is a running copy of this API at https://events.mcpqndq.dev.

Currently, only supports Microsoft accounts. This is a trivial fix if someone wants to make a PR.

## Setup

Make a `.env` file with these properties:
```

ENV=DEV or PROD
APIKEY=PitPanda API key
EMAIL=Minecraft Username or Email
PASSWORD=Minecraft password

```

If you use `ENV=DEV` It will just generate some fake events and not connect the mineflayer bot. 
