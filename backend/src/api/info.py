import fastapi

import config
import schema.rest

router = fastapi.APIRouter(prefix="/info", tags=["Info"])


@router.get("", response_model=schema.rest.InfoResponse)
def get_info(request: fastapi.Request) -> schema.rest.InfoResponse:
    cfg = config.get_config()
    send_via_email = cfg.email_smtp.display_email or cfg.email_smtp.username
    return schema.rest.InfoResponse(
        org_name=cfg.app.organization_name,
        send_via_email=send_via_email,
        app_version=request.app.version,
    )
