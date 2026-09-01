import os
from pathlib import Path
from pydantic_settings import BaseSettings

# Find the .env file relative to this config file (backend/.env)
_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"

class Settings(BaseSettings):
    APP_NAME: str = "ControlPlane.ai Guardrail Gateway"
    API_PREFIX: str = "/api"
    DATABASE_URL: str = "sqlite+aiosqlite:///./controlplane.db"
    
    # LLM API keys — loaded automatically from backend/.env
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    GROK_API_KEY: str = ""
    
    # Risk scoring thresholds
    LOW_RISK_THRESHOLD: float = 85.0
    MEDIUM_RISK_THRESHOLD: float = 50.0
    
    # Weight distributions across 3 pillars (Sum to 1.0)
    PERFORMANCE_WEIGHT: float = 0.40
    COST_WEIGHT: float = 0.20
    RESPONSIBILITY_WEIGHT: float = 0.40

    class Config:
        env_file = str(_ENV_FILE)
        extra = "ignore"

settings = Settings()
