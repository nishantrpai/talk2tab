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


TODO: 

1. Need to change the name and logo, this is too boring (for me, not for copilot)
2. When on a webpage with a lot, need to automatically summarize the content and show it in the sidebar.
3. When someone right clicks > add to llm context, it should the summarize the page into essential points
4. Add to journal in chat isn't working, need to fix that.
5. Settings page needs to be full screen, not just a small popup.
6. Give user the ability to add custom rules for each website, like stylebot open rules for this page.
7. Give the extension the ability to generate scripts and reshape the page based on user input.
8. if in the journal user wants to quote and save text it should be > quote text > and then it should save the text in the journal with the source link, similar to how we do add to journal (when right clicked).
9. Chat input must be static. That and journal should be similar in design. Use feather icons.
10. The response type should be a dropdown, not 3 buttons for text, json, table.
11. Design change: the icons everywhere are too out of proportion, they need to be smaller and more subtle. Follow the design rules of steveschoger. Maintain grayscale and minimalism. 
12. Allow the ability to add journal in context. Should be part of agent by default i feel.
13. Give the ability to add todo list items in the journal. That can be checked off. A future goal would be people would be able to use this as a todo list manager, ask the llm to summarize what they got done today/this week.
