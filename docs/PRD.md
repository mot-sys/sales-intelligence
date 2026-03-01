# Product Requirements Document (PRD)
## Signal Intelligence Platform

**Version:** 1.0  
**Date:** March 2026  
**Status:** MVP Development

---

## Executive Summary

Signal Intelligence is an AI-powered sales intelligence platform that solves the critical problem of lead prioritization in B2B sales. While companies have access to dozens of data sources (Clay, Salesforce, website visitors, etc.), they lack the intelligence layer to know **which leads to contact** and **when**.

Our differentiation: **Cross-customer learning**. We train on conversion patterns from 100+ companies to predict which signal combinations drive meetings and pipeline.

---

## Problem Statement

### Current State (Pain Points)

1. **Information Overload**: Sales teams have 1000+ leads in Clay but don't know which 10 to contact today
2. **Manual Prioritization**: SDRs waste 2-3 hours daily deciding who to reach out to
3. **Missed Timing**: High-intent signals (funding, hiring, website visits) go unnoticed until it's too late
4. **Lack of Context**: "Company X visited your website" - but what does that mean? Is it worth reaching out?
5. **No Learning**: Each company treats their data in isolation, missing patterns visible across multiple companies

### Why Existing Solutions Don't Work

- **Clay/Apollo**: Data enrichment, not intelligence
- **6sense/Demandbase**: Enterprise-focused, expensive, slow setup
- **Building in n8n**: No cross-customer learning, months to collect training data
- **Manual scoring**: Doesn't scale, biased, inconsistent

---

## Target Users

### Primary Persona: "Sarah the SDR Manager"
- **Role**: Leads team of 5-10 SDRs at Series A/B SaaS company
- **Pain**: Team wastes time on cold leads, misses hot opportunities
- **Success Metric**: Meetings booked per SDR
- **Tools**: Already uses Clay, Salesforce, Outreach.io
- **Budget Authority**: $500-2,000/month

### Secondary Persona: "Marcus the Founder"
- **Role**: CEO/Founder doing founder-led sales
- **Pain**: No time to research every lead, needs quick prioritization
- **Success Metric**: Pipeline generated per hour spent
- **Tools**: Basic Salesforce, maybe Clay
- **Budget Authority**: Will pay for immediate ROI

---

## Core Features (MVP)

### 1. Data Connections (Infrastruktur)
**User Story**: "As Sarah, I want to connect my existing tools so the platform can analyze my leads"

**Requirements**:
- OAuth/API key setup for Clay, Salesforce, Snitcher, Outreach.io
- One-click connection flow (< 5 minutes to connect all)
- Connection health monitoring
- Sync scheduling (every 2 hours, 6 hours, daily)
- Manual sync trigger

**Success Criteria**:
- 95% successful connection rate
- < 5 minutes average setup time
- Clear error messages if connection fails

---

### 2. Analysis Dashboard
**User Story**: "As Sarah, I want to see what's happening across all my data sources in one place"

**Requirements**:
- Total leads count
- High-priority leads (score > 80)
- Average lead score
- Active signals count
- 7-day activity chart (leads processed, high-intent signals)
- Signal distribution breakdown (funding, hiring, tech changes, intent)
- Key insights:
  - "3 companies visited pricing page 5+ times this week"
  - "8 Series A fundings in your ICP announced"
  - "5 companies recently switched CRM systems"

**Success Criteria**:
- Dashboard loads in < 2 seconds
- Insights refresh every 2 hours
- At least 3 actionable insights shown daily

---

### 3. Lead Intelligence
**User Story**: "As an SDR, I want to see all my leads with their priority and know who to contact first"

**Requirements**:
- Table view of all leads
- Columns: Company, Contact, Score (0-100), Priority (Hot/Warm/Cold), Active Signals, Source, Last Activity
- Filter by priority, industry, company size
- Search by company/contact name
- Sort by score, last activity, company size
- Click lead to see full detail modal:
  - All active signals with timestamps
  - AI recommendation
  - Contact information
  - Company firmographics
  - Historical activity

**Scoring Logic (Rule-based for MVP)**:
```
Base score: 0

Firmographics:
+ Company size in ICP range (50-500 employees): +10
+ Industry match: +10
+ Geographic match: +5

Signals:
+ Recent funding (< 90 days): +25
+ Hiring sales roles: +20
+ Tech stack change: +15
+ Competitor usage: +10

Intent:
+ Pricing page visit: +15
+ Multiple visits (3+): +10
+ Downloaded content: +10
+ LinkedIn engagement: +5

Historical:
+ Similar companies converted: +10

Priority Tiers:
- Hot: Score >= 80
- Warm: Score 60-79
- Cold: Score < 60
```

**Success Criteria**:
- 70%+ of leads scored within 1 point of manual scoring
- Hot leads convert to meeting 2x more than cold leads
- Table loads < 1 second for 10,000 leads

---

### 4. Outbound Recommendations
**User Story**: "As Sarah, I want a prioritized list of leads to reach out to today with specific talking points"

**Requirements**:
- Show only Hot + Warm leads (score >= 60)
- Sorted by score (highest first)
- For each lead:
  - Score with color coding
  - Company + contact info
  - All active signals as tags
  - AI-generated recommendation:
    - "Contact within 24h. Lead with funding + scaling pain point."
    - "Migration window open. Offer implementation support."
    - "Building sales team. Multi-touch nurture campaign recommended."
  - Action buttons:
    - "Add to Outreach Sequence"
    - "View in Salesforce"
    - "Skip / Mark as Low Priority"

**AI Recommendation Logic (MVP)**:
```python
if funding_signal and hiring_signal:
    return "High-intent buyer. Contact within 24h. Lead with funding + scaling pain point."
    
if tech_migration_signal:
    return "Migration window open. Offer implementation support."
    
if hiring_sales_roles:
    return "Building sales team. Multi-touch nurture campaign recommended."
    
if multiple_website_visits:
    return "High buying intent. Personalize outreach with specific page content."
    
else:
    return "Warm lead. Add to nurture sequence, monitor for intent spike."
```

**Success Criteria**:
- Every Hot lead has a specific recommendation
- SDRs can process entire queue in < 30 minutes
- 80%+ of recommendations feel relevant to SDRs

---

## Technical Requirements

### Performance
- API response time: < 500ms for all endpoints
- Dashboard load time: < 2 seconds
- Support 100,000 leads per customer
- Handle 10 concurrent users per account

### Reliability
- 99.5% uptime SLA
- Graceful degradation if one integration fails
- Automatic retry for failed API calls
- Error logging and monitoring

### Security
- OAuth 2.0 for all integrations
- API keys encrypted at rest
- HTTPS only
- Rate limiting (100 req/min per user)
- SQL injection prevention
- XSS protection

### Scalability
- Horizontal scaling for API servers
- Database read replicas
- Redis caching for frequent queries
- Async job processing for long-running tasks

---

## Data Model (Core Entities)

### Lead
```python
{
  "id": "uuid",
  "company_name": "TechCorp A/S",
  "contact_name": "Lars Nielsen",
  "contact_title": "CRO",
  "contact_email": "lars@techcorp.dk",
  "industry": "SaaS",
  "employee_count": 45,
  "score": 92,
  "priority": "hot",  # hot/warm/cold
  "signals": [...],
  "recommendation": "...",
  "source": "snitcher",  # clay/salesforce/snitcher/outreach
  "created_at": "2026-03-01T10:00:00Z",
  "last_activity": "2026-03-01T08:00:00Z"
}
```

### Signal
```python
{
  "id": "uuid",
  "lead_id": "uuid",
  "type": "funding",  # funding/hiring/tech_change/intent/content
  "title": "Serie A funding $15M",
  "description": "Raised $15M Serie A led by Balderton Capital",
  "score_impact": 25,
  "source": "clay",
  "detected_at": "2026-02-28T15:30:00Z",
  "url": "https://...",  # Optional link to source
}
```

### Integration
```python
{
  "id": "uuid",
  "customer_id": "uuid",
  "service": "clay",  # clay/salesforce/snitcher/outreach
  "status": "connected",  # connected/error/disconnected
  "credentials": {...},  # Encrypted
  "last_sync": "2026-03-01T10:00:00Z",
  "sync_frequency": "2h",  # 2h/6h/daily
  "config": {...},  # Service-specific settings
}
```

---

## API Endpoints (MVP)

### Connections
- `POST /api/connections/clay` - Connect Clay account
- `POST /api/connections/salesforce` - Connect Salesforce
- `POST /api/connections/snitcher` - Connect Snitcher
- `POST /api/connections/outreach` - Connect Outreach.io
- `GET /api/connections` - List all connections
- `POST /api/connections/{id}/sync` - Trigger manual sync
- `DELETE /api/connections/{id}` - Disconnect service

### Leads
- `GET /api/leads` - List leads (with filters, pagination)
- `GET /api/leads/{id}` - Get lead detail
- `POST /api/leads/{id}/score` - Manually trigger re-scoring
- `PUT /api/leads/{id}/priority` - Override priority

### Analysis
- `GET /api/analysis/dashboard` - Dashboard metrics
- `GET /api/analysis/insights` - AI-generated insights
- `GET /api/analysis/signals` - Signal breakdown
- `GET /api/analysis/patterns` - Conversion patterns

### Outbound
- `GET /api/outbound/queue` - Get prioritized outbound queue
- `POST /api/outbound/{lead_id}/action` - Add to sequence, skip, etc.
- `GET /api/outbound/recommendations` - Get AI recommendations

---

## Success Metrics (KPIs)

### Product Metrics
- **Lead Score Accuracy**: 70%+ of Hot leads convert to meeting
- **Time to Value**: < 20 minutes from signup to first scored lead
- **Daily Active Users**: 60%+ of customers use daily
- **Feature Adoption**: 80%+ use Outbound Queue regularly

### Business Metrics
- **Customer Acquisition Cost (CAC)**: < $2,000
- **Monthly Recurring Revenue (MRR)**: $50K by Month 6
- **Customer Lifetime Value (LTV)**: > $20,000
- **Churn Rate**: < 5% monthly
- **Net Promoter Score (NPS)**: > 50

### Sales Impact Metrics (Customer-side)
- **Meetings Booked**: +40% increase vs. manual prioritization
- **Time Saved**: 2-3 hours/day per SDR
- **Pipeline Contribution**: 20%+ of closed-won deals trace back to our leads
- **Response Rate**: +25% when using AI recommendations

---

## Risks & Mitigations

### Risk 1: API Rate Limits
**Impact**: High - Could block data syncing  
**Mitigation**: Implement exponential backoff, request batching, cache aggressively

### Risk 2: Low Score Accuracy
**Impact**: High - Users won't trust recommendations  
**Mitigation**: Start with rule-based scoring, gather feedback, iterate on ML models

### Risk 3: Integration Complexity
**Impact**: Medium - Setup might be too complex  
**Mitigation**: One-click OAuth where possible, excellent error messages, onboarding support

### Risk 4: Data Privacy Concerns
**Impact**: Medium - Customers worried about data sharing  
**Mitigation**: Clear privacy policy, EU hosting option, no cross-customer data sharing (only aggregated patterns)

### Risk 5: "Build vs Buy" Decision
**Impact**: High - Companies might build in n8n  
**Mitigation**: Emphasize cross-customer learning moat, faster time-to-value, maintained product

---

## Future Roadmap (Post-MVP)

### Phase 2 Features
- Webhooks for real-time signal updates
- Auto-trigger Outreach sequences
- Slack/email notifications for hot leads
- Mobile app for on-the-go prioritization
- Custom signal definitions

### Phase 3 Features
- Multi-language support (Danish, Swedish, German)
- Industry-specific models (SaaS, E-commerce, etc.)
- Team collaboration (assign leads, comments)
- A/B testing for recommendations
- Benchmark reports ("Your score accuracy vs. peers")

### Phase 4 Features
- Public API for customers
- Zapier integration
- Chrome extension
- Advanced reporting/analytics
- White-label option for agencies

---

## Open Questions

1. Should we allow customers to customize scoring weights?
2. How much historical Salesforce data do we need for accurate patterns? (180 days minimum?)
3. Do we show score reasoning transparently or keep it "black box"?
4. Should we auto-add leads to sequences or always require manual confirmation?
5. What's the minimum viable accuracy before launch? (70%? 75%?)

---

**Approved by**: [Founder]  
**Next Review**: After MVP user testing  
**Document Owner**: Product Team
