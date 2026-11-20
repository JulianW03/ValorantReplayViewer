## Changelog Version 0.11.0
### Import Flows
You can now see why/how a replay was imported.

Currently supported import reasons are:

- "Downloaded manually": You triggered the download manually
- "Auto-archived": The match data was downloaded due to archiving rules.
- "Injection Placeholder": The match data was downloaded to facilitate replay injection.
- "Uploaded": The file was manually uploaded into the application.

### Auto Archive
You can now automatically archive matches you have played based on the following rules:
- "All matches": All matches that finish while VRV is connected.
- "Only selected": All matches whose queue IDs are included in the selected set.
- "All except selected": All matches whose queue IDs are NOT included in the selected set.
- "None": No matches are archived. This effectively disables the feature.

These options can be configured independently for "stats" (meaning the metadata JSON file) and "replays" (meaning the .vrf replay files).

This feature is disabled by default, so if you don't want to use it, you don't need to change anything!