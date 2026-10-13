## Changelog Version 0.10.0
### Security Changes
- Bunch of hardening to Origin checks.
- Now strictly bound to ``127.0.0.1`` / localhost. This was a major screw up on my behalf before. Sorry!

### Update Checks
- The app will now periodically check against the GitHub repository for updates and allow you to easily download a newer
version.

### App Changes
- The app now runs without a visible console and logs into a file.
- If you still want the "console" feel you can start the app via cmd or PowerShell running: ``.\ValorantReplayViewer.exe``
in the directory of the executable. This will behave similar to the previous console-bound executables.
- You can still shutdown the app via the "Power" buttons in the UI.
- The app now also has an icon.

### Logging
- Log files can be found under ``%LOCALAPPDATA%\ValorantReplayViewer\logs``

### Performance Stats
- The Versus Tab shows a simple summary of the performance stats for each player.