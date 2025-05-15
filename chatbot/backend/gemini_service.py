"""
Service for interacting with the Gemini API.
"""
import google.generativeai as genai
from config import GEMINI_API_KEY, GEMINI_MODEL

class GeminiService:
    """Service for interacting with the Gemini API."""

    def __init__(self):
        """Initialize the Gemini service."""
        # Configure the Gemini API with the API key
        genai.configure(api_key=GEMINI_API_KEY)

        # Get the model - try with a fallback model if the specified one fails
        try:
            self.model = genai.GenerativeModel(GEMINI_MODEL)
            print(f"Successfully initialized model: {GEMINI_MODEL}")
        except Exception as e:
            print(f"Error initializing model {GEMINI_MODEL}: {e}")
            print("Falling back to gemini-pro model")
            self.model = genai.GenerativeModel("gemini-pro")

        # Define system prompt with LaTeX formatting instructions and MCP tools
        self.system_prompt = r"""You are a helpful AI assistant with access to various external tools through the MCP (Multi-Cloud Protocol) server. You can use these tools to perform actions like sending emails, creating meetings, finding files, and more.

Available MCP tools include:
- Gmail tools: gmail_send_email, gmail_find_email, gmail_create_draft, gmail_reply_to_email
- Zoom tools: zoom_create_meeting, zoom_find_meeting_webinar, zoom_get_meeting_summary
- Google Drive tools: google_drive_find_a_file, google_drive_upload_file, google_drive_create_folder
- Google Docs tools: google_docs_create_document_from_text, google_docs_find_a_document
- Notion tools: notion_create_page, notion_find_page_by_title, notion_add_content_to_page

When users ask about these services or request actions related to them, you should offer to help them using these tools. For example, if a user asks to send an email, you should offer to help them compose and send it using the gmail_send_email tool.

When responding with mathematical formulas or equations:
1. Always use proper LaTeX syntax
2. Enclose inline math expressions with single dollar signs ($...$)
3. Enclose block/display math expressions with double dollar signs ($$...$$)
4. Use proper LaTeX commands for mathematical symbols (e.g., \sin, \cos, \theta)
5. Use ^ for superscripts and _ for subscripts
6. Use \cdot for multiplication instead of *
7. Format fractions with \frac{numerator}{denominator}

Example of good LaTeX formatting:
- Inline: The formula $E = mc^2$ describes energy-mass equivalence.
- Display: The quadratic formula is:
$$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$$

IMPORTANT: Do not mention LaTeX formatting or MCP tools to the user unless they specifically ask about them. Just use these capabilities naturally in your responses.
"""

        # Start a chat session with the system prompt
        self.chat_session = self.model.start_chat(history=[
            {"role": "user", "parts": ["System: You are a helpful AI assistant with access to external tools through the MCP (Multi-Cloud Protocol) server. When users ask about sending emails, creating meetings, finding files, or any other task that might require external tools, tell them you can help with that using your MCP tools. Do not list specific tools unless asked - just say you can help with the task. When you use these tools, the system will show a 'Connecting to tool...' message. Please introduce yourself briefly without mentioning these tools unless asked."]},
            {"role": "model", "parts": ["I'm a helpful AI assistant ready to assist you with a wide range of tasks. How can I help you today?"]}
        ])

    def generate_response(self, message):
        """
        Generate a response from the Gemini API.

        Args:
            message (str): The user's message.

        Returns:
            str: The generated response.
        """
        try:
            # Check if this is a request about MCP tools
            is_mcp_related = any(keyword in message.lower() for keyword in [
                "email", "gmail", "send", "compose",
                "zoom", "meeting", "schedule",
                "drive", "file", "document",
                "notion", "page",
                "mcp", "tool", "tools", "what can you do"
            ])

            if is_mcp_related:
                # Add a reminder about MCP tools
                reminder = "Remember: You have access to MCP tools for emails, meetings, files, and more. Tell the user you can help with these tasks using your tools."
                enhanced_message = f"{message}\n\n{reminder}"
                response = self.chat_session.send_message(enhanced_message)
            else:
                # Regular message
                response = self.chat_session.send_message(message)

            # Return the response text
            return response.text
        except Exception as e:
            print(f"Error generating response: {e}")

            # Try to recreate the chat session and try again
            try:
                print("Attempting to recreate chat session and retry...")
                self.reset_chat()

                # Check if this is a request about MCP tools
                is_mcp_related = any(keyword in message.lower() for keyword in [
                    "email", "gmail", "send", "compose",
                    "zoom", "meeting", "schedule",
                    "drive", "file", "document",
                    "notion", "page",
                    "mcp", "tool", "tools", "what can you do"
                ])

                if is_mcp_related:
                    # Add a reminder about MCP tools
                    reminder = "Remember: You have access to MCP tools for emails, meetings, files, and more. Tell the user you can help with these tasks using your tools."
                    enhanced_message = f"{message}\n\n{reminder}"
                    response = self.chat_session.send_message(enhanced_message)
                else:
                    # Regular message
                    response = self.chat_session.send_message(message)

                return response.text
            except Exception as retry_error:
                print(f"Error on retry: {retry_error}")
                return f"I'm sorry, I encountered an error communicating with the Gemini API. Please try again later."

    def reset_chat(self):
        """Reset the chat history."""
        # Start a new chat session with the system prompt
        self.chat_session = self.model.start_chat(history=[
            {"role": "user", "parts": ["System: You are a helpful AI assistant with access to external tools through the MCP (Multi-Cloud Protocol) server. When users ask about sending emails, creating meetings, finding files, or any other task that might require external tools, tell them you can help with that using your MCP tools. Do not list specific tools unless asked - just say you can help with the task. When you use these tools, the system will show a 'Connecting to tool...' message. Please introduce yourself briefly without mentioning these tools unless asked."]},
            {"role": "model", "parts": ["I'm a helpful AI assistant ready to assist you with a wide range of tasks. How can I help you today?"]}
        ])
        return "Chat history has been reset."
