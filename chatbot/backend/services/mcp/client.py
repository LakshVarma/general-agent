"""
MCP client for interacting with the MCP server.
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

class MCPClient:
    """Client for interacting with the MCP server."""

    def __init__(self, server_url: str = None):
        """
        Initialize the MCP client.

        Args:
            server_url: The MCP server URL. If None, uses the default URL.
        """
        # Default MCP server URL if none provided
        self.server_url = server_url or "https://mcp.zapier.com/api/mcp/s/ODk0NzRkOWYtYTRmYS00ODMzLWI0MTEtNjY1NTAzNDFmNWY3OjNkZmQ2YmNmLTJiZTMtNGNmOS05YjU1LTc0MTk0N2VlY2E1YQ==/mcp"
        self.transport = StreamableHttpTransport(self.server_url)
        self.client = Client(transport=self.transport)
        
    async def connect(self):
        """Connect to the MCP server."""
        try:
            logger.debug(f"Attempting to connect to MCP server at: {self.server_url}")

            # The client is already initialized, so we just need to check the connection
            async with self.client as client:
                logger.info(f"Connected to MCP server: {client.is_connected()}")
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
