# Tesla Passenger Player — video patch

This patch fixes two video-side issues:

1. JSMpeg is loaded from cdnjs instead of the previous jsDelivr URL.
2. The WebSocket video stream is sent as MPEG-TS + MPEG1 video, which is the
   stream format expected by current JSMpeg.

The fact that audio was playing proves the Railway server and YouTube audio
resolution were already working; the visible error `Can't find variable: JSMpeg`
was a browser-side player loading problem.
