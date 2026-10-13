from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import init_db
from app.memory_service import MemoryServiceError
from app.routes_chat import router as chat_router
from app.routes_conversations import router as conversations_router
from app.routes_memories import router as memories_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()  # runs once when the server starts
    yield


app = FastAPI(title="MindMate AI", lifespan=lifespan)

# CORS: only our React dev server may call this API from a browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)

app.include_router(conversations_router)
app.include_router(chat_router)
app.include_router(memories_router)


@app.exception_handler(MemoryServiceError)
async def memory_error_handler(request: Request, error: MemoryServiceError):
    return JSONResponse(status_code=error.status_code, content={"detail": error.message})


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        # We report only whether a real key exists, never the key itself.
        "openai_key_configured": settings.openai_api_key not in ("", "your-key-here"),
    }