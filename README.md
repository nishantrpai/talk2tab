# LLM Agent Chrome Extension

An AI assistant that uses your browser tabs and visited pages as context to answer questions and provide data in your requested format.

## Features

- **Tab Context**: Add current tab or all open tabs as context for the LLM
- **Visited Links**: Automatically capture and store content from pages you visit
- **Local LLM Integration**: Works with LM Studio for privacy-focused AI responses
- **Flexible Output**: Get responses in tabular, JSON, or other formats
- **Sidebar Interface**: Clean, minimal dark UI built with Radix UI
- **Context Management**: Similar to GitHub Copilot's "add context" feature

## Setup Instructions

1. Download the extension:
   - Download the `build` folder from the repository

2. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right corner
   - Click "Load unpacked" and select the downloaded `build` folder

3. Configure LM Studio:
   - Install and run LM Studio locally
   - Load your preferred model
   - Ensure the API server is running (typically on http://localhost:1234)

4. The extension should now be active. Click the extension icon to open the sidebar and start chatting with context from your tabs.

## Development

```bash
# Watch mode for development
npm run watch

# Build for production
npm run build

# Format code
npm run format
```

Note: Make sure to reload the extension and refresh pages after making changes to the code.
