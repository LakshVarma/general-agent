"""
MCP tools service for the chatbot API.
"""
import logging
from typing import Dict, List, Any, Optional

from .client import MCPClient, run_async

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class MCPToolsService:
    """Service for managing MCP tools."""

    def __init__(self, client: MCPClient):
        """
        Initialize the MCP tools service.

        Args:
            client: The MCP client to use.
        """
        self.client = client
        self.available_tools = []
        self.tool_categories = {}

    async def fetch_tools(self):
        """Fetch available tools from the MCP server."""
        try:
            # We'll use a context manager to ensure proper connection handling
            async with self.client.client as client:
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
            logger.error(f"Error fetching MCP tools: {e}")
            logger.exception("Detailed exception information:")
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
        # If we don't have tools yet, fetch them
        if not self.available_tools:
            await self.fetch_tools()

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
        # If we don't have tools yet, fetch them
        if not self.available_tools:
            await self.fetch_tools()

        return self.tool_categories
