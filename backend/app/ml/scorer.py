"""
ML Lead Scoring Engine
Scores leads based on signals and firmographics.
"""

from typing import Dict, List
from datetime import datetime, timedelta


class LeadScorer:
    """
    Lead scoring engine that calculates a 0-100 score based on:
    - Firmographics (company size, industry)
    - Signals (funding, hiring, tech changes)
    - Intent (website visits, content engagement)
    - Historical patterns (conversion data)
    """
    
    def __init__(self):
        self.weights = {
            "firmographics": 0.2,  # 20 points max
            "signals": 0.4,        # 40 points max
            "intent": 0.3,         # 30 points max
            "historical": 0.1,     # 10 points max
        }
        
        # ICP (Ideal Customer Profile) ranges
        self.icp_employee_range = (50, 500)
        self.icp_industries = ["SaaS", "Technology", "Software", "E-commerce"]
    
    def score_lead(self, lead: Dict, signals: List[Dict]) -> Dict:
        """
        Calculate lead score and generate recommendation.
        
        Args:
            lead: Lead data (company_name, industry, employee_count, etc.)
            signals: List of signal dicts (type, title, detected_at, etc.)
        
        Returns:
            Dict with score, priority, and recommendation
        """
        score = 0
        
        # Firmographics scoring (20 points)
        score += self._score_firmographics(lead)
        
        # Signals scoring (40 points)
        score += self._score_signals(signals)
        
        # Intent scoring (30 points)
        score += self._score_intent(signals)
        
        # Historical patterns (10 points)
        score += self._score_historical(lead)
        
        # Ensure score is within bounds
        final_score = min(100, max(0, score))
        
        # Determine priority
        priority = self._get_priority(final_score)
        
        # Generate recommendation
        recommendation = self._generate_recommendation(lead, signals, final_score)
        
        return {
            "score": final_score,
            "priority": priority,
            "recommendation": recommendation,
            "breakdown": {
                "firmographics": self._score_firmographics(lead),
                "signals": self._score_signals(signals),
                "intent": self._score_intent(signals),
                "historical": self._score_historical(lead)
            }
        }
    
    def _score_firmographics(self, lead: Dict) -> int:
        """Score based on company characteristics"""
        score = 0
        
        # Employee count in ICP range
        employee_count = lead.get("employee_count", 0)
        if self.icp_employee_range[0] <= employee_count <= self.icp_employee_range[1]:
            score += 10
        elif employee_count > 0:
            # Partial points for close matches
            if employee_count < self.icp_employee_range[0]:
                score += 5  # Too small
            else:
                score += 7  # Too large but still enterprise
        
        # Industry match
        industry = lead.get("industry", "")
        if industry in self.icp_industries:
            score += 10
        elif industry:  # Has industry data
            score += 5
        
        return score
    
    def _score_signals(self, signals: List[Dict]) -> int:
        """Score based on active signals"""
        if not signals:
            return 0
        
        score = 0
        now = datetime.utcnow()
        
        for signal in signals:
            signal_type = signal.get("type", "")
            detected_at = signal.get("detected_at")
            
            # Calculate recency multiplier
            recency_multiplier = 1.0
            if detected_at:
                if isinstance(detected_at, str):
                    detected_at = datetime.fromisoformat(detected_at.replace("Z", "+00:00"))
                
                signal_age = now - detected_at
                
                if signal_age < timedelta(days=7):
                    recency_multiplier = 1.5  # Very recent
                elif signal_age < timedelta(days=30):
                    recency_multiplier = 1.2  # Recent
                elif signal_age > timedelta(days=90):
                    recency_multiplier = 0.5  # Stale
            
            # Signal-specific scoring
            base_score = 0
            if signal_type == "funding":
                base_score = 25
            elif signal_type == "hiring":
                # Check if sales-related
                title = signal.get("title", "").lower()
                if any(keyword in title for keyword in ["sales", "sdr", "ae", "account executive"]):
                    base_score = 20
                else:
                    base_score = 10
            elif signal_type == "tech_change":
                base_score = 15
            elif signal_type == "intent":
                base_score = 10
            elif signal_type == "content":
                base_score = 5
            
            score += int(base_score * recency_multiplier)
        
        return min(40, score)  # Cap at 40 points
    
    def _score_intent(self, signals: List[Dict]) -> int:
        """Score based on buyer intent signals"""
        intent_signals = [s for s in signals if s.get("type") == "intent"]
        
        if not intent_signals:
            return 0
        
        score = 0
        
        for signal in intent_signals:
            title = signal.get("title", "").lower()
            
            # High-intent actions
            if "pricing" in title:
                score += 15
            elif "demo" in title or "trial" in title:
                score += 12
            elif "documentation" in title or "api" in title:
                score += 8
            elif "blog" in title or "content" in title:
                score += 5
            else:
                score += 3  # Generic page visit
        
        # Bonus for multiple visits
        if len(intent_signals) >= 3:
            score += 10
        elif len(intent_signals) >= 2:
            score += 5
        
        return min(30, score)
    
    def _score_historical(self, lead: Dict) -> int:
        """Score based on historical conversion patterns"""
        # TODO: Implement ML-based historical scoring
        # For MVP, use simple heuristics
        return 0
    
    def _get_priority(self, score: int) -> str:
        """Determine priority tier based on score"""
        if score >= 80:
            return "hot"
        elif score >= 60:
            return "warm"
        else:
            return "cold"
    
    def _generate_recommendation(
        self, 
        lead: Dict, 
        signals: List[Dict], 
        score: int
    ) -> str:
        """Generate AI recommendation based on signals and score"""
        signal_types = {s.get("type") for s in signals}
        
        # Check for specific signal combinations
        if "funding" in signal_types and "hiring" in signal_types:
            return (
                "High-intent buyer. Contact within 24h. "
                "Lead with funding + scaling pain point. "
                "Mention team expansion challenges."
            )
        
        if "tech_change" in signal_types:
            return (
                "Migration window open. Offer implementation support. "
                "Reference their recent tech stack change. "
                "Emphasize easy migration process."
            )
        
        if "hiring" in signal_types:
            hiring_signals = [s for s in signals if s.get("type") == "hiring"]
            if any("sales" in s.get("title", "").lower() for s in hiring_signals):
                return (
                    "Building sales team. Multi-touch nurture campaign recommended. "
                    "Focus on sales enablement and team productivity."
                )
        
        # Intent-based recommendations
        intent_signals = [s for s in signals if s.get("type") == "intent"]
        if len(intent_signals) >= 3:
            return (
                "High buying intent detected. Multiple website visits. "
                "Personalize outreach with specific page content. "
                "Contact within 48 hours."
            )
        
        # Score-based fallback
        if score >= 80:
            return (
                "High priority lead. Strong fit with ICP. "
                "Personalized outreach recommended."
            )
        elif score >= 60:
            return (
                "Warm lead. Add to nurture sequence. "
                "Monitor for intent spike before manual outreach."
            )
        else:
            return (
                "Low priority. Skip manual outreach. "
                "Add to automated drip campaign."
            )


# Singleton instance
scorer = LeadScorer()


def score_lead(lead: Dict, signals: List[Dict]) -> Dict:
    """Convenience function for scoring a lead"""
    return scorer.score_lead(lead, signals)
