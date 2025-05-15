"""
Service for generating dynamic system prompts.
"""
import logging
from typing import Dict, List, Any

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class PromptService:
    """Service for generating dynamic system prompts."""

    def __init__(self):
        """Initialize the prompt service."""
        self.base_system_prompt = """You are a helpful AI assistant with access to various external tools through the MCP (Multi-Cloud Protocol) server.
You can use these tools to perform actions like sending emails, creating meetings, finding files, and more.

When users ask about sending emails, creating meetings, finding files, or any other task that might require external tools,
you should help them using your MCP tools. You have the ability to use these tools directly - you don't need to ask the user to do it themselves.

For example:
- If a user asks you to send an email, you can use the gmail_send_email tool to do so.
- If a user asks you to schedule a meeting, you can use the zoom_create_meeting tool.
- If a user asks you to find files, you can use the google_drive_find_a_file tool.

IMPORTANT: You should NEVER say that you cannot perform these actions. You have direct access to these tools and can use them on behalf of the user.
If a user asks you to send an email, DO NOT say "I cannot send emails directly." Instead, offer to help them send the email using your tools.

When you use these tools, the system will show a 'Connecting to tool...' message and handle the connection for you.

If you need more information from the user to use a tool (like an email address or meeting time), ask for that specific information.
"""

    def generate_system_prompt(self, available_tools: List[Dict[str, Any]]) -> str:
        """
        Generate a system prompt that includes information about available tools.

        Args:
            available_tools: A list of dictionaries containing tool information.

        Returns:
            A system prompt string.
        """
        # Start with the base system prompt
        prompt = self.base_system_prompt + "\n\n"

        # Add information about available tools
        prompt += "Here are the tools you have access to:\n\n"

        # Group tools by service
        service_tools = {}
        for tool in available_tools:
            service_name = tool["name"].split("_")[0] if "_" in tool["name"] else "other"
            if service_name not in service_tools:
                service_tools[service_name] = []
            service_tools[service_name].append(tool)

        # Add tools by service
        for service, tools in service_tools.items():
            prompt += f"## {service.capitalize()} Tools\n"
            for tool in tools:
                prompt += f"- **{tool['name']}**: {tool['description']}\n"

                # Add parameter information if available
                if "parameters" in tool and tool["parameters"]:
                    prompt += f"  Parameters: {', '.join(tool['parameters'])}\n"
            prompt += "\n"

        # Add instructions on how to use the tools
        prompt += """
When a user asks you to perform a task that requires one of these tools:
1. Identify which tool would be most appropriate
2. Tell the user you can help them with that task using your tools
3. Ask for any necessary information you need to use the tool
4. Use the tool to complete the task

IMPORTANT INSTRUCTIONS:
- You have direct access to these tools and can use them on behalf of the user
- NEVER say you cannot perform these actions - you CAN use these tools directly
- If a user asks you to send an email, DO NOT say "I cannot send emails directly" - instead, offer to help them send the email using your tools
- If you need more information from the user, ask specific questions to get that information
- Always be helpful and proactive in offering to use your tools to assist the user

EXAMPLES:
User: "Can you send an email to john@example.com?"
You: "I'd be happy to help you send an email to john@example.com. What would you like the subject and content of the email to be?"

User: "Schedule a meeting for tomorrow at 3pm"
You: "I can help you schedule a meeting for tomorrow at 3pm. What would you like to title the meeting, and who should be invited?"

User: "Find my recent emails from Sarah"
You: "I'll help you find recent emails from Sarah. Let me search your inbox for you."
"""

        return prompt

    def generate_user_system_message(self, available_tools: List[Dict[str, Any]]) -> str:
        """
        Generate a system message to be sent as the first user message.

        Args:
            available_tools: A list of dictionaries containing tool information.

        Returns:
            A system message string.
        """
        return f"System: {self.generate_system_prompt(available_tools)}"
