# Modular Chatbot with MCP Integration

A modular chatbot application with Google Gemini and NVIDIA API integration, as well as MCP (Multi-Cloud Platform) tool support for Gmail, Zoom, Google Drive, and more.

## Project Structure

The project is organized into a modular structure for better maintainability and scalability:

### Backend Structure

```
chatbot/backend/
├── app.py                 # Main application entry point
├── config.py              # Configuration settings
├── models/                # Data models
├── routes/                # API routes
│   ├── chat.py            # Chat API routes
│   ├── health.py          # Health check routes
│   └── mcp.py             # MCP API routes
├── services/              # Business logic
│   ├── chat_service.py    # Chat service
│   ├── gemini_service.py  # Gemini API service
│   ├── mcp_service.py     # MCP service
│   ├── mcp/               # MCP-specific services
│   │   ├── client.py      # MCP client
│   │   └── tools.py       # MCP tools
│   └── nvidia_service.py  # NVIDIA API service
└── middleware/            # Express middleware
```

### Frontend Structure

```
chatbot/frontend/
├── public/
│   ├── css/               # CSS styles
│   │   ├── chat.css       # Chat styles
│   │   ├── style.css      # Global styles
│   │   └── tool-connection.css # Tool connection animation styles
│   ├── js/                # JavaScript files
│   │   ├── components/    # UI components
│   │   │   ├── mcp_ui.js  # MCP UI components
│   │   │   └── tool_connection.js # Tool connection component
│   │   ├── services/      # Service modules
│   │   │   ├── chat.js    # Chat service
│   │   │   ├── mcp_client.js # MCP client service
│   │   │   └── streaming.js # Streaming service
│   │   ├── main.js        # Main application logic
│   │   └── ui.js          # UI utilities
│   └── index.html         # Main HTML file
```

## Features

- **Chat Interface**: Modern chat interface with streaming responses
- **Multiple AI Models**: Support for Google Gemini and NVIDIA API
- **MCP Integration**: Integration with various services through MCP
  - Gmail: Send emails, search emails
  - Zoom: Create meetings
  - Google Drive: Find files
  - And more...
- **Tool Connection Animation**: Google Gemini-style tool connection animation
- **File Upload**: Upload files to the chatbot
- **Voice Input**: Record and send voice messages
- **Persistent Chat History**: Save and load chat history
- **Syntax Highlighting**: Code syntax highlighting for various languages
- **Markdown Support**: Rich text formatting with Markdown
- **LaTeX Rendering**: Mathematical equations with LaTeX

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
   ```
   cd chatbot/backend
   ```

2. Create a virtual environment:
   ```
   python -m venv venv
   ```

3. Activate the virtual environment:
   - Windows: `venv\Scripts\activate`
   - macOS/Linux: `source venv/bin/activate`

4. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

5. Create a `.env` file with your Gemini API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   GEMINI_MODEL=gemini-2.0-flash
   DEBUG=True
   HOST=127.0.0.1
   PORT=5000
   CORS_ORIGINS=*
   ```

6. Run the Flask application:
   ```
   python app.py
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```
   cd chatbot/frontend
   ```

2. Install Node.js dependencies:
   ```
   npm install
   ```

3. Create a `.env` file:
   ```
   PORT=3000
   BACKEND_URL=http://localhost:5000
   ```

4. Run the Express.js server:
   ```
   npm start
   ```

5. Open your browser and navigate to `http://localhost:3000`

## MCP Tool Integration

The chatbot integrates with MCP tools in two ways:

1. **Direct Integration**: The AI can directly call MCP tools when it detects the intent in the user's message
2. **Form-Based Integration**: The AI can display forms for the user to fill out for more complex operations

When an MCP tool is called, a Google Gemini-style "Connecting to tool..." animation is displayed, showing which service and tool is being used.

## Development

### Adding a New MCP Tool

1. Add the tool to the `MCPService` class in `chatbot/backend/services/mcp_service.py`
2. Add detection logic in the `_detect_mcp_action` method in `chatbot/backend/services/chat_service.py`
3. Add UI components in `chatbot/frontend/public/js/components/mcp_ui.js`
4. Add styling in `chatbot/frontend/public/css/tool-connection.css`

### Adding a New AI Model

1. Create a new service class in `chatbot/backend/services/`
2. Update the `ChatService` class in `chatbot/backend/services/chat_service.py`
3. Add the model to the model selection dropdown in the UI

## Future Enhancements

- Add authentication and user management
- Implement more MCP tool integrations
- Add conversation memory and context management
- Implement multi-user support
- Add support for more file types and media
- Implement real-time collaboration features

## License

MIT
