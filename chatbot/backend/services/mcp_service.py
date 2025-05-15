"""
MCP service for the chatbot API.
"""
import logging
import traceback
from typing import Dict, List, Any, Optional

from .mcp.client import MCPClient
from .mcp.tools import MCPToolsService

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class MCPService:
    """Service for interacting with various services through MCP."""

    def __init__(self, server_url: str = None):
        """
        Initialize the MCP service.

        Args:
            server_url: The MCP server URL. If None, uses the default URL.
        """
        self.client = MCPClient(server_url)
        self.tools_service = MCPToolsService(self.client)
        self.is_connected = False
        self.available_tools = []

    async def connect(self):
        """
        Connect to the MCP server and fetch available tools.

        Returns:
            bool: True if connection was successful, False otherwise.
        """
        try:
            logger.info("Connecting to MCP server...")
            client_connected = await self.client.connect()

            if client_connected:
                logger.info("Successfully connected to MCP client")
                tools_fetched = await self.tools_service.fetch_tools()

                if tools_fetched:
                    self.is_connected = True
                    self.available_tools = await self.list_available_tools()
                    logger.info(f"Successfully fetched {len(self.available_tools)} tools")
                    return True
                else:
                    logger.error("Failed to fetch tools from MCP server")
                    return False
            else:
                logger.error("Failed to connect to MCP client")
                return False
        except Exception as e:
            logger.error(f"Error connecting to MCP server: {e}")
            logger.error(traceback.format_exc())
            return False

    async def disconnect(self):
        """
        Disconnect from the MCP server.

        Returns:
            bool: True if disconnection was successful, False otherwise.
        """
        try:
            result = await self.client.disconnect()
            self.is_connected = False
            return result
        except Exception as e:
            logger.error(f"Error disconnecting from MCP server: {e}")
            logger.error(traceback.format_exc())
            return False

    async def list_available_tools(self) -> List[Dict[str, Any]]:
        """
        List all available MCP tools.

        Returns:
            A list of dictionaries containing tool information.
        """
        return await self.tools_service.list_available_tools()

    async def list_services(self) -> Dict[str, List[Dict[str, Any]]]:
        """
        List all available services and their tools.

        Returns:
            A dictionary mapping service names to lists of tools.
        """
        return await self.tools_service.list_services()

    async def call_tool(self, tool_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Call a specific MCP tool with parameters.

        Args:
            tool_name: The name of the tool to call.
            params: The parameters to pass to the tool.

        Returns:
            A dictionary containing the result of the operation.
        """
        try:
            if not self.is_connected:
                logger.warning("MCP service is not connected. Attempting to reconnect...")
                connected = await self.connect()
                if not connected:
                    return {"error": "Failed to connect to MCP server"}

            # Ensure 'instructions' parameter is present
            if 'instructions' not in params:
                # Create instructions from the parameters
                instructions = f"Please {tool_name.replace('_', ' ')} with the following parameters: "
                for key, value in params.items():
                    instructions += f"{key}={value}, "
                params['instructions'] = instructions.rstrip(', ')
                logger.debug(f"Added instructions parameter: {params['instructions']}")

            logger.info(f"Calling MCP tool: {tool_name} with params: {params}")
            result = await self.client.call_tool(tool_name, params)

            # Check if result contains an error
            if isinstance(result, dict) and 'error' in result:
                logger.error(f"Error from MCP tool {tool_name}: {result['error']}")
                return result

            logger.info(f"Successfully called MCP tool {tool_name}")
            return result
        except Exception as e:
            error_msg = f"Error calling MCP tool {tool_name}: {str(e)}"
            logger.error(error_msg)
            logger.error(traceback.format_exc())
            return {"error": error_msg}

    # Gmail specific methods
    async def gmail_search_emails(self, query: str) -> Dict[str, Any]:
        """
        Search for emails in Gmail.

        Args:
            query: The search query.

        Returns:
            A dictionary containing the search results.
        """
        return await self.call_tool('gmail_find_email', {'query': query})

    async def gmail_send_email(self, to: str, subject: str, body: str, cc: str = None) -> Dict[str, Any]:
        """
        Send an email through Gmail.

        Args:
            to: The recipient email address.
            subject: The email subject.
            body: The email body.
            cc: Optional CC email address.

        Returns:
            A dictionary containing the result of the operation.
        """
        params = {
            'to': to,
            'subject': subject,
            'body': body
        }

        if cc:
            params['cc'] = cc

        return await self.call_tool('gmail_send_email', params)

    # Zoom specific methods
    async def zoom_create_meeting(self, topic: str, start_time: str, duration: int, agenda: str = None) -> Dict[str, Any]:
        """
        Create a Zoom meeting.

        Args:
            topic: The meeting topic.
            start_time: The meeting start time in ISO format.
            duration: The meeting duration in minutes.
            agenda: Optional meeting agenda.

        Returns:
            A dictionary containing the result of the operation.
        """
        params = {
            'topic': topic,
            'start_time': start_time,
            'duration': duration
        }

        if agenda:
            params['agenda'] = agenda

        return await self.call_tool('zoom_create_meeting', params)

    # Google Drive specific methods
    async def drive_find_file(self, title: str) -> Dict[str, Any]:
        """
        Find a file in Google Drive.

        Args:
            title: The file title to search for.

        Returns:
            A dictionary containing the search results.
        """
        return await self.call_tool('google_drive_find_a_file', {'title': title})
