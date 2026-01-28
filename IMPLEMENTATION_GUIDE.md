# Clinic AI Assistant Implementation Guide

## 🎯 Overview

Your Refine Haus Clinic now has a fully integrated AI chatbot named **LUMINA** (Light of Understanding and Management Intelligence for Next-generation Analytics). This guide walks you through deployment and usage.

---

## 📋 What Was Built

### 1. **Backend Services** (Python FastAPI + LangChain)

#### Core AI Components:
- **OpenAI Service** ([backend/app/services/llm/openai_service.py](backend/app/services/llm/openai_service.py))
  - GPT-4o-mini integration via LangChain
  - Context-aware responses with conversation history
  - Streaming support for real-time UX

- **Embedding Service** ([backend/app/services/embedding_service.py](backend/app/services/embedding_service.py))
  - OpenAI text-embedding-ada-002 (1536 dimensions)
  - Vector storage in pgvector
  - Semantic similarity search

- **Hybrid Retrieval Service** ([backend/app/services/retrieval_service.py](backend/app/services/retrieval_service.py))
  - Intelligent query routing (SQL vs Vector)
  - Combines structured data + semantic search

#### LangChain Tools:
- **Financial Analysis Tool** ([backend/app/agents/tools/database_tools.py](backend/app/agents/tools/database_tools.py:30-130))
  - Revenue, expenses, profit/loss calculations
  - Top services analysis
  - Time-based queries (today, this week, this month, etc.)

- **Inventory Analysis Tool** ([backend/app/agents/tools/database_tools.py:133-240))
  - Stock levels monitoring
  - Low stock alerts
  - Dead stock detection (unused items)

- **Service Analysis Tool** ([backend/app/agents/tools/database_tools.py:243-340))
  - Service catalog
  - Popular services ranking
  - Booking statistics

#### Agent Runner:
- **AgentRunner Class** ([backend/app/agents/runner.py](backend/app/agents/runner.py))
  - Orchestrates hybrid retrieval + LLM
  - Conversation persistence to database
  - History management

#### System Prompt:
- **LUMINA Persona** ([backend/app/agents/prompts/system.md](backend/app/agents/prompts/system.md))
  - Business consultant behavior
  - Data-driven analysis methodology
  - Strategic recommendation framework

### 2. **Database Schema**

#### New Tables:
- **chat_embeddings** ([backend/app/db/vector_setup.sql](backend/app/db/vector_setup.sql:19-27))
  - Stores vector embeddings for RAG
  - pgvector extension enabled
  - IVFFlat index for fast similarity search

#### Existing Tables (Already in Your DB):
- **conversations**: Stores chat sessions
- **messages**: Stores individual messages
- **sell_invoice**: Revenue data
- **item_catalog**: Inventory data
- **treatment**: Service data

### 3. **API Endpoints**

Updated chat routes ([backend/app/api/routes/chat.py](backend/app/api/routes/chat.py)):

- `POST /api/v1/chat` - Send message to AI
- `GET /api/v1/chat/conversations` - List all conversations
- `GET /api/v1/chat/conversations/{id}` - Get conversation with messages
- `DELETE /api/v1/chat/conversations/{id}` - Delete conversation

---

## 🚀 Deployment Steps

### Step 1: Set Up Supabase Database

1. **Open Supabase SQL Editor**
   - Go to your Supabase project dashboard
   - Navigate to "SQL Editor"

2. **Run Vector Setup Script**
   ```sql
   -- Copy and paste content from:
   backend/app/db/vector_setup.sql
   ```
   This will:
   - Enable pgvector extension
   - Create chat_embeddings table
   - Add indexes for fast search

### Step 2: Configure Environment Variables

1. **Add OpenAI API Key to `.env`**
   ```bash
   # Your existing .env already has DB credentials
   # Add these lines:

   OPENAI_API_KEY=sk-your-actual-openai-api-key-here
   OPENAI_MODEL=gpt-4o-mini
   ```

2. **Get OpenAI API Key**
   - Visit https://platform.openai.com/api-keys
   - Create a new key
   - Replace `sk-your-actual-openai-api-key-here` with your key

### Step 3: Install Dependencies

```bash
cd backend
uv sync
```

This will install:
- langchain-openai
- langchain-community
- langchain-postgres
- pgvector
- psycopg2-binary
- openai
- tiktoken

### Step 4: Seed Sample Embeddings (Optional but Recommended)

```bash
cd backend
uv run python seed_embeddings.py
```

This populates the vector database with clinic knowledge for better AI responses about:
- Service recommendations
- Promotion strategies
- Inventory management tips
- Best practices

**Expected Output:**
```
🌱 Starting embedding seed process...
📚 Seeding 15 knowledge items...
✅ Successfully seeded 15 embeddings!
   Embedding IDs: [1, 2, 3, 4, 5]...

🔍 Testing semantic search...
   Query: 'How should I handle slow-moving products?'
   Found 3 results:
      1. [0.85] Dead stock recommendations: Items unused for 30+ days...
```

### Step 5: Start Backend Server

**Development Mode:**
```bash
# Using Docker Compose (recommended)
docker-compose -f docker-compose.dev.yml up backend

# OR using uv directly
cd backend
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Verify Backend is Running:**
- Open http://localhost:8000/docs
- You should see FastAPI Swagger UI with chat endpoints

### Step 6: Test the API

**Using curl:**
```bash
# Test chat endpoint
curl -X POST http://localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What was our revenue this month?"}'
```

**Expected Response:**
```json
{
  "response": "Your total revenue for January 2025 is **$X,XXX**...",
  "conversation_id": 1
}
```

**Using Swagger UI:**
1. Go to http://localhost:8000/docs
2. Expand `POST /api/v1/chat`
3. Click "Try it out"
4. Enter request body:
   ```json
   {
     "message": "Show me low stock items"
   }
   ```
5. Click "Execute"

---

## 🧪 Testing the AI

### Sample Queries to Try:

#### Financial Queries:
- "What was our total revenue this month?"
- "Show me profit and loss for this week"
- "Which service generates the most revenue?"

#### Inventory Queries:
- "What items are running low?"
- "Show me dead stock products"
- "Check stock level for Botox"

#### Service Queries:
- "List all available treatments"
- "What are our most popular services?"
- "Tell me about laser treatments"

#### Strategic Queries (Semantic Search):
- "Suggest a promotion for skincare products"
- "How can I increase customer retention?"
- "What's the best time to run promotions?"

---

## 🔧 Troubleshooting

### Issue: "OPENAI_API_KEY not found"
**Solution:** Ensure `.env` file has the API key and restart the server.

### Issue: "pgvector extension not found"
**Solution:** Run the [backend/app/db/vector_setup.sql](backend/app/db/vector_setup.sql) script in Supabase SQL Editor.

### Issue: "Table chat_embeddings does not exist"
**Solution:** Same as above - run vector_setup.sql.

### Issue: Import errors (fastapi, langchain)
**Solution:**
```bash
cd backend
uv sync
# If still failing, try:
rm -rf .venv
uv sync
```

### Issue: "AgentRunner not initialized"
**Solution:** Ensure [backend/app/main.py](backend/app/main.py:28-33) has the startup event that calls `initialize_runner()`.

### Issue: Empty/generic responses
**Solution:**
1. Check if embeddings are seeded: Run `seed_embeddings.py`
2. Verify database has actual data (invoices, inventory, services)
3. Check OpenAI API key is valid

---

## 📊 How the AI Works

### Query Flow:

```
User Message
    ↓
Hybrid Retrieval Service
    ├── Classify query type (financial, inventory, service, semantic)
    ↓
    ├── SQL Tools → Direct database queries for numbers/facts
    │   ├── Financial Tool → Revenue, expenses, profit
    │   ├── Inventory Tool → Stock levels, low stock
    │   └── Service Tool → Service catalog, popularity
    │
    └── Vector Search → Semantic similarity for recommendations
        └── Embedding Service → Search chat_embeddings
    ↓
Context Assembly
    ↓
OpenAI GPT-4o-mini + System Prompt (LUMINA)
    ↓
Response Generation
    ↓
Database Persistence (conversations + messages tables)
    ↓
Return to User
```

### Why Hybrid Retrieval?

**SQL Queries** (for accuracy):
- "What was revenue in March?" → Requires precise calculation from sell_invoice table
- "How many Botox units in stock?" → Needs exact count from item_catalog

**Vector Search** (for recommendations):
- "Suggest a promotion for slow-moving items" → Semantic understanding needed
- "How can I improve customer retention?" → Requires strategic knowledge

The system automatically routes queries to the right method!

---

## 🎨 Frontend Integration (Next Step)

The frontend [ChatPage](frontend/src/components/chatPage.jsx) is already built but needs API integration.

**Update needed:**
1. Replace hardcoded sample data with API calls to `/api/v1/chat`
2. Load conversations from `/api/v1/chat/conversations`
3. Display real messages from backend

**Example API integration** (in React):
```javascript
const sendMessage = async (message) => {
  const response = await fetch('http://localhost:8000/api/v1/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, conversation_id: currentConvId })
  });

  const data = await response.json();
  setMessages([...messages, { role: 'assistant', content: data.response }]);
};
```

---

## 📈 Monitoring & Optimization

### Check Database Usage:
```sql
-- See conversation count
SELECT COUNT(*) FROM conversations;

-- See message count
SELECT COUNT(*) FROM messages;

-- See embedding count
SELECT COUNT(*) FROM chat_embeddings;

-- Check recent conversations
SELECT * FROM conversations ORDER BY updated_at DESC LIMIT 10;
```

### Monitor OpenAI Costs:
- Visit https://platform.openai.com/usage
- GPT-4o-mini is very cost-effective:
  - Input: $0.15 per 1M tokens
  - Output: $0.60 per 1M tokens
  - Embeddings: $0.020 per 1M tokens

**Typical conversation cost:** ~$0.001 - $0.005 per exchange

---

## 🔐 Security Considerations

1. **API Key Security**
   - Never commit `.env` to Git (already in .gitignore)
   - Use environment variables in production
   - Rotate keys regularly

2. **Database Access**
   - Use Row Level Security (RLS) in Supabase if multi-tenant
   - Limit API access with authentication middleware (future enhancement)

3. **CORS Configuration**
   - Currently allows localhost:5173 (dev)
   - Update [backend/app/main.py:21-27](backend/app/main.py:21-27) for production domain

---

## 📚 Code Reference

### Key Files Created/Modified:

**Services:**
- [backend/app/services/llm/openai_service.py](backend/app/services/llm/openai_service.py) - OpenAI LLM integration
- [backend/app/services/embedding_service.py](backend/app/services/embedding_service.py) - Vector embeddings
- [backend/app/services/retrieval_service.py](backend/app/services/retrieval_service.py) - Hybrid retrieval

**Tools:**
- [backend/app/agents/tools/database_tools.py](backend/app/agents/tools/database_tools.py) - LangChain SQL tools

**Core:**
- [backend/app/agents/runner.py](backend/app/agents/runner.py) - Main orchestrator
- [backend/app/agents/prompts/system.md](backend/app/agents/prompts/system.md) - LUMINA persona

**API:**
- [backend/app/api/routes/chat.py](backend/app/api/routes/chat.py) - Chat endpoints
- [backend/app/schemas/chat.py](backend/app/schemas/chat.py) - Request/response models

**Database:**
- [backend/app/db/vector_setup.sql](backend/app/db/vector_setup.sql) - pgvector setup

**Config:**
- [backend/config.py](backend/config.py) - Environment config
- [backend/pyproject.toml](backend/pyproject.toml) - Dependencies
- [.env](.env) - API keys (UPDATE THIS!)

**Utilities:**
- [backend/seed_embeddings.py](backend/seed_embeddings.py) - Seed script

---

## 🎓 Next Steps

1. **Deploy to Production**
   - Set up production environment variables
   - Deploy to cloud (Render, Railway, AWS, etc.)
   - Update CORS origins

2. **Add Authentication**
   - Protect chat endpoints with JWT
   - User-specific conversation isolation

3. **Enhance AI Capabilities**
   - Add more tools (customer analysis, appointment scheduling)
   - Implement multi-turn conversation memory
   - Add streaming responses for better UX

4. **Frontend Polish**
   - Connect ChatPage to backend API
   - Add loading states and error handling
   - Implement real-time typing indicators

---

## 💡 Tips for Best Results

1. **Keep Data Fresh**: Regularly update your database with real transactions
2. **Seed Context**: Add more clinic-specific knowledge to embeddings for better recommendations
3. **Tune Prompts**: Modify [system.md](backend/app/agents/prompts/system.md) to adjust AI behavior
4. **Monitor Usage**: Check OpenAI usage dashboard to optimize costs
5. **Test Regularly**: Use diverse queries to ensure accuracy

---

## 📞 Support

**Issues with Implementation?**
- Check [backend/app/main.py](backend/app/main.py) startup logs
- Verify database connection in Supabase dashboard
- Test OpenAI API key at https://platform.openai.com/playground

**Want to Customize?**
- Edit system prompt: [backend/app/agents/prompts/system.md](backend/app/agents/prompts/system.md)
- Add new tools: [backend/app/agents/tools/database_tools.py](backend/app/agents/tools/database_tools.py)
- Modify retrieval logic: [backend/app/services/retrieval_service.py](backend/app/services/retrieval_service.py)

---

**🎉 Congratulations!** Your clinic now has an intelligent AI assistant that can provide data-driven insights and strategic recommendations!
