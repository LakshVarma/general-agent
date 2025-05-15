"""
Configuration settings for the chatbot application.
"""
import os
from dotenv import load_dotenv

# Load environment variables from .env file if it exists
load_dotenv()

# Gemini API settings
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

# NVIDIA API settings
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "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")
NVIDIA_MODEL = os.getenv("NVIDIA_MODEL", "mistralai/mistral-medium-3-instruct")

# Default model to use (gemini or nvidia)
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "gemini")

# Flask application settings
DEBUG = os.getenv("DEBUG", "True").lower() in ("true", "1", "t")
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "5000"))

# CORS settings
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")
