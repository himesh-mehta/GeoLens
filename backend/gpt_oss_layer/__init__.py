"""
GPT-OSS Reasoning and Natural Language Explanation Layer.
"""
from .reasoning_engine import GPTOssReasoningEngine
from .prompt_templates import MultimodalPromptBuilder

__all__ = ["GPTOssReasoningEngine", "MultimodalPromptBuilder"]
