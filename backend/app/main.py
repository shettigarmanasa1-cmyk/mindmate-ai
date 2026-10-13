from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

app = FastAPI(title="MindMate AI")

# CORS: only our React dev server may call this API from a browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        # We report only whether a real key exists, never the key itself.
        "openai_key_configured": settings.openai_api_key not in ("", "your-key-here"),
    }