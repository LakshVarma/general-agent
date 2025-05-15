"""
Gemini service for the chatbot API.
"""
import logging
import os
import json
import asyncio
from typing import Dict, List, Any, Optional, Tuple, Generator, AsyncGenerator

import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold
from google.generativeai.types.generation_types import GenerationConfig

import config
from services.prompt_service import PromptService

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class GeminiService:
    """Service for interacting with the Gemini API."""

    # Available models
    MODELS = {
        "gemini-2.5-pro": "gemini-2.5-pro-preview-05-06",
        "gemini-2.5-flash": "gemini-2.5-flash-preview-04-17",
        "gemini-2.0-flash": "gemini-2.0-flash",
        "gemini-2.0-pro": "gemini-2.0-pro",
        "gemini-1.5-pro": "gemini-1.5-pro",
        "gemini-1.5-flash": "gemini-1.5-flash"
    }

    def __init__(self, api_key: str = None, model_name: str = "gemini-2.5-flash"):
        """
        Initialize the Gemini service.

        Args:
            api_key: The Gemini API key. If None, uses the GEMINI_API_KEY environment variable.
            model_name: The Gemini model name to use.
        """
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        self.model_name = self.MODELS.get(model_name, model_name)
        self.prompt_service = PromptService()
        self.available_tools = []
        self.models = {}

        if not self.api_key:
            logger.warning("No Gemini API key provided. The service will not work properly.")
            return

        # Configure the Gemini API
        genai.configure(api_key=self.api_key)

        # Initialize the default model
        try:
            self.model = self.get_model(self.model_name)
            logger.info(f"Successfully initialized model: {self.model_name}")
        except Exception as e:
            logger.error(f"Error initializing Gemini model: {e}")
            self.model = None

    def get_model(self, model_name: str):
        """
        Get or create a model instance.

        Args:
            model_name: The model name to use.

        Returns:
            The model instance.
        """
        # Use the mapped model name if available
        actual_model_name = self.MODELS.get(model_name, model_name)

        # Check if we already have this model initialized
        if actual_model_name not in self.models:
            # Configure generation parameters based on model
            generation_config = None

            # Configure thinking for 2.5 models
            if "2.5" in actual_model_name:
                generation_config = {
                    "temperature": 0.7,
                    "top_p": 0.95,
                    "top_k": 64,
                    "candidate_count": 1,
                    "max_output_tokens": 8192,
                }

                # Add thinking for Pro models
                if "pro" in actual_model_name.lower():
                    generation_config["thinking"] = {"enabled": True}

            # Create the model with appropriate configuration
            if generation_config:
                self.models[actual_model_name] = genai.GenerativeModel(
                    actual_model_name,
                    generation_config=generation_config
                )
            else:
                self.models[actual_model_name] = genai.GenerativeModel(actual_model_name)

            logger.info(f"Initialized model: {actual_model_name}")

        return self.models[actual_model_name]

    def set_available_tools(self, tools: List[Dict[str, Any]]):
        """
        Set the available MCP tools.

        Args:
            tools: A list of dictionaries containing tool information.
        """
        self.available_tools = tools
        logger.info(f"Updated available tools: {len(self.available_tools)} tools")

    def get_system_prompt(self) -> str:
        """
        Get the system prompt with available tools.

        Returns:
            The system prompt string.
        """
        return self.prompt_service.generate_system_prompt(self.available_tools)

    def get_system_message(self) -> Dict[str, Any]:
        """
        Get the system message for the chat history.

        Returns:
            A dictionary containing the system message.
        """
        return {
            "role": "user",
            "parts": [self.prompt_service.generate_user_system_message(self.available_tools)]
        }

    async def generate_response(self, message: str, history: List[Dict[str, str]] = None, model_name: str = None) -> Tuple[str, str]:
        """
        Generate a response from the Gemini API.

        Args:
            message: The user's message.
            history: The chat history.
            model_name: The model name to use. If None, uses the default model.

        Returns:
            A tuple containing the generated response and the model used.
        """
        if not self.model:
            return "I'm sorry, the Gemini API is not properly configured.", "none"

        try:
            # Use specified model or default
            model = self.get_model(model_name) if model_name else self.model
            actual_model_name = model_name if model_name else self.model_name

            # Convert history to Gemini format
            gemini_history = []

            # Add system message as the first message if we have available tools
            if self.available_tools:
                gemini_history.append(self.get_system_message())

            if history:
                for msg in history:
                    if msg["role"] == "user":
                        gemini_history.append({"role": "user", "parts": [msg["content"]]})
                    elif msg["role"] == "assistant":
                        gemini_history.append({"role": "model", "parts": [msg["content"]]})

            # Create a chat session
            chat = model.start_chat(history=gemini_history)

            # Generate a response
            response = chat.send_message(message)

            # Check if there's thinking content
            thinking_content = ""
            if hasattr(response, 'candidates') and response.candidates:
                for candidate in response.candidates:
                    if hasattr(candidate, 'thinking') and candidate.thinking:
                        thinking_content = candidate.thinking
                        logger.info("Thinking content detected")
                        break

            # Log thinking content if available
            if thinking_content:
                logger.debug(f"Thinking content: {thinking_content}")

            return response.text, actual_model_name
        except Exception as e:
            logger.error(f"Error generating response from Gemini: {e}")
            return f"I'm sorry, I encountered an error: {str(e)}", "error"

    async def stream_response(self, message: str, history: List[Dict[str, str]] = None, model_name: str = None) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream a response from the Gemini API.

        Args:
            message: The user's message.
            history: The chat history.
            model_name: The model name to use. If None, uses the default model.

        Yields:
            Dictionaries containing response chunks and metadata.
        """
        if not self.model:
            await asyncio.sleep(0)  # Ensure this is truly asynchronous
            yield {
                "type": "error",
                "text": "I'm sorry, the Gemini API is not properly configured."
            }
            return

        try:
            # Use specified model or default
            model = self.get_model(model_name) if model_name else self.model
            actual_model_name = model_name if model_name else self.model_name

            # Convert history to Gemini format
            gemini_history = []

            # Add system message as the first message if we have available tools
            if self.available_tools:
                gemini_history.append(self.get_system_message())

            if history:
                for msg in history:
                    if msg["role"] == "user":
                        gemini_history.append({"role": "user", "parts": [msg["content"]]})
                    elif msg["role"] == "assistant":
                        gemini_history.append({"role": "model", "parts": [msg["content"]]})

            # Create a chat session
            chat = model.start_chat(history=gemini_history)

            # Check if this is a Pro model with thinking enabled
            is_thinking_model = "2.5" in actual_model_name and "pro" in actual_model_name.lower()

            if is_thinking_model:
                # First yield a status message that the model is thinking
                await asyncio.sleep(0)  # Ensure this is truly asynchronous
                yield {
                    "type": "status",
                    "text": "Thinking about your request..."
                }

            # Stream the response
            response_stream = chat.send_message_streaming(message)

            # Track if we've seen thinking content
            thinking_shown = False

            # Collect the full response
            full_response = ""

            # Process the stream
            for chunk in response_stream:
                # Check for thinking content
                if hasattr(chunk, 'candidates') and chunk.candidates:
                    for candidate in chunk.candidates:
                        if hasattr(candidate, 'thinking') and candidate.thinking and not thinking_shown:
                            # Yield thinking content
                            await asyncio.sleep(0)  # Ensure this is truly asynchronous
                            yield {
                                "type": "thinking",
                                "text": candidate.thinking
                            }
                            thinking_shown = True

                # Get the text chunk
                if chunk.text:
                    full_response += chunk.text
                    await asyncio.sleep(0)  # Ensure this is truly asynchronous
                    yield {
                        "type": "content",
                        "text": chunk.text,
                        "model_used": actual_model_name
                    }

            # Final message with complete response
            await asyncio.sleep(0)  # Ensure this is truly asynchronous
            yield {
                "type": "complete",
                "text": full_response,
                "model_used": actual_model_name
            }

        except Exception as e:
            logger.error(f"Error streaming response from Gemini: {e}")
            await asyncio.sleep(0)  # Ensure this is truly asynchronous
            yield {
                "type": "error",
                "text": f"I'm sorry, I encountered an error: {str(e)}"
            }
