from fastapi import APIRouter

from app.api.v1 import analytics, dashboard, meta, notifications, problems, queues, search, tasks, tickets

api_router = APIRouter()
api_router.include_router(meta.products_router)
api_router.include_router(meta.teams_router)
api_router.include_router(meta.users_router)
api_router.include_router(dashboard.router)
api_router.include_router(problems.router)
api_router.include_router(tasks.router)
api_router.include_router(tickets.router)
api_router.include_router(queues.router)
api_router.include_router(search.router)
api_router.include_router(analytics.router)
api_router.include_router(notifications.router)
