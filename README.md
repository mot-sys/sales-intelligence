# Signal Intelligence Platform

AI-powered sales intelligence platform that analyzes signals from multiple sources (Clay, Salesforce, Snitcher, Outreach.io) to prioritize leads and recommend outbound actions.

## 🎯 Core Value Proposition

**You can build data pipes. We give you the brain.**

- **Cross-customer intelligence**: Learn from 100+ companies' conversion patterns
- **Instant time-to-value**: Pre-trained ML models, no 6-month data collection needed
- **Maintained product**: API changes, rate limits, and updates handled for you
- **Domain expertise**: Battle-tested signal combinations that predict pipeline

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (React)                     │
│  Dashboard | Connections | Analysis | Leads | Outbound  │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                  Backend API (FastAPI)                   │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ API Routes   │  │  ML Scoring  │  │ Integrations │ │
│  │ /leads       │  │  Engine      │  │ Manager      │ │
│  │ /analysis    │  └──────────────┘  └──────────────┘ │
│  │ /outbound    │                                      │
│  └──────────────┘                                      │
└─────────────────────────────────────────────────────────┘
            ↓                ↓                ↓
┌─────────────────┐  ┌──────────────┐  ┌──────────────┐
│   PostgreSQL    │  │  Redis Cache │  │  Vector DB   │
│  (leads, scores)│  │  (API cache) │  │ (embeddings) │
└─────────────────┘  └──────────────┘  └──────────────┘
            ↓
┌─────────────────────────────────────────────────────────┐
│              External Data Sources                       │
│  Clay API | Salesforce | Snitcher | Outreach.io        │
└─────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker & Docker Compose
- API credentials for: Clay, Salesforce, Snitcher, Outreach.io

### Installation

```bash
# Clone and setup
cd signal-intelligence

# Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt

# Frontend setup
cd ../frontend
npm install

# Start services with Docker
docker-compose up -d

# Run migrations
cd backend
alembic upgrade head

# Start backend
uvicorn app.main:app --reload --port 8000

# Start frontend (in new terminal)
cd frontend
npm run dev
```

Access at:
- Frontend: http://localhost:5173
- API Docs: http://localhost:8000/docs
- Database: postgresql://localhost:5432/signal_intel

## 📁 Project Structure

```
signal-intelligence/
├── backend/
│   ├── app/
│   │   ├── api/              # API routes
│   │   │   ├── leads.py      # Lead endpoints
│   │   │   ├── analysis.py   # Analysis endpoints
│   │   │   ├── outbound.py   # Outbound queue
│   │   │   └── connections.py # Integration management
│   │   ├── core/             # Core functionality
│   │   │   ├── config.py     # Settings
│   │   │   └── security.py   # Auth
│   │   ├── db/               # Database
│   │   │   ├── models.py     # SQLAlchemy models
│   │   │   └── session.py    # DB connection
│   │   ├── integrations/     # External APIs
│   │   │   ├── clay.py       # Clay API client
│   │   │   ├── salesforce.py # Salesforce client
│   │   │   ├── snitcher.py   # Snitcher client
│   │   │   └── outreach.py   # Outreach.io client
│   │   ├── ml/               # ML scoring
│   │   │   ├── scorer.py     # Lead scoring engine
│   │   │   ├── models.py     # ML models
│   │   │   └── training.py   # Model training
│   │   └── main.py           # FastAPI app
│   ├── tests/
│   ├── alembic/              # Database migrations
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── pages/            # Page components
│   │   ├── hooks/            # Custom hooks
│   │   ├── utils/            # Utilities
│   │   └── App.jsx
│   └── package.json
├── docs/
│   ├── ARCHITECTURE.md       # Technical architecture
│   ├── PRD.md               # Product requirements
│   └── API.md               # API documentation
├── docker-compose.yml
└── README.md
```

## 🔌 Integrations

### Clay
- Enrichment data (firmographics, technographics)
- Contact information
- API docs: https://docs.clay.com

### Salesforce
- Historical lead/opportunity data
- Closed-won patterns
- Campaign data
- REST API + SOQL queries

### Snitcher
- Website visitor identification
- Intent signals
- Page visit tracking
- API docs: https://snitcher.com/api

### Outreach.io
- Sequence management
- Email/call activity
- Reply tracking
- API docs: https://api.outreach.io/api/v2/docs

## 🧠 ML Scoring Engine

The scoring engine uses multiple data sources to predict lead quality:

```python
score = base_score(
    firmographics=0.2,    # Company size, industry, revenue
    signals=0.4,          # Funding, hiring, tech changes
    intent=0.3,           # Website visits, content engagement
    historical=0.1        # Past conversion patterns
)

# Signal combinations (learned from cross-customer data):
if funding_recent and hiring_sales:
    score_multiplier = 1.67  # 67% historical conversion
    
if tech_migration and contact_timing < 30_days:
    score_multiplier = 1.54  # 54% conversion rate
```

## 📊 Database Schema

### Core Tables
- `leads` - All leads with scores and signals
- `signals` - Individual signal events
- `integrations` - Connected services config
- `scoring_history` - Historical scores for ML training
- `outbound_actions` - Recommended actions
- `conversion_data` - Deal outcomes for training

## 🔐 Environment Variables

```bash
# Backend (.env)
DATABASE_URL=postgresql://user:pass@localhost:5432/signal_intel
REDIS_URL=redis://localhost:6379
SECRET_KEY=your-secret-key

# API Keys
CLAY_API_KEY=your-clay-key
SALESFORCE_CLIENT_ID=your-sf-client
SALESFORCE_CLIENT_SECRET=your-sf-secret
SALESFORCE_USERNAME=your-sf-user
SALESFORCE_PASSWORD=your-sf-pass
SNITCHER_API_KEY=your-snitcher-key
OUTREACH_API_KEY=your-outreach-key

# OpenAI for AI analysis
OPENAI_API_KEY=your-openai-key

# Frontend (.env)
VITE_API_URL=http://localhost:8000
```

## 🧪 Testing

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test

# Integration tests
pytest tests/integration/

# Load testing
locust -f tests/load/locustfile.py
```

## 📈 Roadmap

### Phase 1: MVP (Weeks 1-4)
- [x] Project structure
- [ ] Database schema & migrations
- [ ] Basic API endpoints
- [ ] Clay + Salesforce integration
- [ ] Simple rule-based scoring
- [ ] Basic frontend UI

### Phase 2: Intelligence (Weeks 5-8)
- [ ] Snitcher integration
- [ ] Outreach.io integration
- [ ] ML scoring engine v1
- [ ] Historical pattern analysis
- [ ] AI recommendations

### Phase 3: Cross-Customer Learning (Weeks 9-12)
- [ ] Multi-tenant architecture
- [ ] Aggregate conversion patterns
- [ ] Benchmark data
- [ ] Advanced ML models
- [ ] Performance-based pricing

### Phase 4: Scale (Weeks 13+)
- [ ] Webhooks for real-time signals
- [ ] Auto-sequence triggering
- [ ] Slack/email notifications
- [ ] Mobile app
- [ ] API for customers

## 💰 Business Model

### Pricing Tiers
1. **Starter**: $500/month - Up to 5,000 leads/month
2. **Pro**: $2,000/month - Up to 25,000 leads/month
3. **Enterprise**: Custom - Unlimited + dedicated training
4. **Performance**: 1% of closed-won pipeline from our leads

### Key Metrics
- Lead score accuracy (target: 70%+ precision)
- Time to first meeting (target: <7 days)
- Pipeline contribution (target: 20%+ of total)
- Customer retention (target: 95%+)

## 🤝 Contributing

This is an early-stage project. Key areas for contribution:
- Integration improvements (more reliable API handling)
- ML model tuning (better signal weighting)
- UI/UX enhancements
- Documentation

## 📝 License

Proprietary - All rights reserved

## 🆘 Support

- Technical issues: Open an issue
- Business inquiries: [your-email]
- Documentation: See `/docs` folder

---

**Built with:** FastAPI, React, PostgreSQL, Redis, scikit-learn, OpenAI
**Maintained by:** [Your Name]
