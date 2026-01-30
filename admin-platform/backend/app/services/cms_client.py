"""
CMS Client Service
==================

HTTP client for communicating with customer CMS instances via the External API.
Each customer has their own CMS instance at {subdomain}.screen.iocast.dk.

The External API is protected by API key (X-API-Key header).
"""

import logging
import httpx
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)


class CMSClient:
    """Client for communicating with a customer's CMS instance."""

    def __init__(self, base_url: str, api_key: str, timeout: float = 30.0):
        """
        Initialize CMS client.

        Args:
            base_url: CMS base URL (e.g., "https://broerup.screen.iocast.dk")
            api_key: API key for authentication
            timeout: Request timeout in seconds
        """
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.timeout = timeout

    def _get_headers(self) -> Dict[str, str]:
        """Get headers for API requests."""
        return {
            'X-API-Key': self.api_key,
            'Accept': 'application/json'
        }

    async def health_check(self) -> Dict[str, Any]:
        """
        Check CMS health status.

        Returns:
            Health status dict with 'success', 'status', etc.
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(f"{self.base_url}/api/ext/health")
                return response.json()
        except Exception as e:
            logger.error(f"CMS health check failed: {e}")
            return {'success': False, 'error': str(e)}

    async def get_info(self) -> Dict[str, Any]:
        """
        Get CMS information and statistics.

        Returns:
            CMS info dict with version, name, statistics, etc.
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/api/ext/info",
                    headers=self._get_headers()
                )
                if response.status_code != 200:
                    return {'success': False, 'error': f'HTTP {response.status_code}'}
                return response.json()
        except Exception as e:
            logger.error(f"Failed to get CMS info: {e}")
            return {'success': False, 'error': str(e)}

    async def list_screens(self) -> Dict[str, Any]:
        """
        List all screens from the CMS.

        Returns:
            Dict with 'success', 'screens' (list), 'count'
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/api/ext/screens",
                    headers=self._get_headers()
                )
                if response.status_code == 401:
                    return {'success': False, 'error': 'API key required'}
                if response.status_code == 403:
                    return {'success': False, 'error': 'Invalid API key'}
                if response.status_code != 200:
                    return {'success': False, 'error': f'HTTP {response.status_code}'}
                return response.json()
        except Exception as e:
            logger.error(f"Failed to list screens: {e}")
            return {'success': False, 'error': str(e)}

    async def get_screen(self, screen_uuid: str) -> Dict[str, Any]:
        """
        Get screen details by UUID.

        Args:
            screen_uuid: Screen UUID

        Returns:
            Dict with 'success', 'screen' (details), 'media' (list)
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/api/ext/screen/{screen_uuid}",
                    headers=self._get_headers()
                )
                if response.status_code == 404:
                    return {'success': False, 'error': 'Screen not found'}
                if response.status_code != 200:
                    return {'success': False, 'error': f'HTTP {response.status_code}'}
                return response.json()
        except Exception as e:
            logger.error(f"Failed to get screen {screen_uuid}: {e}")
            return {'success': False, 'error': str(e)}

    async def get_screen_media(self, screen_uuid: str) -> Dict[str, Any]:
        """
        List media for a specific screen.

        Args:
            screen_uuid: Screen UUID

        Returns:
            Dict with 'success', 'media' (list), 'count'
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/api/ext/screen/{screen_uuid}/media",
                    headers=self._get_headers()
                )
                if response.status_code == 404:
                    return {'success': False, 'error': 'Screen not found'}
                if response.status_code != 200:
                    return {'success': False, 'error': f'HTTP {response.status_code}'}
                return response.json()
        except Exception as e:
            logger.error(f"Failed to get screen media: {e}")
            return {'success': False, 'error': str(e)}

    async def get_display_url(self, screen_uuid: str) -> Dict[str, Any]:
        """
        Get the full display URL for a screen.

        Args:
            screen_uuid: Screen UUID

        Returns:
            Dict with 'success', 'display_url', 'screen_name', 'screen_uuid'
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/api/ext/screen/{screen_uuid}/display-url",
                    headers=self._get_headers()
                )
                if response.status_code == 404:
                    return {'success': False, 'error': 'Screen not found'}
                if response.status_code != 200:
                    return {'success': False, 'error': f'HTTP {response.status_code}'}
                return response.json()
        except Exception as e:
            logger.error(f"Failed to get display URL: {e}")
            return {'success': False, 'error': str(e)}

    async def upload_media(
        self,
        screen_uuid: str,
        file_content: bytes,
        filename: str,
        content_type: str
    ) -> Dict[str, Any]:
        """
        Upload media to a screen.

        Args:
            screen_uuid: Screen UUID
            file_content: File content as bytes
            filename: Original filename
            content_type: MIME type

        Returns:
            Dict with 'success', 'media' (uploaded media details)
        """
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:  # Longer timeout for uploads
                files = {'file': (filename, file_content, content_type)}
                response = await client.post(
                    f"{self.base_url}/api/ext/screen/{screen_uuid}/media",
                    headers=self._get_headers(),
                    files=files
                )
                if response.status_code == 404:
                    return {'success': False, 'error': 'Screen not found'}
                if response.status_code == 400:
                    return response.json()
                if response.status_code != 200:
                    return {'success': False, 'error': f'HTTP {response.status_code}'}
                return response.json()
        except Exception as e:
            logger.error(f"Failed to upload media: {e}")
            return {'success': False, 'error': str(e)}

    async def delete_media(self, media_id: int) -> Dict[str, Any]:
        """
        Delete media by ID.

        Args:
            media_id: Media ID

        Returns:
            Dict with 'success', 'message'
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.delete(
                    f"{self.base_url}/api/ext/media/{media_id}",
                    headers=self._get_headers()
                )
                if response.status_code == 404:
                    return {'success': False, 'error': 'Media not found'}
                if response.status_code != 200:
                    return {'success': False, 'error': f'HTTP {response.status_code}'}
                return response.json()
        except Exception as e:
            logger.error(f"Failed to delete media: {e}")
            return {'success': False, 'error': str(e)}

    async def reorder_media(self, screen_uuid: str, media_ids: List[int]) -> Dict[str, Any]:
        """
        Reorder media for a screen.

        Args:
            screen_uuid: Screen UUID
            media_ids: List of media IDs in desired order

        Returns:
            Dict with 'success', 'message'
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/api/ext/screen/{screen_uuid}/media/reorder",
                    headers=self._get_headers(),
                    json={'media_ids': media_ids}
                )
                if response.status_code == 404:
                    return {'success': False, 'error': 'Screen not found'}
                if response.status_code != 200:
                    return {'success': False, 'error': f'HTTP {response.status_code}'}
                return response.json()
        except Exception as e:
            logger.error(f"Failed to reorder media: {e}")
            return {'success': False, 'error': str(e)}


def get_cms_client(customer) -> Optional[CMSClient]:
    """
    Create a CMS client for a customer.

    Args:
        customer: Customer model instance with cms_subdomain and cms_api_key

    Returns:
        CMSClient instance or None if CMS not configured
    """
    if not customer.cms_subdomain or not customer.cms_api_key:
        return None

    # Build CMS URL from subdomain
    # Format: https://{subdomain}.screen.iocast.dk
    base_url = f"https://{customer.cms_subdomain}.screen.iocast.dk"

    return CMSClient(base_url, customer.cms_api_key)


async def get_customer_screens(customer) -> Dict[str, Any]:
    """
    Convenience function to get screens for a customer.

    Args:
        customer: Customer model instance

    Returns:
        Dict with 'success', 'screens', 'count' or error
    """
    client = get_cms_client(customer)
    if not client:
        return {'success': False, 'error': 'CMS not configured for customer'}

    return await client.list_screens()


async def get_customer_cms_info(customer) -> Dict[str, Any]:
    """
    Convenience function to get CMS info for a customer.

    Args:
        customer: Customer model instance

    Returns:
        CMS info dict or error
    """
    client = get_cms_client(customer)
    if not client:
        return {'success': False, 'error': 'CMS not configured for customer'}

    return await client.get_info()
