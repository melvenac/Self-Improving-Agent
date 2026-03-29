# YouTube Transcript

Transcribe a YouTube video, index it in the sandbox, and offer to save.

## Instructions

The user provided this YouTube URL: $ARGUMENTS

1. **Extract the video ID** from the URL (the `v=` parameter or the path after `youtu.be/`)

2. **Fetch the transcript** via ctx_execute using the locally installed python package:
```
mcp__plugin_context-mode_context-mode__ctx_execute(
  language: "shell",
  code: '/c/Python312/python.exe -c "from youtube_transcript_api import YouTubeTranscriptApi; ytt_api = YouTubeTranscriptApi(); t = ytt_api.fetch(\"VIDEO_ID\"); [print(s.text) for s in t]"',
  intent: "youtube transcript full text"
)
```
Replace `VIDEO_ID` with the actual video ID.

3. **Summarize** the transcript for the user — key topics, speakers if identifiable, main takeaways

4. **Search** the indexed content with ctx_search for any specific details needed to make the summary accurate

5. **Ask "Worth saving?"** — If the content is substantial/useful, offer to persist a structured summary to Open Brain (`kb_store`) with appropriate tags. Don't ask for trivial/short videos.
