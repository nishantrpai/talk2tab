# LLM Agent Chrome Extension

An AI-powered Chrome extension that helps you analyze and interact with your browser tabs using local LLM models.

## Features

### 🔗 Context Management
- **Add Current Tab**: Automatically includes the current tab's content in your AI conversations
- **Add All Tabs**: Analyze multiple tabs simultaneously
- **Smart Context**: Current tab is always included by default when asking questions

### 💬 AI Chat Interface
- **Flexible Response Styles**: Use a custom textarea to define exactly how you want the AI to respond
- **Multiple Output Formats**: Choose between Text, JSON, or Table format responses
- **Chat History**: Persistent conversation history across sessions
- **Current Tab Focus**: Ask questions like "summarize this" and the AI knows you're referring to the current tab

### 📝 Integrated Notepad
- **Save Important Information**: Quick notepad for saving snippets, AI responses, or personal notes
- **Save from Chat**: One-click save button on AI responses to add them to your notepad
- **Edit & Organize**: Edit, copy, or delete notes as needed
- **Source Tracking**: Notes remember if they came from chat responses or manual entry

### ⚙️ Customizable Settings
- **Response Style**: Custom textarea to define AI behavior (instead of limited dropdowns)
- **API Endpoint**: Easy switching between LLM providers (defaults to LM Studio)
- **Token Limits**: Configurable response length
- **Markdown Toggle**: Enable/disable markdown formatting

### 🎨 Clean UI
- **Tab-based Interface**: Switch between Chat and Notepad views
- **Dark Theme**: Minimal, grayscale design for focus
- **Responsive**: Works well in the Chrome side panel
- **Keyboard Shortcuts**: Enter to send messages, Shift+Enter for line breaks

## Setup

1. Install LM Studio and start a local model server
2. Load the extension in Chrome (Developer mode)
3. Click the extension icon or use the context menu to open the side panel
4. Start asking questions about your current tab!

## Usage

### Basic Chat
- The extension automatically includes your current tab content
- Ask questions like "What's the main point of this article?"
- Add more tabs for context if needed

### Custom Response Style
- Go to Settings (⚙️) and use the Response Style textarea
- Example: "Be concise and direct. Use bullet points. Focus on key insights only."
- The AI will follow these instructions in all responses

### Notepad
- Switch to the Notepad tab to save important information
- Click the 📋 button on AI responses to save them
- Add manual notes with the "+ Add Note" button
- Edit, copy, or delete notes as needed

## Technical Details

- **Frontend**: Vanilla JavaScript with Chrome Extensions API
- **Backend**: Configurable LLM API endpoint (defaults to LM Studio)
- **Storage**: Chrome local storage for settings, notes, and chat history
- **UI**: Custom CSS with Radix UI inspired styling

## Development

```bash
npm install
npm run build
```

Load the `build` folder in Chrome as an unpacked extension.

## Future Enhancements

- Support for more LLM providers
- Export/import notes functionality
- Advanced context filtering
- Integration with other productivity tools
