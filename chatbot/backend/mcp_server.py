"""
MCP (Multi-Cloud Protocol) server integration for the chatbot.
This module provides functions to interact with various services through MCP.
"""
import asyncio
import json
import logging
from typing import Dict, List, Any, Optional, Union, Tuple

from fastmcp import Client
from fastmcp.client.transports import StreamableHttpTransport

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class MCPServer:
    """Service for interacting with various services through MCP."""

    def __init__(self, server_url: str = None):
        """
        Initialize the MCP server.

        Args:
            server_url: The MCP server URL. If None, uses the default URL.
        """
        # Default MCP server URL if none provided
        self.server_url = server_url or "https://mcp.zapier.com/api/mcp/s/ODk0NzRkOWYtYTRmYS00ODMzLWI0MTEtNjY1NTAzNDFmNWY3OjNkZmQ2YmNmLTJiZTMtNGNmOS05YjU1LTc0MTk0N2VlY2E1YQ==/mcp"
        self.transport = StreamableHttpTransport(self.server_url)
        self.client = Client(transport=self.transport)
        self.available_tools = []
        self.tool_categories = {}

    async def connect(self):
        """Connect to the MCP server and fetch available tools."""
        try:
            logger.debug(f"Attempting to connect to MCP server at: {self.server_url}")

            # The client is already initialized, so we just need to fetch the tools
            # We'll use a context manager to ensure proper connection handling
            async with self.client as client:
                logger.info(f"Connected to MCP server: {client.is_connected()}")

                # Fetch available tools
                logger.debug("Fetching available tools...")
                self.available_tools = await client.list_tools()
                logger.debug(f"Fetched {len(self.available_tools)} tools")

                # Categorize tools by service
                logger.debug("Categorizing tools by service...")
                self._categorize_tools()

                logger.info(f"Available MCP tools: {len(self.available_tools)}")
                logger.info(f"Available services: {list(self.tool_categories.keys())}")

                # Log some example tools for debugging
                if self.available_tools:
                    logger.debug(f"Example tool: {self.available_tools[0].name} - {self.available_tools[0].description}")

            return True
        except Exception as e:
            logger.error(f"Error connecting to MCP server: {e}")
            logger.exception("Detailed exception information:")
            return False

    async def disconnect(self):
        """Disconnect from the MCP server."""
        try:
            # The client is automatically disconnected when the context manager exits
            # This method is kept for API compatibility
            logger.info("MCP client will disconnect automatically when context manager exits")
            return True
        except Exception as e:
            logger.error(f"Error disconnecting from MCP server: {e}")
            return False

    def _categorize_tools(self):
        """Categorize tools by service."""
        self.tool_categories = {}

        for tool in self.available_tools:
            # Extract service name from tool name (e.g., gmail_send_email -> gmail)
            service_name = tool.name.split('_')[0] if '_' in tool.name else 'other'

            if service_name not in self.tool_categories:
                self.tool_categories[service_name] = []

            # Get parameters from inputSchema if available
            parameters = []
            if hasattr(tool, 'inputSchema') and tool.inputSchema and 'properties' in tool.inputSchema:
                parameters = list(tool.inputSchema['properties'].keys())

            self.tool_categories[service_name].append({
                "name": tool.name,
                "description": tool.description,
                "parameters": parameters
            })

    async def list_available_tools(self) -> List[Dict[str, Any]]:
        """
        List all available MCP tools.

        Returns:
            A list of dictionaries containing tool information.
        """
        # If we don't have tools yet, connect and fetch them
        if not self.available_tools:
            await self.connect()

        tools_info = []
        for tool in self.available_tools:
            # Get parameters from inputSchema if available
            parameters = []
            if hasattr(tool, 'inputSchema') and tool.inputSchema and 'properties' in tool.inputSchema:
                parameters = list(tool.inputSchema['properties'].keys())

            tools_info.append({
                "name": tool.name,
                "description": tool.description,
                "parameters": parameters
            })

        return tools_info

    async def list_services(self) -> Dict[str, List[Dict[str, Any]]]:
        """
        List all available services and their tools.

        Returns:
            A dictionary mapping service names to lists of tools.
        """
        # If we don't have tools yet, connect and fetch them
        if not self.available_tools:
            await self.connect()

        return self.tool_categories

    async def call_tool(self, tool_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Call a specific MCP tool with parameters.

        Args:
            tool_name: The name of the tool to call.
            params: The parameters to pass to the tool.

        Returns:
            A dictionary containing the result of the operation.
        """
        logger.debug(f"Calling tool: {tool_name} with params: {params}")

        try:
            # Add instructions if not provided
            if 'instructions' not in params:
                service_name = tool_name.split('_')[0] if '_' in tool_name else ''
                service_name = service_name.capitalize()
                tool_action = tool_name.replace(f"{service_name.lower()}_", "").replace("_", " ")
                params['instructions'] = f"Execute the {service_name}: {tool_action} tool with the following parameters"
                logger.debug(f"Added instructions: {params['instructions']}")

            logger.debug(f"Calling MCP tool {tool_name} with params: {params}")

            # Use a context manager to ensure proper connection handling
            async with self.client as client:
                result = await client.call_tool(tool_name, params)
                logger.debug(f"Received result from MCP tool: {result}")

                # Parse the result
                if result and hasattr(result[0], 'text'):
                    parsed_result = json.loads(result[0].text)
                    logger.debug(f"Parsed result: {parsed_result}")
                    return parsed_result

            logger.warning("No result returned from MCP tool")
            return {"error": "No result returned"}
        except Exception as e:
            logger.error(f"Error calling tool {tool_name}: {e}")
            logger.exception("Detailed exception information:")
            return {"error": str(e)}

# Helper function to run async functions
def run_async(coro):
    """Run an async function and return its result."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()

# Example usage
if __name__ == "__main__":
    async def main():
        # Connection is established here
        print("Connecting to MCP server...")
        async with Client(transport=StreamableHttpTransport("https://mcp.zapier.com/api/mcp/s/ODk0NzRkOWYtYTRmYS00ODMzLWI0MTEtNjY1NTAzNDFmNWY3OjNkZmQ2YmNmLTJiZTMtNGNmOS05YjU1LTc0MTk0N2VlY2E1YQ==/mcp")) as client:
            print(f"Client connected: {client.is_connected()}")

            # Make MCP calls within the context
            print("Fetching available tools...")
            tools = await client.list_tools()

            print(f"Available tools: {json.dumps([t.name for t in tools], indent=2)}")

            # Example: Call a specific tool with parameters
            print("Calling zoom_create_meeting_registrant...")
            result = await client.call_tool(
                "zoom_create_meeting_registrant",
                {
                    "instructions": "Execute the Zoom: Create Meeting Registrant tool with the following parameters",
                    "email": "example-string",
                    "meeting": "example-string",
                    "first_name": "example-string",
                },
            )

            # Parse the JSON string from the TextContent and print it nicely formatted
            json_result = json.loads(result[0].text)
            print(
                f"\nzoom_create_meeting_registrant result:\n{json.dumps(json_result, indent=2)}"
            )

        # Connection is closed automatically when exiting the context manager
        print("Example completed")

    # Run the async main function
    asyncio.run(main())
