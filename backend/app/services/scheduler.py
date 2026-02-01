"""
Scheduler Service
จัดการ scheduled jobs สำหรับ ML และงานอัตโนมัติอื่นๆ
"""

import asyncio
import logging
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler: AsyncIOScheduler | None = None


async def run_ml_bundle_job():
    """
    Job: คำนวณ ML Bundle แล้วบันทึกลง promotion table
    รันอัตโนมัติตาม schedule ที่กำหนด
    """
    from app.ml.apriori import save_bundles_to_promotions

    logger.info(f"[Scheduler] Starting ML Bundle job at {datetime.now()}")

    try:
        result = await save_bundles_to_promotions(
            discount_percent=15.0,
            valid_days=30
        )

        if result["success"]:
            logger.info(
                f"[Scheduler] ML Bundle job completed: "
                f"Created {result['promotions_created']} promotions"
            )
        else:
            logger.warning(f"[Scheduler] ML Bundle job: {result['message']}")

    except Exception as e:
        logger.error(f"[Scheduler] ML Bundle job failed: {e}")


def start_scheduler():
    """
    เริ่ม scheduler พร้อม jobs ที่กำหนด
    """
    global scheduler

    if scheduler is not None:
        logger.warning("[Scheduler] Scheduler already running")
        return

    scheduler = AsyncIOScheduler()

    # ML Bundle Job - รันทุกวันจันทร์ เวลา 03:00 น.
    scheduler.add_job(
        run_ml_bundle_job,
        CronTrigger(day_of_week="mon", hour=3, minute=0),
        id="ml_bundle_weekly",
        name="ML Bundle Recommendations (Weekly)",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("[Scheduler] Started with ML Bundle job (every Monday at 03:00)")


def stop_scheduler():
    """
    หยุด scheduler
    """
    global scheduler

    if scheduler is not None:
        scheduler.shutdown()
        scheduler = None
        logger.info("[Scheduler] Stopped")


def get_scheduler_status() -> dict:
    """
    ดูสถานะ scheduler และ jobs ทั้งหมด
    """
    global scheduler

    if scheduler is None:
        return {"running": False, "jobs": []}

    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
            "trigger": str(job.trigger),
        })

    return {
        "running": scheduler.running,
        "jobs": jobs
    }


async def trigger_job_now(job_id: str) -> dict:
    """
    รัน job ทันที (manual trigger)
    """
    global scheduler

    if scheduler is None:
        return {"success": False, "message": "Scheduler not running"}

    job = scheduler.get_job(job_id)
    if job is None:
        return {"success": False, "message": f"Job '{job_id}' not found"}

    # Run the job function directly
    if job_id == "ml_bundle_weekly":
        await run_ml_bundle_job()
        return {"success": True, "message": "ML Bundle job triggered successfully"}

    return {"success": False, "message": f"Unknown job: {job_id}"}
