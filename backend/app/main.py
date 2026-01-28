"""
Refine Haus Clinic - AI Business Intelligence Chatbot
=====================================================
Production-ready FastAPI + LangChain SQL Agent for Thai Beauty Clinic

Features:
- LangChain SQL Agent with GPT-4o
- Direct PostgreSQL/Supabase queries
- Thai language responses
- Sales, Stock, and Treatment analysis
"""

import os
import logging
from typing import Optional
from datetime import datetime

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# LangChain imports
from langchain_openai import ChatOpenAI
from langchain_community.utilities import SQLDatabase
from langchain_community.agent_toolkits import create_sql_agent

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# =============================================================================
# CONFIGURATION
# =============================================================================

# Database Configuration (Supabase PostgreSQL)
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    # Build from individual components if DATABASE_URL not provided
    DB_USER = os.getenv("DB_USER", "postgres")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_NAME = os.getenv("DB_NAME", "postgres")
    DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# OpenAI Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY environment variable is required")

# =============================================================================
# SYSTEM PROMPT (Thai Business Intelligence Assistant)
# =============================================================================

SYSTEM_PROMPT = """คุณคือ "LUMINA" ผู้ช่วย AI สำหรับ Refine Haus Clinic คลินิกความงามระดับพรีเมียม

## กฎสำคัญ:
1. **ตอบเป็นภาษาไทยเสมอ**
2. **ใช้ข้อมูลจากฐานข้อมูลเท่านั้น** - ห้ามเดาหรือสมมติตัวเลข
3. **แสดงตัวเลขให้ชัดเจน** - ใช้รูปแบบ ฿XX,XXX.XX สำหรับเงิน

## วิธีค้นหาข้อมูล:

### 📊 ยอดขาย (Sales/Revenue):
- ใช้ตาราง `sell_invoice`
- **ใช้ `final_amount`** สำหรับคำนวณรายได้ (ไม่ใช่ total_amount)
- **กรองเฉพาะ status ที่ไม่ใช่ 'void'**: `WHERE status::text != 'void'`
- **วันที่**: ใช้ `issue_at::date` เช่น `issue_at::date = CURRENT_DATE` สำหรับวันนี้
- ตัวอย่าง: `SELECT SUM(final_amount) FROM sell_invoice WHERE issue_at::date = CURRENT_DATE AND status::text != 'void'`

### 📦 สต็อกสินค้า (Stock/Inventory):
- ใช้ตาราง `item_catalog`
- **จำนวนคงเหลือ**: ดูจาก `current_qty`
- **แจ้งเตือนสต็อกต่ำ**: เมื่อ `current_qty <= restock_threshold`
- **ค้นหาสินค้า**: ใช้ `ILIKE` เช่น `WHERE name ILIKE '%ชื่อ%'`
- ตัวอย่าง: `SELECT name, current_qty, restock_threshold FROM item_catalog WHERE current_qty <= restock_threshold`

### 💆 ทรีตเมนต์ (Treatments/Services):
- ใช้ตาราง `treatment`
- มีข้อมูล: `name` (ชื่อ), `price` (ราคา)
- ตัวอย่าง: `SELECT name, price FROM treatment ORDER BY price DESC`

### 🏆 สินค้าขายดี (Best Sellers):
- JOIN ตาราง `sell_invoice_item` กับ `item_catalog`
- GROUP BY ชื่อสินค้า และ SUM จำนวน
- ตัวอย่าง:
```sql
SELECT ic.name, SUM(sii.qty) as total_sold, SUM(sii.total_price) as total_revenue
FROM sell_invoice_item sii
JOIN item_catalog ic ON sii.item_id = ic.item_id
JOIN sell_invoice si ON sii.sell_invoice_id = si.sell_invoice_id
WHERE si.status::text != 'void'
GROUP BY ic.name
ORDER BY total_sold DESC
LIMIT 10
```

### 👤 ลูกค้า (Customers):
- ใช้ตาราง `customer`
- มีข้อมูล: `full_name`, `nickname`, `member_wallet_remain` (เงินในกระเป๋า)

## รูปแบบการตอบ:
1. **ตอบตรงประเด็น** - บอกตัวเลขก่อน แล้วค่อยอธิบาย
2. **จัดรูปแบบสวยงาม** - ใช้หัวข้อ, bullet points
3. **ให้ insight เพิ่มเติม** - วิเคราะห์แนวโน้ม, แนะนำการดำเนินการ

## ข้อควรระวัง:
- **Enum types**: Cast เป็น `::text` เสมอ เช่น `status::text`, `item_type::text`
- **วันที่**: Cast เป็น `::date` เมื่อเปรียบเทียบวัน เช่น `issue_at::date`
- **ค้นหาชื่อ**: ใช้ `ILIKE` แทน `=` เพื่อไม่สนใจตัวพิมพ์ใหญ่-เล็ก

## ตัวอย่างการตอบ:
❓ "ยอดขายวันนี้เท่าไหร่"
✅ "ยอดขายวันนี้ (15 ม.ค. 2568) อยู่ที่ **฿45,800.00** จากทั้งหมด 12 รายการ

📈 **สรุป:**
- รายการสูงสุด: ฿8,500
- รายการต่ำสุด: ฿1,200
- เฉลี่ยต่อรายการ: ฿3,816.67"
"""

# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class ChatRequest(BaseModel):
    """Request body for chat endpoint."""
    message: str

    class Config:
        json_schema_extra = {
            "example": {
                "message": "ยอดขายวันนี้เท่าไหร่"
            }
        }


class ChatResponse(BaseModel):
    """Response body for chat endpoint."""
    answer: str
    query: Optional[str] = None
    timestamp: str

    class Config:
        json_schema_extra = {
            "example": {
                "answer": "ยอดขายวันนี้อยู่ที่ ฿45,800.00",
                "query": "SELECT SUM(final_amount) FROM sell_invoice WHERE issue_at::date = CURRENT_DATE",
                "timestamp": "2025-01-29T10:30:00"
            }
        }


# =============================================================================
# LANGCHAIN SQL AGENT SETUP
# =============================================================================

def create_sql_agent_executor():
    """
    Create LangChain SQL Agent with GPT-4o.

    This agent can:
    - Query the database directly
    - Understand natural language (Thai)
    - Generate and execute SQL
    - Return human-readable answers
    """
    logger.info("Initializing LangChain SQL Agent...")

    # 1. Create LLM instance (GPT-4o with temperature=0 for accuracy)
    llm = ChatOpenAI(
        model="gpt-4o",
        temperature=0,  # Strict mode - no creativity for numbers
        openai_api_key=OPENAI_API_KEY
    )

    # 2. Connect to Supabase PostgreSQL
    # Note: Using connect_args to handle Supabase connection properly
    db = SQLDatabase.from_uri(
        DATABASE_URL,
        include_tables=[
            "customer",
            "item_catalog",
            "sell_invoice",
            "sell_invoice_item",
            "treatment"
        ],
        sample_rows_in_table_info=3  # Include sample data for better context
    )

    logger.info(f"Connected to database. Tables: {db.get_usable_table_names()}")

    # 3. Create SQL Agent with custom prompt
    agent_executor = create_sql_agent(
        llm=llm,
        db=db,
        verbose=True,  # Log SQL queries for debugging
        prefix=SYSTEM_PROMPT,
        agent_executor_kwargs={
            "handle_parsing_errors": True,
            "return_intermediate_steps": True  # Return SQL query used
        }
    )

    logger.info("✅ SQL Agent initialized successfully")
    return agent_executor


# Global agent instance (initialized on startup)
sql_agent = None


# =============================================================================
# FASTAPI APPLICATION
# =============================================================================

def create_app() -> FastAPI:
    """Create and configure FastAPI application."""

    app = FastAPI(
        title="Refine Haus Clinic - AI Chatbot API",
        description="Business Intelligence Assistant for Beauty Clinic (Thai Language)",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc"
    )

    # GZip compression for responses
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    # CORS - Allow all origins for development
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Allow all origins
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Startup event - Initialize SQL Agent
    @app.on_event("startup")
    async def startup():
        global sql_agent
        try:
            sql_agent = create_sql_agent_executor()
            logger.info("🚀 Application started successfully")
        except Exception as e:
            logger.error(f"❌ Failed to initialize SQL Agent: {e}")
            raise

    # Health check endpoint
    @app.get("/health")
    async def health_check():
        """Check if the API is running."""
        return {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "agent_ready": sql_agent is not None
        }

    # Main chat endpoint
    @app.post("/chat", response_model=ChatResponse)
    async def chat(request: ChatRequest):
        """
        Chat with the AI Business Intelligence Assistant.

        Send a message in Thai and receive insights about:
        - Sales (ยอดขาย)
        - Stock/Inventory (สต็อก)
        - Treatments (ทรีตเมนต์)
        - Best sellers (สินค้าขายดี)
        - Customers (ลูกค้า)
        """
        if sql_agent is None:
            raise HTTPException(
                status_code=503,
                detail="AI Agent is not ready. Please try again later."
            )

        try:
            logger.info(f"📩 Received message: {request.message}")

            # Execute the agent
            result = sql_agent.invoke({"input": request.message})

            # Extract the answer
            answer = result.get("output", "ขออภัย ไม่สามารถตอบคำถามได้")

            # Extract SQL query from intermediate steps (if available)
            sql_query = None
            intermediate_steps = result.get("intermediate_steps", [])
            for step in intermediate_steps:
                if len(step) >= 2:
                    action = step[0]
                    if hasattr(action, 'tool_input'):
                        tool_input = action.tool_input
                        if isinstance(tool_input, dict) and 'query' in tool_input:
                            sql_query = tool_input['query']
                        elif isinstance(tool_input, str) and 'SELECT' in tool_input.upper():
                            sql_query = tool_input

            logger.info(f"✅ Response generated successfully")

            return ChatResponse(
                answer=answer,
                query=sql_query,
                timestamp=datetime.now().isoformat()
            )

        except Exception as e:
            logger.error(f"❌ Error processing message: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Error processing your request: {str(e)}"
            )

    # API info endpoint
    @app.get("/")
    async def root():
        """API information."""
        return {
            "name": "Refine Haus Clinic AI Chatbot",
            "version": "1.0.0",
            "description": "Business Intelligence Assistant (Thai Language)",
            "endpoints": {
                "POST /chat": "Send a message to the AI",
                "GET /health": "Health check",
                "GET /docs": "Swagger UI documentation"
            },
            "example_questions": [
                "ยอดขายวันนี้เท่าไหร่",
                "สินค้าไหนขายดีที่สุด",
                "สต็อกสินค้าตัวไหนใกล้หมด",
                "มีทรีตเมนต์อะไรบ้าง",
                "รายได้เดือนนี้เท่าไหร่"
            ]
        }

    return app


# Create app instance
app = create_app()


# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
