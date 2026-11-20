## Changelog Version 0.11.0
### Import Flows
You can now see why / how a replay was imported.
Currently supported are:
- "Downloaded manually": You triggered the download manually
- "Auto-archived": The match data was downloaded due to archiving rules
- "Injection Placeholder": The Match data was downloaded to facilitate the replay injection
- "Uploaded": The file was manually uploaded into the application

### Auto Archive
You can now automatically archive matches you have played based on the following rules:
- "All matches": All matches that finish while VRV is connected.
- "Only selected": All matches that are within the selected set of queue IDs
- "All except selected": All matches that are NOT within the selected set of queueIDs
- "None": None, effectively disables this feature

These options can be set for "stats" (meaning the metadata json file) or "replays" (meaning the .vrf replays) independently.

This feature is disabled by default, so if you dont want to use it you dont need to change anything!
