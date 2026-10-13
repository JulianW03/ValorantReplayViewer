## Changelog Version 0.10.0
### Security Changes
- Bunch of hardening to Origin checks.
- Now strictly bound to ``127.0.0.1`` / localhost. This was a major screw up on my behalf before.
Although it did not allow for access of Riot Credentials it allowed for access of the VRV API in the local network you were in.
Sorry!

### Update Checks
- The app will now periodically check against the GitHub repository for updates and allow you to easily download a newer
version.
- You will now also be able to see some details about the new version in an extra tab for it.

### App Changes
- The app now also has an icon.
- The app now runs without a visible console.
- If you still want the "console" feel you can start the app via cmd or PowerShell running: ``.\ValorantReplayViewer.exe``
in the directory of the executable. This will behave similar to the previous console-bound executables.
- You can still shutdown the app via the "Power" buttons in the UI.

### Logging
- Log files can be found under ``%LOCALAPPDATA%\ValorantReplayViewer\logs``

### Performance Stats
- The Versus Tab shows a simple summary of the performance stats for each player. 

*I am still not that happy with how this currently looks as its just a bunch of data thrown together, maybe I will come 
up with a better way of displaying it in the future*
