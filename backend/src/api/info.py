from fastapi import APIRouter

from config import get_config
from schema.rest import InfoResponse

router = APIRouter(prefix="/info", tags=["info"])


@router.get("", response_model=InfoResponse)
def get_info() -> InfoResponse:
    cfg = get_config()
    send_via_email = cfg.email_smtp.display_email or cfg.email_smtp.username
    return InfoResponse(
        org_name=cfg.app.organization_name,
        send_via_email=send_via_email,
    )
