import fastapi

router = fastapi.APIRouter()


@router.get("/health")
def health():
    return {"status": "ok"}
