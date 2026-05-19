# Alembic — PaperLight migrations

Phase 1 S7a: 10-entity schema (PRD §8.5) + Tab from Phase 0.

## 사용

```bash
# 환경: DATABASE_URL이 sqlite/postgres 둘 다 지원.
# 미설정 시 sqlite+aiosqlite:///./paperlight.db (Phase 0 호환 default).

cd backend
uv run alembic upgrade head            # 모든 마이그레이션 적용
uv run alembic revision -m "msg"       # 신규 revision 생성 (수동 편집)
uv run alembic downgrade -1            # 한 단계 롤백
```

## 주의

- async engine을 사용하므로 `env.py`는 `async_engine_from_config` 경로로 동작.
- SQLite 대상 시 `render_as_batch=True`로 ALTER TABLE 호환.
- `init_db()`의 `Base.metadata.create_all`은 테스트 fixture (SQLite tempfile)에서만 사용.
  운용(Postgres)에서는 `alembic upgrade head`만 신뢰.
