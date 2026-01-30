"""
CMS Provisioner Service

Handles automatic provisioning of customer CMS instances by wrapping
the existing new_customer.sh script from broerup-infoskaerm.

Usage:
    from services.cms_provisioner import CMSProvisioner

    provisioner = CMSProvisioner()
    result = await provisioner.provision(customer_id, "vejle-hallerne", "Vejle Hallerne")
"""

import subprocess
import asyncio
import logging
import os
import secrets
import string
from typing import Optional, Dict, Any
from datetime import datetime
from sqlalchemy import select, func

from ..db import SessionLocal
from ..models import Customer

logger = logging.getLogger(__name__)

# Configuration
PROVISIONING_SCRIPT = os.environ.get(
    "CMS_PROVISIONING_SCRIPT",
    "/home/ubuntu/broerup-infoskaerm/scripts/new_customer.sh"
)
DEPLOY_SERVER = os.environ.get("CMS_DEPLOY_SERVER", "ufitech-docker-01")
DOMAIN_SUFFIX = os.environ.get("CMS_DOMAIN_SUFFIX", "screen.iocast.dk")

# Port allocation ranges
BASE_WEB_PORT = 45770  # Starting port for web (45770, 45780, 45790...)
BASE_DEPLOY_PORT = 9007  # Starting port for deploy webhooks (9007, 9008, 9009...)
PORT_INCREMENT = 10  # Increment for web ports


class CMSProvisioner:
    """
    Service for provisioning customer CMS instances.

    In production (on ufitech-docker-01), this calls the provisioning script directly.
    In development, it simulates provisioning for testing.
    """

    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.is_production = self._detect_environment()

    def _detect_environment(self) -> bool:
        """Detect if we're running on the deployment server."""
        hostname = os.uname().nodename
        return hostname == DEPLOY_SERVER or os.path.exists(PROVISIONING_SCRIPT)

    def get_next_available_ports(self) -> Dict[str, int]:
        """
        Find the next available ports for a new CMS instance.

        Returns:
            Dict with 'web_port' and 'deploy_port'
        """
        with SessionLocal() as session:
            # Find highest used web port
            result = session.execute(
                select(func.max(Customer.cms_docker_port))
            ).scalar()

            if result:
                next_web_port = result + PORT_INCREMENT
            else:
                next_web_port = BASE_WEB_PORT

            # Calculate deploy port based on web port sequence
            # 45770 -> 9007, 45780 -> 9008, 45790 -> 9009, etc.
            sequence = (next_web_port - BASE_WEB_PORT) // PORT_INCREMENT
            next_deploy_port = BASE_DEPLOY_PORT + sequence

            return {
                "web_port": next_web_port,
                "deploy_port": next_deploy_port
            }

    def generate_password(self, length: int = 12) -> str:
        """Generate a secure random password."""
        alphabet = string.ascii_letters + string.digits
        return ''.join(secrets.choice(alphabet) for _ in range(length))

    def generate_api_key(self) -> str:
        """Generate a secure API key for CMS external API."""
        return secrets.token_hex(32)

    def validate_subdomain(self, subdomain: str) -> bool:
        """
        Validate subdomain format.

        Rules:
        - Only lowercase letters, numbers, and hyphens
        - Cannot start or end with hyphen
        - 3-63 characters
        """
        import re
        if not subdomain:
            return False
        if len(subdomain) < 3 or len(subdomain) > 63:
            return False
        if not re.match(r'^[a-z0-9]([a-z0-9-]*[a-z0-9])?$', subdomain):
            return False
        return True

    async def provision(
        self,
        customer_id: int,
        subdomain: str,
        display_name: str,
        web_port: Optional[int] = None,
        deploy_port: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Provision a new CMS instance for a customer.

        Args:
            customer_id: Database ID of the customer
            subdomain: Subdomain for CMS (e.g., "vejle" -> vejle.screen.iocast.dk)
            display_name: Human-readable name for CMS branding
            web_port: Optional specific web port (auto-assigned if not provided)
            deploy_port: Optional specific deploy port (auto-assigned if not provided)

        Returns:
            Dict with provisioning results including credentials
        """
        # Validate subdomain
        if not self.validate_subdomain(subdomain):
            return {
                "success": False,
                "error": "Invalid subdomain format. Use lowercase letters, numbers, and hyphens only."
            }

        # Check if subdomain is already in use
        with SessionLocal() as session:
            existing = session.execute(
                select(Customer).where(Customer.cms_subdomain == subdomain)
            ).scalar()

            if existing and existing.id != customer_id:
                return {
                    "success": False,
                    "error": f"Subdomain '{subdomain}' is already in use"
                }

            customer = session.get(Customer, customer_id)
            if not customer:
                return {
                    "success": False,
                    "error": f"Customer {customer_id} not found"
                }

        # Get ports
        if not web_port or not deploy_port:
            ports = self.get_next_available_ports()
            web_port = web_port or ports["web_port"]
            deploy_port = deploy_port or ports["deploy_port"]

        # Generate credentials
        admin_password = self.generate_password()
        api_key = self.generate_api_key()

        logger.info(f"Provisioning CMS for customer {customer_id}: {subdomain}.{DOMAIN_SUFFIX}")

        # Update customer status to provisioning
        with SessionLocal() as session:
            customer = session.get(Customer, customer_id)
            customer.cms_status = "provisioning"
            customer.cms_subdomain = subdomain
            customer.cms_docker_port = web_port
            customer.cms_deploy_port = deploy_port
            session.commit()

        try:
            if self.dry_run:
                # Simulation mode
                result = await self._simulate_provision(
                    subdomain, display_name, web_port, deploy_port, admin_password
                )
            elif self.is_production:
                # Real provisioning via script
                result = await self._run_provision_script(
                    subdomain, display_name, web_port, deploy_port
                )
                # Script generates its own password, but we'll use ours
                result["admin_password"] = admin_password
            else:
                # Development mode - simulate
                logger.warning("Not on production server, simulating provisioning")
                result = await self._simulate_provision(
                    subdomain, display_name, web_port, deploy_port, admin_password
                )

            if result["success"]:
                # Update customer record with final status
                with SessionLocal() as session:
                    customer = session.get(Customer, customer_id)
                    customer.cms_status = "active"
                    customer.cms_api_key = api_key
                    customer.cms_admin_password = admin_password
                    customer.cms_provisioned_at = datetime.utcnow()
                    session.commit()

                result["api_key"] = api_key
                result["cms_url"] = f"https://{subdomain}.{DOMAIN_SUFFIX}"
                result["login_url"] = f"https://{subdomain}.{DOMAIN_SUFFIX}/login"

            else:
                # Mark as error
                with SessionLocal() as session:
                    customer = session.get(Customer, customer_id)
                    customer.cms_status = "error"
                    session.commit()

            return result

        except Exception as e:
            logger.exception(f"Provisioning failed for customer {customer_id}")

            # Mark as error
            with SessionLocal() as session:
                customer = session.get(Customer, customer_id)
                customer.cms_status = "error"
                session.commit()

            return {
                "success": False,
                "error": str(e)
            }

    async def _run_provision_script(
        self,
        subdomain: str,
        display_name: str,
        web_port: int,
        deploy_port: int
    ) -> Dict[str, Any]:
        """
        Run the actual provisioning script.

        The script handles:
        - GitHub repo creation
        - Docker container setup
        - Caddy reverse proxy config
        - Initial deployment
        """
        cmd = [
            PROVISIONING_SCRIPT,
            subdomain,
            display_name,
            str(web_port),
            str(deploy_port)
        ]

        logger.info(f"Running provisioning script: {' '.join(cmd)}")

        # Run script with automatic 'yes' confirmation
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        # Send 'y' to confirm prompt
        stdout, stderr = await process.communicate(input=b'y\n')

        stdout_text = stdout.decode()
        stderr_text = stderr.decode()

        if process.returncode != 0:
            logger.error(f"Provisioning script failed: {stderr_text}")
            return {
                "success": False,
                "error": f"Script exited with code {process.returncode}",
                "stdout": stdout_text,
                "stderr": stderr_text
            }

        # Parse output for generated credentials
        # The script outputs these lines:
        #   Username: admin
        #   Password: <generated>
        admin_password = None
        webhook_secret = None

        for line in stdout_text.split('\n'):
            if 'Password:' in line and 'ADMIN_PASSWORD' not in line:
                admin_password = line.split(':')[-1].strip()
            if 'Secret:' in line:
                webhook_secret = line.split(':')[-1].strip()

        return {
            "success": True,
            "subdomain": subdomain,
            "web_port": web_port,
            "deploy_port": deploy_port,
            "admin_password": admin_password,
            "webhook_secret": webhook_secret,
            "output": stdout_text
        }

    async def _simulate_provision(
        self,
        subdomain: str,
        display_name: str,
        web_port: int,
        deploy_port: int,
        admin_password: str
    ) -> Dict[str, Any]:
        """
        Simulate provisioning for development/testing.
        """
        logger.info(f"[SIMULATION] Would provision: {subdomain}")
        logger.info(f"[SIMULATION] Display name: {display_name}")
        logger.info(f"[SIMULATION] Ports: {web_port} (web), {deploy_port} (deploy)")

        # Simulate some delay
        await asyncio.sleep(1)

        return {
            "success": True,
            "subdomain": subdomain,
            "web_port": web_port,
            "deploy_port": deploy_port,
            "admin_password": admin_password,
            "webhook_secret": secrets.token_hex(20),
            "simulated": True
        }

    async def get_status(self, customer_id: int) -> Dict[str, Any]:
        """Get CMS provisioning status for a customer."""
        with SessionLocal() as session:
            customer = session.get(Customer, customer_id)
            if not customer:
                return {"error": "Customer not found"}

            return {
                "customer_id": customer_id,
                "cms_subdomain": customer.cms_subdomain,
                "cms_status": customer.cms_status,
                "cms_docker_port": customer.cms_docker_port,
                "cms_deploy_port": customer.cms_deploy_port,
                "cms_provisioned_at": customer.cms_provisioned_at,
                "cms_url": f"https://{customer.cms_subdomain}.{DOMAIN_SUFFIX}" if customer.cms_subdomain else None
            }

    async def stop_cms(self, customer_id: int) -> Dict[str, Any]:
        """Stop a customer's CMS containers."""
        with SessionLocal() as session:
            customer = session.get(Customer, customer_id)
            if not customer or not customer.cms_subdomain:
                return {"success": False, "error": "No CMS configured"}

            subdomain = customer.cms_subdomain

        if self.dry_run or not self.is_production:
            logger.info(f"[SIMULATION] Would stop CMS: {subdomain}")
            return {"success": True, "simulated": True}

        project_name = f"{subdomain}-infoskaerm"
        cmd = f"cd /home/ubuntu/{project_name} && docker compose stop"

        process = await asyncio.create_subprocess_shell(
            f"ssh ubuntu@{DEPLOY_SERVER} '{cmd}'",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        stdout, stderr = await process.communicate()

        if process.returncode != 0:
            return {"success": False, "error": stderr.decode()}

        with SessionLocal() as session:
            customer = session.get(Customer, customer_id)
            customer.cms_status = "stopped"
            session.commit()

        return {"success": True}

    async def start_cms(self, customer_id: int) -> Dict[str, Any]:
        """Start a customer's CMS containers."""
        with SessionLocal() as session:
            customer = session.get(Customer, customer_id)
            if not customer or not customer.cms_subdomain:
                return {"success": False, "error": "No CMS configured"}

            subdomain = customer.cms_subdomain

        if self.dry_run or not self.is_production:
            logger.info(f"[SIMULATION] Would start CMS: {subdomain}")
            return {"success": True, "simulated": True}

        project_name = f"{subdomain}-infoskaerm"
        cmd = f"cd /home/ubuntu/{project_name} && docker compose up -d"

        process = await asyncio.create_subprocess_shell(
            f"ssh ubuntu@{DEPLOY_SERVER} '{cmd}'",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        stdout, stderr = await process.communicate()

        if process.returncode != 0:
            return {"success": False, "error": stderr.decode()}

        with SessionLocal() as session:
            customer = session.get(Customer, customer_id)
            customer.cms_status = "active"
            session.commit()

        return {"success": True}


# Singleton instance
_provisioner: Optional[CMSProvisioner] = None


def get_provisioner() -> CMSProvisioner:
    """Get the CMS provisioner singleton."""
    global _provisioner
    if _provisioner is None:
        _provisioner = CMSProvisioner()
    return _provisioner
