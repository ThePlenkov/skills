"""Skeleton of a Harbor installed agent that drives Devin CLI.

This is a starting point. Devin CLI must be available inside the sandbox,
either baked into the task/environment image or installed here.
"""
import os
import shlex

from harbor.agents.installed.base import BaseInstalledAgent, with_prompt_template
from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext


class DevinAgent(BaseInstalledAgent):
    @with_prompt_template
    async def run(
        self,
        instruction: str,
        environment: BaseEnvironment,
        context: AgentContext,
    ) -> None:
        # Non-interactive Devin run. Assumes `devin` is on PATH and authenticated.
        # The output path is configurable so the harness is not tied to /workspace.
        output_path = os.environ.get("DEVIN_OUTPUT_PATH", "devin-output.json")
        quoted = shlex.quote(instruction)
        await self.exec_as_agent(
            environment,
            command=f"devin -p {quoted} --export {shlex.quote(output_path)}",
        )

    async def install(self, environment: BaseEnvironment) -> None:
        # Optional: install Devin CLI inside the sandbox.
        # This requires a Linux binary/installer and auth credentials.
        # For now, assume the base image already contains `devin`.
        pass
