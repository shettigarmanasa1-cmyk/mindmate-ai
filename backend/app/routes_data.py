from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app import export_service

router = APIRouter(prefix="/api", tags=["data"])


@router.get("/export")
def export_data():
    return JSONResponse(
        content=export_service.build_export(),
        headers={"Content-Disposition": 'attachment; filename="mindmate-export.json"'},
    )


@router.get("/data-info")
def data_info():
    return export_service.data_info()