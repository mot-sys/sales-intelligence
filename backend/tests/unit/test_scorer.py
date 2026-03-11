"""
Unit tests for the ML lead scoring engine (app/ml/scorer.py).

Tests are pure-Python — no database, no HTTP.
"""

from datetime import datetime, timedelta

import pytest

from app.ml.scorer import LeadScorer


@pytest.fixture
def scorer():
    return LeadScorer()


# ── Firmographics ─────────────────────────────────────────────────────────────


def test_firmographics_perfect_icp(scorer):
    """Employee count in range AND ICP industry → full 20 points."""
    lead = {"employee_count": 150, "industry": "SaaS"}
    assert scorer._score_firmographics(lead) == 20


def test_firmographics_non_icp_industry(scorer):
    """Employee count in range but unrecognised industry → partial credit."""
    lead = {"employee_count": 200, "industry": "Construction"}
    score = scorer._score_firmographics(lead)
    assert score == 15  # 10 (employee) + 5 (has industry, not ICP)


def test_firmographics_too_small_company(scorer):
    """Employee count below minimum → partial points."""
    lead = {"employee_count": 10, "industry": "SaaS"}
    score = scorer._score_firmographics(lead)
    assert score == 15  # 5 (too small) + 10 (ICP industry)


def test_firmographics_large_enterprise(scorer):
    """Employee count above maximum → still gets 7 pts (enterprise)."""
    lead = {"employee_count": 5000, "industry": "Technology"}
    score = scorer._score_firmographics(lead)
    assert score == 17  # 7 (too large but enterprise) + 10 (ICP industry)


def test_firmographics_zero_employees_no_industry(scorer):
    """No usable signals → 0."""
    lead = {"employee_count": 0, "industry": ""}
    assert scorer._score_firmographics(lead) == 0


def test_firmographics_missing_keys(scorer):
    """Missing keys should not raise — default to 0."""
    assert scorer._score_firmographics({}) == 0


# ── Signal scoring ────────────────────────────────────────────────────────────


def test_signals_empty(scorer):
    assert scorer._score_signals([]) == 0


def test_signals_funding_no_date(scorer):
    """Funding with no detected_at → base score 25, no recency multiplier."""
    signals = [{"type": "funding", "detected_at": None}]
    assert scorer._score_signals(signals) == 25


def test_signals_funding_very_recent(scorer):
    """Funding within last 7 days → 1.5× multiplier → 37 pts."""
    detected = (datetime.utcnow() - timedelta(days=3)).isoformat()
    signals = [{"type": "funding", "detected_at": detected}]
    assert scorer._score_signals(signals) == min(40, int(25 * 1.5))


def test_signals_funding_moderately_recent(scorer):
    """Funding 10–30 days old → 1.2× multiplier."""
    detected = (datetime.utcnow() - timedelta(days=15)).isoformat()
    signals = [{"type": "funding", "detected_at": detected}]
    assert scorer._score_signals(signals) == min(40, int(25 * 1.2))


def test_signals_funding_stale(scorer):
    """Funding > 90 days old → 0.5× multiplier."""
    detected = (datetime.utcnow() - timedelta(days=100)).isoformat()
    signals = [{"type": "funding", "detected_at": detected}]
    assert scorer._score_signals(signals) == int(25 * 0.5)


def test_signals_hiring_sales(scorer):
    """Hiring a sales role → 20 pts."""
    signals = [{"type": "hiring", "title": "Account Executive", "detected_at": None}]
    assert scorer._score_signals(signals) == 20


def test_signals_hiring_nonsales(scorer):
    """Non-sales hire → 10 pts."""
    signals = [{"type": "hiring", "title": "Product Designer", "detected_at": None}]
    assert scorer._score_signals(signals) == 10


def test_signals_tech_change(scorer):
    signals = [{"type": "tech_change", "detected_at": None}]
    assert scorer._score_signals(signals) == 15


def test_signals_capped_at_40(scorer):
    """Even many high-value signals should not exceed the 40-pt cap."""
    signals = [{"type": "funding", "detected_at": None} for _ in range(5)]
    assert scorer._score_signals(signals) == 40


# ── Intent scoring ────────────────────────────────────────────────────────────


def test_intent_empty(scorer):
    assert scorer._score_intent([]) == 0


def test_intent_non_intent_signals_ignored(scorer):
    signals = [{"type": "funding"}, {"type": "hiring"}]
    assert scorer._score_intent(signals) == 0


def test_intent_pricing_page(scorer):
    signals = [{"type": "intent", "title": "Visited pricing page"}]
    assert scorer._score_intent(signals) == 15


def test_intent_demo_page(scorer):
    signals = [{"type": "intent", "title": "Requested demo"}]
    assert scorer._score_intent(signals) == 12


def test_intent_api_docs(scorer):
    signals = [{"type": "intent", "title": "Browsed api documentation"}]
    assert scorer._score_intent(signals) == 8


def test_intent_blog_content(scorer):
    signals = [{"type": "intent", "title": "Read blog post"}]
    assert scorer._score_intent(signals) == 5


def test_intent_generic_visit(scorer):
    signals = [{"type": "intent", "title": "Homepage visit"}]
    assert scorer._score_intent(signals) == 3


def test_intent_two_visit_bonus(scorer):
    signals = [
        {"type": "intent", "title": "Pricing"},
        {"type": "intent", "title": "Homepage"},
    ]
    # 15 + 3 + 5 (2-visit bonus) = 23
    score = scorer._score_intent(signals)
    assert score == 23


def test_intent_three_visit_bonus(scorer):
    signals = [
        {"type": "intent", "title": "Pricing"},
        {"type": "intent", "title": "Homepage"},
        {"type": "intent", "title": "Blog"},
    ]
    # 15 + 3 + 5 + 10 (3-visit bonus) = 33 → capped at 30
    score = scorer._score_intent(signals)
    assert score == 30


# ── Priority tiers ────────────────────────────────────────────────────────────


@pytest.mark.parametrize("score", [80, 85, 100])
def test_priority_hot(scorer, score):
    assert scorer._get_priority(score) == "hot"


@pytest.mark.parametrize("score", [60, 65, 79])
def test_priority_warm(scorer, score):
    assert scorer._get_priority(score) == "warm"


@pytest.mark.parametrize("score", [0, 30, 59])
def test_priority_cold(scorer, score):
    assert scorer._get_priority(score) == "cold"


# ── Full score_lead integration ───────────────────────────────────────────────


def test_score_lead_returns_required_keys(scorer):
    result = scorer.score_lead(
        {"company_name": "Acme", "industry": "SaaS", "employee_count": 150}, []
    )
    assert "score" in result
    assert "priority" in result
    assert "recommendation" in result
    assert "breakdown" in result
    assert all(k in result["breakdown"] for k in ("firmographics", "signals", "intent", "historical"))


def test_score_lead_bounded_0_to_100(scorer):
    """Score should always be in [0, 100] regardless of input."""
    lead = {"employee_count": 300, "industry": "SaaS"}
    signals = [
        {"type": "funding", "detected_at": None},
        {"type": "hiring", "title": "Sales", "detected_at": None},
        {"type": "intent", "title": "pricing", "detected_at": None},
        {"type": "intent", "title": "demo", "detected_at": None},
        {"type": "intent", "title": "trial", "detected_at": None},
    ]
    result = scorer.score_lead(lead, signals)
    assert 0 <= result["score"] <= 100


def test_score_lead_hot_funding_plus_hiring(scorer):
    """Funding + hiring signal combo → recommendation references the combo."""
    lead = {"employee_count": 200, "industry": "SaaS"}
    signals = [
        {"type": "funding", "detected_at": None},
        {"type": "hiring", "title": "SDR", "detected_at": None},
    ]
    result = scorer.score_lead(lead, signals)
    assert result["priority"] == "hot"
    # Recommendation should call out the funding+hiring combination
    assert "funding" in result["recommendation"].lower() or "24h" in result["recommendation"].lower()


def test_score_lead_tech_change_recommendation(scorer):
    signals = [{"type": "tech_change", "detected_at": None}]
    result = scorer.score_lead({"employee_count": 100, "industry": "SaaS"}, signals)
    assert "migration" in result["recommendation"].lower() or "tech" in result["recommendation"].lower()


def test_score_lead_empty_inputs(scorer):
    """Edge case: empty lead and no signals should not raise."""
    result = scorer.score_lead({}, [])
    assert isinstance(result["score"], int)
    assert result["priority"] in ("hot", "warm", "cold")
