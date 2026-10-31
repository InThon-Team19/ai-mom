"""Authentication/ownership for the existing media endpoints; no anonymous mode."""
from fastapi import HTTPException, Request

from app.auth import DB, Principal, owned
from app.models import Child, Device


async def legacy_scope(request: Request, token: Principal, db: DB):
    path = request.url.path
    parent_path = any(part in path for part in ("parent-sample", "parent-mouth", "/analysis/", "/coaching/", "/register", "/mouth-profile/", "/gauge/"))
    if parent_path and token.device_id:
        raise HTTPException(403, "부모 전용 API예요")
    child_id = request.path_params.get("child_id") or request.query_params.get("child_id")
    if not child_id and request.method in {"POST", "PUT", "PATCH"}:
        content_type = request.headers.get("content-type", "")
        if "application/json" in content_type:
            try:
                body = await request.json()
            except ValueError:
                raise HTTPException(422, "JSON 형식을 확인해 주세요")
            child_id = body.get("child_id") if isinstance(body, dict) else None
        elif "multipart/form-data" in content_type or "application/x-www-form-urlencoded" in content_type:
            body = await request.form()
            child_id = body.get("child_id")
    if child_id:
        if not isinstance(child_id, str) or not child_id or len(child_id) > 64 or any(c not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-" for c in child_id):
            raise HTTPException(400, "child_id 형식 오류")
        child = owned(db, Child, child_id, token.parent_id)
        if token.device_id and db.get(Device, token.device_id).child_id != child.id:
            raise HTTPException(404, "항목을 찾을 수 없어요")
    return token
