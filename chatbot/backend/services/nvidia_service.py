"""
NVIDIA service for the chatbot API.
"""
import logging
import os
import json
import requests
from typing import Dict, List, Any, Optional

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class NvidiaService:
    """Service for interacting with the NVIDIA API."""

    def __init__(self, api_key: str = None, model_name: str = "mistralai/mistral-medium-3-instruct"):
        """
        Initialize the NVIDIA service.

        Args:
            api_key: The NVIDIA API key. If None, uses the NVIDIA_API_KEY environment variable.
            model_name: The NVIDIA model name to use.
        """
        self.api_key = api_key or os.environ.get("NVIDIA_API_KEY")
        self.model_name = model_name
        self.api_url = "https://api.nvidia.com/v1/chat/completions"
        
        if not self.api_key:
            logger.warning("No NVIDIA API key provided. The service will not work properly.")
        else:
            logger.info(f"Using NVIDIA model: {self.model_name} as default")
            
    async def generate_response(self, message: str, history: List[Dict[str, str]] = None) -> str:
        """
        Generate a response from the NVIDIA API.

        Args:
            message: The user's message.
            history: The chat history.

        Returns:
            The generated response.
        """
        if not self.api_key:
            return "I'm sorry, the NVIDIA API is not properly configured."
            
        try:
            # Convert history to NVIDIA format
            messages = []
            
            if history:
                for msg in history:
                    if msg["role"] == "user":
                        messages.append({"role": "user", "content": msg["content"]})
                    elif msg["role"] == "assistant":
                        messages.append({"role": "assistant", "content": msg["content"]})
            
            # Add the current message
            messages.append({"role": "user", "content": message})
            
            # Prepare the request
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            data = {
                "model": self.model_name,
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 1024
            }
            
            # Make the request
            response = requests.post(self.api_url, headers=headers, json=data)
            
            if response.status_code != 200:
                logger.error(f"Error from NVIDIA API: {response.status_code} - {response.text}")
                return f"I'm sorry, I encountered an error: {response.status_code}"
                
            # Parse the response
            result = response.json()
            
            if "choices" in result and len(result["choices"]) > 0:
                return result["choices"][0]["message"]["content"]
            else:
                logger.error(f"Unexpected response format from NVIDIA API: {result}")
                return "I'm sorry, I received an unexpected response format."
        except Exception as e:
            logger.error(f"Error generating response from NVIDIA: {e}")
            return f"I'm sorry, I encountered an error: {str(e)}"
