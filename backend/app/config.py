import os
from dotenv import load_dotenv

# Read the .env file in the backend folder into environment variables.
load_dotenv()


class Settings:
    """All app configuration lives here, read once from the environment."""

    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    # Empty means the real OpenAI. Set it to use another provider.
    openai_base_url: str = os.getenv("OPENAI_BASE_URL", "")
    database_path: str = os.getenv("DATABASE_PATH", "mindmate.db")
    frontend_origin: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")


settings = Settings()