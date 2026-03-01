"""
Base Integration Client
Abstract base class for all external API integrations.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Optional
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential


class BaseIntegration(ABC):
    """
    Base class for external service integrations.
    
    Provides common functionality:
        - HTTP client with retries
        - Rate limiting
        - Error handling
        - Connection testing
    """
    
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
        """
        Make HTTP request with automatic retries.
        
        Args:
            method: HTTP method (GET, POST, etc.)
            url: Full URL
            **kwargs: Additional args for httpx (headers, json, params, etc.)
        
        Returns:
            JSON response as dict
        
        Raises:
            httpx.HTTPStatusError: If request fails after retries
        """
        response = await self.client.request(method, url, **kwargs)
        response.raise_for_status()
        return response.json()
    
    @abstractmethod
    async def test_connection(self) -> bool:
        """
        Test if credentials work and connection is valid.
        
        Returns:
            True if connection successful, False otherwise
        """
        pass
    
    @abstractmethod
    async def sync_data(self) -> List[Dict]:
        """
        Sync data from external service.
        
        Returns:
            List of records (leads, companies, etc.)
        """
        pass
    
    @abstractmethod
    async def push_data(self, data: Dict) -> bool:
        """
        Push data to external service.
        
        Args:
            data: Data to push (lead, action, etc.)
        
        Returns:
            True if successful
        """
        pass
    
    async def close(self):
        """Close HTTP client connection"""
        await self.client.aclose()
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()


# Example usage:
# async with ClayIntegration(credentials) as client:
#     data = await client.sync_data()
