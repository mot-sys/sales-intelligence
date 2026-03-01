# Getting Started with Signal Intelligence - Guide for Claude Code

**Welcome!** This is a comprehensive starter codebase for an AI-powered sales intelligence platform. Everything is structured and ready for you to expand.

## 📋 What's Been Built

### ✅ Complete Structure
- **Backend API**: FastAPI with async support
- **Database Models**: Full SQLAlchemy schema (PostgreSQL)
- **ML Scoring**: Rule-based lead scoring engine (ready to upgrade to ML)
- **API Routes**: Stubs for all core features (Leads, Analysis, Outbound, Connections, Auth)
- **Integration Framework**: Base classes for external APIs
- **Docker Setup**: One-command environment setup
- **Documentation**: PRD, Architecture, and API docs

### 🎯 Current State
This is a **functional MVP scaffold**. Core architecture is solid, but most endpoints return mock data or TODOs. Your job is to implement the real functionality.

## 🚀 Quick Start (First 5 Minutes)

```bash
# 1. Start infrastructure
docker-compose up -d postgres redis

# 2. Setup backend
cd backend
cp .env.example .env
# Edit .env with your API keys

python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 3. Run database migrations
alembic upgrade head

# 4. Start API server
uvicorn app.main:app --reload --port 8000

# 5. Test it
# Visit: http://localhost:8000/docs
```

## 📊 Priority Implementation Order

### Week 1: Core Data Flow
**Goal**: Get leads flowing from integrations into database with scores.

1. **Implement Clay Integration** (`app/integrations/clay.py`)
   - Use Clay API to fetch enriched companies
   - Map to Lead model
   - Test connection endpoint works

2. **Implement Leads API** (`app/api/leads.py`)
   - GET /leads - query database, return real data
   - GET /leads/{id} - fetch lead + signals
   - POST /leads/{id}/score - trigger scoring

3. **Connect Scoring Engine** 
   - Hook up `app/ml/scorer.py` to lead endpoints
   - Store scores in database
   - Generate recommendations

4. **Database CRUD Operations** (`app/db/crud.py` - create this file)
   - create_lead()
   - get_leads()
   - update_lead_score()
   - create_signals()

**Test**: Can you create a lead via Clay, score it, and see it in GET /leads?

### Week 2: Analysis & Intelligence
**Goal**: Dashboard shows real metrics and insights.

1. **Implement Analysis Endpoints** (`app/api/analysis.py`)
   - Dashboard metrics from database queries
   - Signal breakdown (COUNT by type)
   - Activity trends (last 7 days)

2. **AI Insights Generator**
   - Use OpenAI to analyze trends
   - Generate actionable insights
   - Example: "3 high-value leads visited pricing this week"

3. **Historical Patterns**
   - Query conversion_data table
   - Calculate conversion rates by signal combo
   - Display in analysis endpoint

**Test**: Does dashboard show accurate counts? Do insights make sense?

### Week 3: Integrations & Syncing
**Goal**: All 4 integrations working with automated syncing.

1. **Salesforce Integration** (`app/integrations/salesforce.py`)
   - Fetch opportunities/leads
   - Store as conversion_data for ML training
   - Test connection

2. **Snitcher Integration** (`app/integrations/snitcher.py`)
   - Fetch website visitors
   - Create intent signals
   - Link to existing leads by domain

3. **Outreach.io Integration** (`app/integrations/outreach.py`)
   - Push leads to sequences
   - Track email/call activity
   - Update lead status

4. **Background Jobs** (`app/utils/tasks.py` - create with Celery)
   - Scheduled syncing (every 2h/6h/daily)
   - Async scoring for bulk leads
   - Error handling + retry logic

**Test**: Can you connect all 4 services? Does syncing work automatically?

### Week 4: Outbound & Actions
**Goal**: Users can act on recommendations.

1. **Outbound Queue** (`app/api/outbound.py`)
   - Return hot/warm leads sorted by score
   - Include AI recommendations
   - Filter by various criteria

2. **Outbound Actions**
   - Add to Outreach sequence (call Outreach API)
   - Skip lead
   - Track actions in outbound_actions table

3. **Recommendation Logic**
   - Enhance `app/ml/scorer.py` recommendations
   - Use historical conversion data
   - A/B test different approaches

**Test**: Can an SDR process the queue efficiently? Do actions work?

## 🔧 Key Implementation Patterns

### Pattern 1: Implementing an Integration

```python
# app/integrations/clay.py
from .base import BaseIntegration

class ClayIntegration(BaseIntegration):
    BASE_URL = "https://api.clay.com/v1"
    
    async def test_connection(self) -> bool:
        try:
            await self._make_request(
                "GET",
                f"{self.BASE_URL}/tables",
                headers=self._get_headers()
            )
            return True
        except:
            return False
    
    async def sync_data(self) -> List[Dict]:
        tables = await self._make_request(
            "GET",
            f"{self.BASE_URL}/tables",
            headers=self._get_headers()
        )
        # Map to Lead model format
        return [self._map_to_lead(row) for table in tables for row in table["rows"]]
    
    def _get_headers(self):
        return {"Authorization": f"Bearer {self.credentials['api_key']}"}
```

### Pattern 2: Database CRUD with AsyncSession

```python
# app/db/crud.py
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import Lead

async def get_leads(
    db: AsyncSession,
    customer_id: str,
    skip: int = 0,
    limit: int = 100
) -> List[Lead]:
    result = await db.execute(
        select(Lead)
        .where(Lead.customer_id == customer_id)
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()

async def create_lead(db: AsyncSession, lead_data: Dict) -> Lead:
    lead = Lead(**lead_data)
    db.add(lead)
    await db.commit()
    await db.refresh(lead)
    return lead
```

### Pattern 3: API Endpoint with Real Data

```python
# app/api/leads.py
@router.get("/")
async def get_leads(
    db: AsyncSession = Depends(get_db),
    priority: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
):
    # Get customer_id from auth (TODO: implement auth)
    customer_id = "temp-uuid"
    
    # Query with filters
    query = select(Lead).where(Lead.customer_id == customer_id)
    if priority:
        query = query.where(Lead.priority == priority)
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    leads = result.scalars().all()
    
    # Get total count
    count_query = select(func.count(Lead.id)).where(Lead.customer_id == customer_id)
    if priority:
        count_query = count_query.where(Lead.priority == priority)
    total = await db.scalar(count_query)
    
    return {
        "total": total,
        "leads": [lead.__dict__ for lead in leads],
        "page": skip // limit + 1
    }
```

## 🎯 Key Files to Implement

### High Priority (Do These First)
1. `app/db/crud.py` - Database operations
2. `app/integrations/clay.py` - Clay API client
3. `app/api/leads.py` - Complete lead endpoints
4. `app/api/analysis.py` - Dashboard metrics
5. `app/core/security.py` - JWT authentication

### Medium Priority (Week 2-3)
1. `app/integrations/salesforce.py` - Salesforce client
2. `app/integrations/snitcher.py` - Snitcher client  
3. `app/integrations/outreach.py` - Outreach client
4. `app/utils/tasks.py` - Celery background jobs
5. `app/api/connections.py` - Integration management

### Low Priority (Polish)
1. `frontend/` - React UI (prototype exists in /outputs)
2. `tests/` - Comprehensive test suite
3. `alembic/versions/` - More migrations
4. `app/ml/models.py` - Advanced ML models
5. Monitoring, logging, error tracking

## 🧪 Testing Strategy

```bash
# Unit tests
pytest tests/unit

# Integration tests (requires running services)
docker-compose up -d
pytest tests/integration

# Test specific module
pytest tests/unit/test_scorer.py -v

# With coverage
pytest --cov=app tests/
```

## 📝 Common Tasks

### Add a New API Endpoint
1. Define route in appropriate `app/api/*.py` file
2. Add database queries in `app/db/crud.py`
3. Update API documentation
4. Write tests

### Add a New Integration
1. Create `app/integrations/your_service.py`
2. Extend `BaseIntegration`
3. Implement: `test_connection()`, `sync_data()`, `push_data()`
4. Add connection endpoint in `app/api/connections.py`
5. Test with real API keys

### Modify Scoring Logic
1. Edit `app/ml/scorer.py`
2. Update `_score_signals()` or `_score_intent()`
3. Test with sample leads
4. Consider A/B testing changes

### Add Database Migration
```bash
# Create migration
alembic revision --autogenerate -m "add new column"

# Apply migration
alembic upgrade head

# Rollback
alembic downgrade -1
```

## ⚠️ Important Notes

### Authentication
Currently NOT implemented. All endpoints are open. Priority task:
1. Implement JWT in `app/core/security.py`
2. Add `get_current_user()` dependency
3. Protect all endpoints except /auth/*

### Error Handling
Add try/catch blocks and proper error responses:
```python
try:
    lead = await crud.get_lead(db, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    return lead
except Exception as e:
    logger.error(f"Error fetching lead: {e}")
    raise HTTPException(500, "Internal server error")
```

### Rate Limiting
Implement Redis-based rate limiting for external APIs to avoid hitting limits.

### Encryption
Credentials in database should be encrypted. Use `cryptography` library:
```python
from cryptography.fernet import Fernet
cipher = Fernet(settings.SECRET_KEY.encode())
encrypted = cipher.encrypt(api_key.encode())
```

## 🐛 Known TODOs in Code

Search for `# TODO:` comments throughout the codebase. Priority TODOs:

1. `app/main.py` - Implement proper health checks
2. `app/api/*.py` - Replace mock data with real queries
3. `app/core/security.py` - Implement JWT authentication
4. `app/integrations/*.py` - Implement all integration clients
5. Database migrations - Create initial schema

## 📚 Resources

- **FastAPI Docs**: https://fastapi.tiangolo.com
- **SQLAlchemy Async**: https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html
- **Clay API**: https://docs.clay.com
- **Salesforce API**: https://developer.salesforce.com/docs/apis
- **Pydantic**: https://docs.pydantic.dev

## 🎯 Success Criteria

### MVP Ready When:
- [ ] Can connect all 4 integrations (Clay, SF, Snitcher, Outreach)
- [ ] Leads sync automatically and get scored
- [ ] Dashboard shows accurate real-time metrics
- [ ] Outbound queue returns prioritized leads with recommendations
- [ ] Can add leads to Outreach sequences
- [ ] Authentication works (JWT)
- [ ] Docker deployment works end-to-end

### Production Ready When:
- [ ] All above + comprehensive tests (>80% coverage)
- [ ] Error handling and logging throughout
- [ ] Rate limiting on all endpoints
- [ ] Database properly indexed and optimized
- [ ] Security audit passed
- [ ] Monitoring and alerting set up
- [ ] Documentation complete

## 💡 Tips for Claude Code

1. **Start Small**: Implement one integration at a time, test it works
2. **Follow Patterns**: Use existing code style and patterns
3. **Test as You Go**: Don't build too much before testing
4. **Read the Docs**: Check PRD.md and ARCHITECTURE.md for context
5. **Ask Questions**: If unclear, ask for clarification
6. **Incremental**: Make small commits, test often

---

**You're ready to build! Start with Clay integration and leads API. Good luck! 🚀**
