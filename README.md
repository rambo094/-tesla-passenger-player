# Tesla Passenger Player

Canvas/WebSocket passenger video player proof of concept for Tesla's browser.

## YouTube extraction

The container installs current `yt-dlp[default]`, which includes `yt-dlp-ejs`, and Node 22.
The server enables the Node JavaScript runtime for yt-dlp's YouTube extraction.

## Important

YouTube may still reject requests from cloud-provider IPs with HTTP 429/bot checks.
This project does not bypass authentication or access controls. If YouTube blocks the
Railway IP, a different permitted video source or authenticated approach may be needed.

This is a proof of concept. Tesla firmware/browser behavior may still restrict fullscreen
or playback while the vehicle is moving. Use video only for passengers and keep the
driver's attention on the road.

## Format selection

The resolver uses `bv*+ba/b` rather than requiring MP4/M4A. This allows yt-dlp to
choose the best available video/audio streams for videos whose available containers
do not include a pre-merged MP4.
