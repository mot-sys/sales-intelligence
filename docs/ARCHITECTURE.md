# Technical Architecture
## Signal Intelligence Platform

**Version:** 1.0  
**Last Updated:** March 2026

---

## System Overview

Signal Intelligence is a cloud-native, multi-tenant SaaS platform built on modern Python and JavaScript frameworks. The architecture prioritizes:
- **Reliability**: 99.5% uptime through redundancy and graceful degradation
- **Performance**: Sub-500ms API responses through caching and optimization
- **Scalability**: Horizontal scaling to support 1000+ customers
- **Security**: Enterprise-grade data protection and compliance

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Web App     │  │  Mobile App  │  │  Public API  │     │
│  │  (React)     │  │  (Future)    │  │  (Future)    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            ↓ HTTPS
┌─────────────────────────────────────────────────────────────┐
│                     Load Balancer / CDN                      │
│                    (Cloudflare / AWS ALB)                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              FastAPI Backend (Python)                 │  │
│  │                                                        │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐    │  │
│  │  │ API Routes │  │  Business  │  │   Auth &   │    │  │
│  │  │  /leads    │  │   Logic    │  │  Security  │    │  │
│  │  │  /analysis │  │            │  │            │    │  │
│  │  └────────────┘  └────────────┘  └────────────┘    │  │
│  │                                                        │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐    │  │
│  │  │ ML Scoring │  │Integration │  │   Workers  │    │  │
│  │  │   Engine   │  │  Manager   │  │  (Celery)  │    │  │
│  │  └────────────┘  └────────────┘  └────────────┘    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  PostgreSQL  │  │  Redis Cache │  │   Vector DB  │     │
│  │  (Primary)   │  │  (Sessions,  │  │  (Embeddings)│     │
│  │              │  │   Rate Limit)│  │   (Pinecone) │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  External Services Layer                     │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │ Clay API   │  │ Salesforce │  │  Snitcher  │           │
│  └────────────┘  └────────────┘  └────────────┘           │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │ Outreach.io│  │  OpenAI    │  │   Stripe   │           │
│  └────────────┘  └────────────┘  └────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

---

## Backend Architecture (FastAPI)

### Directory Structure
```
backend/
├── app/
│   ├── main.py                 # FastAPI app initialization
│   ├── api/                    # API routes
│   │   ├── __init__.py
│   │   ├── leads.py           # Lead CRUD operations
│   │   ├── analysis.py        # Analysis & insights
│   │   ├── outbound.py        # Outbound queue & recommendations
│   │   ├── connections.py     # Integration management
│   │   └── auth.py            # Authentication endpoints
│   ├── core/                   # Core functionality
│   │   ├── config.py          # Settings & environment
│   │   ├── security.py        # Auth, JWT, encryption
│   │   └── dependencies.py    # Dependency injection
│   ├── db/                     # Database
│   │   ├── models.py          # SQLAlchemy ORM models
│   │   ├── session.py         # DB connection & session
│   │   └── crud.py            # CRUD operations
│   ├── integrations/           # External API clients
│   │   ├── __init__.py
│   │   ├── base.py            # Base integration class
│   │   ├── clay.py            # Clay API client
│   │   ├── salesforce.py      # Salesforce REST/SOQL
│   │   ├── snitcher.py        # Snitcher API client
│   │   └── outreach.py        # Outreach.io API client
│   ├── ml/                     # Machine learning
│   │   ├── __init__.py
│   │   ├── scorer.py          # Lead scoring engine
│   │   ├── models.py          # ML model definitions
│   │   ├── training.py        # Model training pipeline
│   │   └── features.py        # Feature engineering
│   ├── schemas/                # Pydantic models
│   │   ├── __init__.py
│   │   ├── lead.py            # Lead schemas
│   │   ├── signal.py          # Signal schemas
│   │   └── integration.py     # Integration schemas
│   └── utils/                  # Utilities
│       ├── __init__.py
│       ├── logger.py          # Logging setup
│       ├── cache.py           # Redis caching
│       └── tasks.py           # Background tasks (Celery)
├── tests/                      # Tests
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── alembic/                    # Database migrations
│   ├── versions/
│   └── env.py
├── requirements.txt
└── Dockerfile
```

### Core Technologies

**Framework**: FastAPI 0.110+
- Async/await support for high concurrency
- Automatic OpenAPI docs
- Fast JSON serialization (orjson)
- Pydantic data validation

**Database**: PostgreSQL 15+
- JSONB for flexible signal storage
- Full-text search (ts_vector)
- Partitioning for large tables
- Connection pooling (SQLAlchemy + asyncpg)

**Caching**: Redis 7+
- API response caching
- Rate limiting
- Session storage
- Pub/sub for real-time updates

**ML Stack**:
- scikit-learn 1.4+ (classification models)
- pandas 2.1+ (data manipulation)
- numpy 1.26+ (numerical operations)
- OpenAI API (GPT-4 for recommendations)

**Task Queue**: Celery 5+ with Redis
- Async data syncing
- Scheduled scoring jobs
- Email notifications

---

## Database Schema

### Core Tables

```sql
-- Customers (multi-tenant)
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    plan VARCHAR(50) NOT NULL, -- starter/pro/enterprise
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Integrations
CREATE TABLE integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    service VARCHAR(50) NOT NULL, -- clay/salesforce/snitcher/outreach
    status VARCHAR(20) NOT NULL, -- connected/error/disconnected
    credentials JSONB NOT NULL, -- Encrypted
    last_sync TIMESTAMP,
    sync_frequency VARCHAR(20) DEFAULT '2h', -- 2h/6h/daily
    config JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(customer_id, service)
);

-- Leads
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    
    -- Company info
    company_name VARCHAR(255) NOT NULL,
    company_domain VARCHAR(255),
    industry VARCHAR(100),
    employee_count INTEGER,
    revenue BIGINT,
    location VARCHAR(255),
    
    -- Contact info
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_title VARCHAR(255),
    contact_linkedin VARCHAR(500),
    
    -- Scoring
    score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
    priority VARCHAR(20), -- hot/warm/cold
    recommendation TEXT,
    
    -- Metadata
    source VARCHAR(50) NOT NULL, -- clay/salesforce/snitcher/outreach
    external_id VARCHAR(255), -- ID in source system
    last_activity TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_customer_score (customer_id, score DESC),
    INDEX idx_customer_priority (customer_id, priority),
    INDEX idx_company_name (customer_id, company_name),
    INDEX idx_last_activity (customer_id, last_activity DESC)
);

-- Signals
CREATE TABLE signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    
    type VARCHAR(50) NOT NULL, -- funding/hiring/tech_change/intent/content
    title VARCHAR(255) NOT NULL,
    description TEXT,
    score_impact INTEGER DEFAULT 0,
    
    source VARCHAR(50) NOT NULL,
    external_url VARCHAR(500),
    detected_at TIMESTAMP DEFAULT NOW(),
    
    metadata JSONB, -- Flexible storage for signal-specific data
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_lead_signals (lead_id, detected_at DESC),
    INDEX idx_customer_signals (customer_id, type, detected_at DESC)
);

-- Scoring History (for ML training)
CREATE TABLE scoring_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    
    score INTEGER NOT NULL,
    signals_present JSONB, -- Snapshot of signals at scoring time
    model_version VARCHAR(50),
    
    scored_at TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_customer_scoring (customer_id, scored_at DESC)
);

-- Outbound Actions
CREATE TABLE outbound_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    
    action_type VARCHAR(50) NOT NULL, -- add_to_sequence/skip/manual_outreach
    sequence_id VARCHAR(255), -- Outreach.io sequence ID
    status VARCHAR(50) NOT NULL, -- pending/completed/failed
    
    notes TEXT,
    performed_by UUID REFERENCES customers(id),
    
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    
    INDEX idx_customer_actions (customer_id, created_at DESC)
);

-- Conversion Data (for ML training)
CREATE TABLE conversion_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    
    outcome VARCHAR(50) NOT NULL, -- meeting_booked/deal_closed/lost/no_response
    revenue BIGINT, -- If deal closed
    days_to_conversion INTEGER,
    
    signals_at_scoring JSONB, -- Signals when lead was scored
    score_at_time INTEGER,
    
    outcome_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    
    INDEX idx_customer_conversions (customer_id, outcome, outcome_date DESC)
);
```

### Partitioning Strategy

For customers with >1M leads, partition tables by customer_id:
```sql
CREATE TABLE leads_partitioned (
    LIKE leads INCLUDING ALL
) PARTITION BY HASH (customer_id);

-- Create partitions
CREATE TABLE leads_partition_0 PARTITION OF leads_partitioned
    FOR VALUES WITH (MODULUS 10, REMAINDER 0);
-- Repeat for remainders 1-9
```

---

## Integration Architecture

### Base Integration Class
```python
# app/integrations/base.py
from abc import ABC, abstractmethod
from typing import Dict, List, Optional
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

class BaseIntegration(ABC):
    """Base class for all external integrations"""
    
    def __init__(self, credentials: Dict[str, str], config: Optional[Dict] = None):
        self.credentials = credentials
        self.config = config or {}
        self.client = httpx.AsyncClient(timeout=30.0)
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    async def _make_request(
        self, 
        method: str, 
        url: str, 
        **kwargs
    ) -> Dict:
        """Make HTTP request with retry logic"""
        response = await self.client.request(method, url, **kwargs)
        response.raise_for_status()
        return response.json()
    
    @abstractmethod
    async def test_connection(self) -> bool:
        """Test if credentials work"""
        pass
    
    @abstractmethod
    async def sync_data(self) -> List[Dict]:
        """Sync data from external service"""
        pass
    
    @abstractmethod
    async def push_data(self, data: Dict) -> bool:
        """Push data to external service"""
        pass
```

### Clay Integration
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
                headers={"Authorization": f"Bearer {self.credentials['api_key']}"}
            )
            return True
        except Exception:
            return False
    
    async def sync_data(self) -> List[Dict]:
        """Fetch enriched companies from Clay tables"""
        # Implementation details...
        pass
```

### Rate Limiting Strategy
```python
# Use Redis for distributed rate limiting
import redis.asyncio as redis
from datetime import timedelta

class RateLimiter:
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
    
    async def is_allowed(
        self, 
        key: str, 
        max_requests: int, 
        window: timedelta
    ) -> bool:
        """Check if request is allowed within rate limit"""
        current = await self.redis.incr(key)
        if current == 1:
            await self.redis.expire(key, window)
        return current <= max_requests
```

---

## ML Scoring Engine

### Architecture

```
Input Data (Lead + Signals)
         ↓
Feature Engineering
         ↓
    ┌─────────────────┐
    │ Rule-Based      │ ← MVP (Week 1-4)
    │ Scoring         │
    └─────────────────┘
         ↓
    ┌─────────────────┐
    │ Gradient Boost  │ ← Phase 2 (Week 5-8)
    │ Classifier      │
    └─────────────────┘
         ↓
    ┌─────────────────┐
    │ Cross-Customer  │ ← Phase 3 (Week 9-12)
    │ Transfer        │
    │ Learning        │
    └─────────────────┘
         ↓
Score (0-100) + Recommendation
```

### MVP Implementation (Rule-Based)
```python
# app/ml/scorer.py
from typing import Dict, List
from datetime import datetime, timedelta

class LeadScorer:
    def __init__(self):
        self.weights = {
            "firmographics": 0.2,
            "signals": 0.4,
            "intent": 0.3,
            "historical": 0.1
        }
    
    def score_lead(self, lead: Dict, signals: List[Dict]) -> int:
        """Calculate lead score (0-100)"""
        score = 0
        
        # Firmographics (20 points max)
        score += self._score_firmographics(lead)
        
        # Signals (40 points max)
        score += self._score_signals(signals)
        
        # Intent (30 points max)
        score += self._score_intent(signals)
        
        # Historical patterns (10 points max)
        score += self._score_historical(lead)
        
        return min(100, max(0, score))
    
    def _score_firmographics(self, lead: Dict) -> int:
        score = 0
        
        # ICP match
        if 50 <= lead.get("employee_count", 0) <= 500:
            score += 10
        
        # Industry match
        if lead.get("industry") in ["SaaS", "Technology", "Software"]:
            score += 10
        
        return score
    
    def _score_signals(self, signals: List[Dict]) -> int:
        score = 0
        now = datetime.utcnow()
        
        for signal in signals:
            signal_age = now - signal["detected_at"]
            
            # Recent signals worth more
            recency_multiplier = 1.0
            if signal_age < timedelta(days=7):
                recency_multiplier = 1.5
            elif signal_age < timedelta(days=30):
                recency_multiplier = 1.2
            
            # Signal-specific scoring
            if signal["type"] == "funding":
                score += int(25 * recency_multiplier)
            elif signal["type"] == "hiring" and "sales" in signal["title"].lower():
                score += int(20 * recency_multiplier)
            elif signal["type"] == "tech_change":
                score += int(15 * recency_multiplier)
        
        return min(40, score)
    
    def generate_recommendation(
        self, 
        lead: Dict, 
        signals: List[Dict],
        score: int
    ) -> str:
        """Generate AI recommendation based on signals"""
        
        signal_types = {s["type"] for s in signals}
        
        if "funding" in signal_types and "hiring" in signal_types:
            return "High-intent buyer. Contact within 24h. Lead with funding + scaling pain point."
        
        if "tech_change" in signal_types:
            return "Migration window open. Offer implementation support."
        
        if "hiring" in signal_types:
            return "Building sales team. Multi-touch nurture campaign recommended."
        
        if score >= 80:
            return "High priority lead. Personalized outreach recommended."
        elif score >= 60:
            return "Warm lead. Add to nurture sequence, monitor for intent spike."
        else:
            return "Low priority. Skip manual outreach, add to automated drip."
```

### Phase 2: ML Model
```python
from sklearn.ensemble import GradientBoostingClassifier
import pandas as pd

class MLLeadScorer:
    def __init__(self):
        self.model = GradientBoostingClassifier(
            n_estimators=100,
            learning_rate=0.1,
            max_depth=5
        )
    
    def train(self, training_data: pd.DataFrame):
        """Train model on historical conversion data"""
        X = training_data[self.feature_columns]
        y = training_data["converted"]  # Binary: meeting booked or not
        
        self.model.fit(X, y)
    
    def predict_probability(self, lead_features: Dict) -> float:
        """Predict probability of conversion (0-1)"""
        X = pd.DataFrame([lead_features])
        return self.model.predict_proba(X)[0][1]
```

---

## Frontend Architecture (React)

### Tech Stack
- **Framework**: React 18+ with Vite
- **Routing**: React Router v6
- **State Management**: Zustand (lightweight alternative to Redux)
- **Data Fetching**: TanStack Query (React Query)
- **UI Components**: Tailwind CSS + Headless UI
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod validation

### Directory Structure
```
frontend/src/
├── components/
│   ├── ui/               # Reusable UI components
│   │   ├── Button.jsx
│   │   ├── Input.jsx
│   │   ├── Modal.jsx
│   │   └── Table.jsx
│   ├── leads/            # Lead-specific components
│   │   ├── LeadTable.jsx
│   │   ├── LeadDetail.jsx
│   │   └── LeadFilters.jsx
│   ├── analysis/
│   │   ├── Dashboard.jsx
│   │   ├── InsightCard.jsx
│   │   └── Charts.jsx
│   └── connections/
│       ├── ConnectionCard.jsx
│       └── OAuthFlow.jsx
├── pages/
│   ├── Dashboard.jsx
│   ├── Connections.jsx
│   ├── Analysis.jsx
│   ├── Leads.jsx
│   └── Outbound.jsx
├── hooks/
│   ├── useLeads.js       # Data fetching hooks
│   ├── useAnalysis.js
│   └── useAuth.js
├── stores/
│   ├── authStore.js      # Zustand stores
│   └── filterStore.js
├── utils/
│   ├── api.js           # API client
│   ├── formatting.js
│   └── constants.js
├── App.jsx
└── main.jsx
```

### State Management Example
```javascript
// stores/filterStore.js
import create from 'zustand'

export const useFilterStore = create((set) => ({
  priority: 'all',
  industry: 'all',
  searchQuery: '',
  setPriority: (priority) => set({ priority }),
  setIndustry: (industry) => set({ industry }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  resetFilters: () => set({
    priority: 'all',
    industry: 'all',
    searchQuery: ''
  })
}))
```

---

## Deployment Architecture

### Infrastructure (AWS)
```
┌─────────────────────────────────────────┐
│ Route 53 (DNS)                          │
└─────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│ CloudFront (CDN + Static Assets)        │
└─────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│ Application Load Balancer (ALB)         │
└─────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────┐
│ ECS Fargate (API Containers)            │
│   - Auto-scaling (2-10 tasks)           │
│   - Health checks                       │
└─────────────────────────────────────────┘
                 ↓
┌──────────────────┐  ┌──────────────────┐
│  RDS PostgreSQL  │  │  ElastiCache     │
│  (Multi-AZ)      │  │  Redis           │
└──────────────────┘  └──────────────────┘
```

### CI/CD Pipeline (GitHub Actions)
```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run tests
        run: |
          cd backend
          pip install -r requirements.txt
          pytest
  
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Build and push Docker image
        run: |
          docker build -t signal-intel:${{ github.sha }} .
          docker push signal-intel:${{ github.sha }}
      
      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster production \
            --service api \
            --force-new-deployment
```

---

## Security Considerations

### Authentication
- JWT tokens (15min expiry, refresh tokens 7 days)
- OAuth 2.0 for external services
- Multi-factor authentication (Authy/Google Authenticator)

### Data Protection
- Encryption at rest (AES-256)
- Encryption in transit (TLS 1.3)
- API credentials stored in AWS Secrets Manager
- Database credentials rotated monthly

### API Security
- Rate limiting (100 req/min per user)
- CORS configuration
- Input validation (Pydantic schemas)
- SQL injection prevention (parameterized queries)
- XSS protection (CSP headers)

---

## Monitoring & Observability

### Tools
- **Application Monitoring**: Sentry (error tracking)
- **Logging**: CloudWatch Logs
- **Metrics**: Prometheus + Grafana
- **Uptime**: Pingdom
- **APM**: DataDog

### Key Metrics
- API response times (p50, p95, p99)
- Error rates by endpoint
- Database query performance
- Integration API success rates
- ML model inference time
- User engagement (DAU, feature adoption)

---

## Cost Estimation (MVP)

### AWS Infrastructure
- ECS Fargate (2 tasks): $50/month
- RDS PostgreSQL (db.t3.small): $30/month
- ElastiCache Redis: $15/month
- S3 + CloudFront: $10/month
- **Total**: ~$105/month

### External Services
- OpenAI API: $50-200/month (depending on usage)
- Sentry: Free tier
- GitHub: Free tier

### Total Monthly Cost: ~$200-300

---

## Performance Targets

- **API Response Time**: < 500ms (p95)
- **Database Queries**: < 100ms (p95)
- **Dashboard Load Time**: < 2 seconds
- **ML Scoring**: < 200ms per lead
- **Throughput**: 1000 requests/second
- **Uptime**: 99.5%

---

**Document Owner**: Engineering Team  
**Next Review**: After MVP launch
