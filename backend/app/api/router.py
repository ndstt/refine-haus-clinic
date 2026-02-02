from fastapi import APIRouter

from app.api.routes.ai import router as ai_router
from app.api.routes.appointment import router as appointment_router
from app.api.routes.booking import router as booking_router
from app.api.routes.chat import router as chat_router
from app.api.routes.health import router as health_router
from app.api.routes.ml import router as ml_router
from app.api.routes.promotion import router as promotion_router
from app.api.routes.purchase_invoice import router as purchase_invoice_router
from app.api.routes.resource import router as resource_router
from app.api.routes.transaction import router as transaction_router
from app.api.routes.treatment import router as treatment_router

# Central router that groups all route domains in one place.
router = APIRouter()

router.include_router(health_router)
router.include_router(appointment_router)
router.include_router(chat_router)
router.include_router(ai_router)
router.include_router(resource_router)
router.include_router(purchase_invoice_router)
router.include_router(transaction_router)
router.include_router(treatment_router)
router.include_router(booking_router)
router.include_router(ml_router)
router.include_router(promotion_router)
