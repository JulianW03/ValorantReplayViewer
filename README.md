# Valorant Replay Viewer (VRV)

Allows you to download, share, and watch replays as if they were your own in Valorant's replay system.

> Currently in early development, expect bugs and missing features. The app is not yet feature complete and may be unstable.
> Please report any issues you encounter and feel free to leave feedback or suggestions in the project's issue tracker.

For technical help you can also join the [Discord](https://discord.com/invite/WgznctjTuj).

## Project Status 
As of [Patch 12.10](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-12-10/), Valorant now supports viewing replays from friends directly through the official replay system.

This is the significantly easier and more TOS-friendly approach for most users.

## Disclaimer

**VRV isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved 
in producing or managing Riot Games properties.**

Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.

VRV does not modify the Valorant game process, provide a competitive advantage, expose hidden information, or affect competitive integrity. 
Its functionality is limited to replay-related features and interactions with the Riot Client.

However, VRV is not an official Riot product and relies on undocumented APIs of the Riot Client and Valorant. As a result, 
its use may violate Riot Games’ Terms of Service.

**Use at your own risk**.

## Screenshots
### Recent Matches
<img width="1917" height="943" alt="grafik" src="https://github.com/user-attachments/assets/fdd76236-e99d-4056-bde0-d3779054a8e0" />

### Saved Replays
<img width="1913" height="940" alt="grafik" src="https://github.com/user-attachments/assets/a39dd7a1-aade-4813-b84a-37bccc784a26" />

### Replay Injection
<img width="1913" height="944" alt="grafik" src="https://github.com/user-attachments/assets/09d264d9-d56c-49ef-b0df-45193f7419a6" />

### Match Details
<img width="1911" height="943" alt="grafik" src="https://github.com/user-attachments/assets/59f6f093-d035-4edd-be1b-0f9297baf895" />

## More Information
<details>
  <summary>How to install</summary>

  <br>
  
  1. Download the [latest release](https://github.com/Julianw03/ValorantReplayViewer/releases/latest) from the project's releases page.
  2. Start ``ValorantReplayViewer.exe``
  3. Open ``http://127.0.0.1:3000/`` in the browser of your choice.
  
</details>
<details>
  <summary>How to use</summary>

  <br>
  
  A short walkthrough of the application's features and workflow can be found in the showcase video below.
  This video may not represent the latest state of the app:
  [Showcase Video](https://youtu.be/W_k5N2hS7fg)
</details>
<details>
  <summary>How It Works</summary>

  ### General Connection

  VRV connects to the local Riot Client and uses your session credentials to query Valorant endpoints and observe data exposed through the Riot Messaging Service (RMS).

  This allows the application to, for example:

  - Track your current gameflow state
  - Query replay metadata
  - Download replay files

  ### Replay loading
  Valorant normally prevents replay files from being renamed, replaced, or loaded arbitrarily. Replays that do not match the expected file are typically shown as unavailable or fail to load.

  Based on observed behavior, it appears that Valorant validates a replay file before entering the replay-loading process, but does not perform the same validation again immediately before consuming the file. The exact implementation is undocumented and this behavior has not been independently verified.

  VRV takes advantage of this behavior by monitoring gameflow events through RMS. Once the client transitions into the replay-loading state, VRV replaces the target replay file with the desired replay while preserving the expected file name and location.

  As a result, the replay system loads the replacement replay instead of the originally selected one.

  This approach does not require code injection, memory modification, or changes to the Valorant game process itself.

</details>
<details>
  <summary>Security Details</summary>

  <br>
  
  > **Only download VRV from the official release page.**

  This application connects to your local Riot Client and has access to your session credentials. A malicious build could steal your Riot Access Token and compromise your account.

  - Only run official releases from the project's release page.
  - Do not run modified builds or binaries you received from untrusted sources.
</details>
<details>
  <summary>Issues & Suggestions</summary>

  <br>

  Bug reports, feature requests, and general feedback are welcome.

  Please use GitHub's Issue Tracker for all bug reports, feature requests, and feedback.

  If you encounter an issue, please include as much information as possible:

  1. What you were trying to do
  2. What you expected to happen
  3. What actually happened
  4. Screenshots or error messages (if applicable)
  5. Your VRV version (available under Settings → Configuration)

  Before opening a new issue, please check whether a similar report already exists.
</details>
<details>
  <summary>FAQ</summary>
  
  ### Can I get banned?

  I am unsure.
  
  VRV uses undocumented Riot Client APIs and interacts with endpoints that are normally only accessed by Riot's official clients. As a result, its use may violate Riot Games' Terms of Service.
  VRV does not modify the Valorant game process, provide a competitive advantage, expose hidden information, or affect competitive integrity. Its functionality is limited to replay-related features and interactions with the Riot Client.
  Ultimately, any enforcement decisions are made by Riot Games, and use of VRV is at your own risk.

  ### Does VRV modify Valorant?

  No.
  
  VRV does not modify the game client or inject code into the game process.

  ### Can I watch old replays?

  Sometimes.

  VRV attempts to estimate replay compatibility based on the build version of the replay and the currently installed Valorant client.

  If the replay and client differ by a major or minor version, the UI will prevent the replay from being loaded. Replays from older patch versions within the same major/minor version are marked as Outdated and can still be selected.
  However, this compatibility check is only a best-effort estimate. Even if a replay is marked as playable, there is no guarantee that it will load successfully. Incompatible replays may fail to load or cause the game to crash while loading.
</details>
