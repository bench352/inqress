import fastapi

import config
import schema.rest
import service.email

router = fastapi.APIRouter(prefix="/info", tags=["Info"])


@router.get("", response_model=schema.rest.InfoResponse)
def get_info(request: fastapi.Request) -> schema.rest.InfoResponse:
    cfg = config.get_config()
    sender_name = service.email.resolve_sender_name(None, cfg.app.organization_name)
    from_header, from_error = service.email.resolve_from(
        cfg.email_smtp.from_address, cfg.email_smtp.username, sender_name
    )
    return schema.rest.InfoResponse(
        org_name=cfg.app.organization_name,
        from_header=from_header or "",
        from_error=from_error,
        email_footer_enabled=cfg.email_smtp.email_footer_enabled,
        app_version=request.app.version,
    )
