"""Deep Search API — F-09 (PRD §9). 관심 벡터 기반 외부 논문 추천."""
# ruff: noqa: N815

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from paperlight.auth.dependencies import get_user_id
from paperlight.services.library_service import interest_vector, paper_count
from paperlight.services.recommendation import deep_search

router = APIRouter(prefix="/api/deep-search", tags=["deep-search"])

UserDep = Annotated[str, Depends(get_user_id)]


class SearchBody(BaseModel):
    query: str = Field(..., min_length=1)
    limit: int = Field(default=10, ge=1, le=30)


@router.post("")
async def search(body: SearchBody, user_id: UserDep) -> dict[str, Any]:
    results = await deep_search(user_id, body.query, limit=body.limit)
    return {"results": results}


@router.get("/interests")
async def interests(user_id: UserDep) -> dict[str, Any]:
    count = await paper_count(user_id)
    vec = await interest_vector(user_id) if count else None
    return {"ready": vec is not None, "paperCount": count}
