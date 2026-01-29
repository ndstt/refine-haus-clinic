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
from typing import List, Optional
from datetime import datetime
import uuid

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# --- Supabase Imports (ส่วนที่เพิ่มมา) ---
from supabase import create_client, Client

# --- LangChain Imports (ส่วนเดิม) ---
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
# ⚙️ CONFIGURATION
# =============================================================================

# 1. Database for AI to Query (PostgreSQL)
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DB_USER = os.getenv("DB_USER", "postgres")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_NAME = os.getenv("DB_NAME", "postgres")
    DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# 2. OpenAI Key
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# 3. Supabase Config (สำหรับเก็บ History) - ใส่ของตัวเองตรงนี้
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://maexprgkgpfveepayfug.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "sb_publishable_XxoMC1ciyCp7_qq6XVkJ9Q_1I4cOTlP")

# Initialize Supabase Client
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    logger.error(f"Error connecting to Supabase: {e}")
    supabase = None

# =============================================================================
# SYSTEM PROMPT (ส่วนเดิม ไม่แก้ไข)
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
# PYDANTIC MODELS (รวมร่าง)
# =============================================================================

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None # รองรับการส่ง Session ID มาเพื่อคุยต่อ

class ChatResponse(BaseModel):
    answer: str
    query: Optional[str] = None
    timestamp: str
    session_id: str  # เพิ่มกลับมาเพื่อบอก Frontend
    title: str       # เพิ่มกลับมาเพื่อ update sidebar

class Message(BaseModel):
    role: str
    text: str

class SessionSummary(BaseModel):
    id: str
    title: str

# =============================================================================
# LANGCHAIN AGENT SETUP (ส่วนเดิม ไม่แก้ไข)
# =============================================================================

def create_sql_agent_executor():
    logger.info("Initializing LangChain SQL Agent...")
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY is required")

    llm = ChatOpenAI(model="gpt-4o", temperature=0, openai_api_key=OPENAI_API_KEY)
    
    db = SQLDatabase.from_uri(
        DATABASE_URL,
        include_tables=["customer", "item_catalog", "sell_invoice", "sell_invoice_item", "treatment"],
        sample_rows_in_table_info=3
    )

    return create_sql_agent(
        llm=llm,
        db=db,
        verbose=True,
        prefix=SYSTEM_PROMPT,
        agent_executor_kwargs={
            "handle_parsing_errors": True,
            "return_intermediate_steps": True
        }
    )

sql_agent = None

# =============================================================================
# FASTAPI APP
# =============================================================================

def create_app() -> FastAPI:
    app = FastAPI(title="Refine Haus Clinic AI")
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    async def startup():
        global sql_agent
        try:
            sql_agent = create_sql_agent_executor()
            logger.info("🚀 AI Agent Ready")
        except Exception as e:
            logger.error(f"❌ Agent Init Failed: {e}")

    # ---------------------------------------------------------
    # 🆕 ENDPOINT: ดึงรายชื่อแชท (Supabase)
    # ---------------------------------------------------------
    @app.get("/chats", response_model=List[SessionSummary])
    async def get_chats():
        if not supabase: return []
        response = supabase.table("chats").select("id, title").order("created_at", desc=True).execute()
        return response.data

    # ---------------------------------------------------------
    # 🆕 ENDPOINT: ดึงประวัติข้อความ (Supabase)
    # ---------------------------------------------------------
    @app.get("/chats/{session_id}", response_model=List[Message])
    async def get_chat_history(session_id: str):
        if not supabase: return []
        response = supabase.table("messages").select("role, text").eq("chat_id", session_id).order("created_at", desc=False).execute()
        if not response.data and response.data != []:
            raise HTTPException(status_code=404, detail="Chat not found")
        return response.data

    # ---------------------------------------------------------
    # 🔥 MAIN CHAT ENDPOINT (รวมร่าง AI + Supabase)
    # ---------------------------------------------------------
    @app.post("/chat", response_model=ChatResponse)
    async def chat(request: ChatRequest):
        if sql_agent is None:
            raise HTTPException(status_code=503, detail="AI Agent not ready")

        # 1. AI PROCESSING (ส่วนเดิมของคุณ)
        # -----------------------------------------------------
        try:
            # เรียก Agent ให้คิดคำตอบ
            result = sql_agent.invoke({"input": request.message})
            answer = result.get("output", "ขออภัย ไม่สามารถตอบคำถามได้")
            
            # ดึง SQL Query ออกมา (ถ้ามี)
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

        except Exception as e:
            logger.error(f"AI Error: {e}")
            answer = "เกิดข้อผิดพลาดในการประมวลผล"
            sql_query = None

        # 2. SUPABASE SAVING (ส่วนที่เพิ่มเข้าไป)
        # -----------------------------------------------------
        session_id = request.session_id
        title = ""

        if supabase:
            try:
                # กรณี New Chat: สร้าง Session ใหม่
                if not session_id:
                    title = request.message[:30] + "..." if len(request.message) > 30 else request.message
                    res_chat = supabase.table("chats").insert({"title": title}).execute()
                    session_id = res_chat.data[0]['id']
                else:
                    # กรณี Chat เดิม: (Optional) อาจจะดึง title เก่ามาคืนค่าถ้าต้องการ
                    pass

                # บันทึกบทสนทนา (User + AI)
                messages_to_insert = [
                    {"chat_id": session_id, "role": "user", "text": request.message},
                    {"chat_id": session_id, "role": "assistant", "text": answer}
                ]
                supabase.table("messages").insert(messages_to_insert).execute()
                
            except Exception as e:
                logger.error(f"Supabase Save Error: {e}")
                # ถ้าบันทึกไม่ได้ ก็ให้สร้าง fake session_id กลับไปเพื่อไม่ให้แอปพัง
                if not session_id: session_id = str(uuid.uuid4())
                title = "Error Saving Chat"

        # 3. RETURN RESPONSE
        return ChatResponse(
            answer=answer,
            query=sql_query,
            timestamp=datetime.now().isoformat(),
            session_id=session_id,
            title=title if title else "Chat"
        )

    return app

app = create_app()

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)