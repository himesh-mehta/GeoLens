import os
import json
import logging
try:
    from groq import Groq
except ImportError:
    Groq = None

logger = logging.getLogger(__name__)

SYSTEM_BASE_INSTRUCTION = '''You are a friendly, conversational assistant, not a report generator. Match your response length and tone to the user's message.
You are the SolveNest Earth Observation Analysis Assistant.

CRITICAL RULES:
1. For greetings like 'hi', 'hey', 'hello' — reply in 1-2 short, warm sentences only. Reference the current location if available (e.g. 'Hey! I'm ready to help you explore 20.5392°N, 79.0445°E. What would you like to know?'). NEVER produce the structured report format for a greeting.
2. For specific questions — answer directly and concisely in 2-4 sentences using available data. Do not default to the full structured report unless the user explicitly asks for a 'full analysis,' 'detailed report,' or clicks the 'What changed here?' suggested question.
3. Only produce the full Executive Summary / Land Cover Interpretation / Spectral Index Interpretation / Environmental Implications / Confidence & Limitations format when the user explicitly requests a comprehensive/detailed analysis.
4. Never invent measurements, probabilities, indices, classifications, or dates. Only use values supplied in the analysis context.
'''

def generate_ai_analysis(analysis_context: dict, question: str = None, previous_history: list = None) -> str:
    """Generates an AI analysis using Groq with dynamic response formatting and session memory."""
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return "Error: GROQ_API_KEY is not configured in the environment variables. Please add it to your .env file."
        
    if not analysis_context or len(analysis_context) == 0:
        return "GEE analysis data is unavailable."
    
    try:
        # 1. Extract Language & History
        language = "en"
        conversation_history = []

        if isinstance(analysis_context, dict):
            language = analysis_context.get("language") or analysis_context.get("context", {}).get("language") or "en"
            conversation_history = analysis_context.get("conversation_history") or previous_history or []
        else:
            conversation_history = previous_history or []

        lang_instruction = ""
        if language == "hi":
            lang_instruction = "\nIMPORTANT: You MUST respond entirely in clear, natural Hindi (हिन्दी) language."
        elif language == "mr":
            lang_instruction = "\nIMPORTANT: You MUST respond entirely in clear, natural Marathi (मराठी) language."

        # 2. Question Classification & Format Routing
        q_lower = (question or "").strip().lower()
        
        # Check if greeting
        greeting_words = {"hey", "hii", "hi", "hello", "hey there", "namaste", "hi!", "hello!", "hey!", "hii!", "hey assistant", "yo", "sup"}
        is_greeting = q_lower in greeting_words or (len(q_lower) <= 8 and any(q_lower.startswith(g) for g in ["hey", "hii", "hello", "hi", "yo"]))

        # Check if full analysis requested
        full_analysis_keywords = [
            "what changed here", "full analysis", "full report", "detailed report",
            "complete analysis", "analyze result", "give me the full analysis", "detailed breakdown", "give me a full analysis"
        ]
        is_full_analysis_req = any(kw in q_lower for kw in full_analysis_keywords)

        if is_greeting:
            format_instruction = """
FORMAT INSTRUCTION:
The user sent a casual greeting ('hi', 'hey', 'hello'). Reply in 1-2 short, warm sentences only. Reference the current location coordinates or name if available.
NEVER produce the 5-section report format, markdown table, or structured headings for a greeting. Keep it natural, warm, and brief.
Example: "Hey! I'm ready to help you explore 20.5392°N, 79.0445°E (Nashik District). What would you like to know about this location?"
"""
        elif not is_full_analysis_req:
            format_instruction = """
FORMAT INSTRUCTION:
The user is asking a specific question. Answer directly and concisely in 2-4 sentences using available vegetation/spectral data (NDVI, NDWI, NDBI, land cover) from context.
DO NOT default to the full 5-section structured report template unless explicitly asked.
"""
        else:
            format_instruction = """
FORMAT INSTRUCTION:
The user explicitly requested a comprehensive/full analysis. Provide a complete structured report using markdown headers:
### Executive Summary
### Land Cover Interpretation
### Spectral Index Interpretation
### Environmental Implications
### Confidence & Limitations
"""

        sys_prompt = SYSTEM_BASE_INSTRUCTION + format_instruction + lang_instruction
        
        # 3. Format Context
        context_str = json.dumps(analysis_context, indent=2)
        user_prompt = f"Here is the current SolveNest analysis context:\n{context_str}\n\n"
        if question:
            user_prompt += f"User Question: {question}\n"
        else:
            user_prompt += "Please provide an AI Analysis based on this context following your system instructions."
            
        # 4. Build Messages Array with Conversation History Memory
        messages_payload = [{"role": "system", "content": sys_prompt}]

        if isinstance(conversation_history, list):
            for turn in conversation_history:
                if isinstance(turn, dict) and "role" in turn and "content" in turn:
                    # Map role to valid openai/groq roles ('user', 'assistant')
                    role = 'assistant' if turn['role'] in ['assistant', 'ai'] else 'user'
                    messages_payload.append({
                        "role": role,
                        "content": str(turn['content'])
                    })

        messages_payload.append({"role": "user", "content": user_prompt})
        
        # Coalesce consecutive messages with the same role (required by Llama 3 API)
        coalesced_messages = []
        for msg in messages_payload:
            if not coalesced_messages:
                coalesced_messages.append(msg)
            elif coalesced_messages[-1]["role"] == msg["role"]:
                coalesced_messages[-1]["content"] += "\n\n" + msg["content"]
            else:
                coalesced_messages.append(msg)
                
        client = Groq(api_key=api_key)
        
        completion = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=coalesced_messages,
            temperature=0.2
        )
        
        return completion.choices[0].message.content
        
    except Exception as e:
        logger.error(f"Groq API Error: {str(e)}")
        return "AI analysis is temporarily unavailable. Please check the AI service configuration."

def generate_structured_image_analysis(analysis_context: dict) -> dict:
    """Generates a structured AI analysis using Groq JSON mode."""
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return {"error": "Error: GROQ_API_KEY is not configured"}
        
    if not analysis_context or len(analysis_context) == 0:
        return {"error": "GEE analysis data is unavailable."}
    
    try:
        sys_prompt = '''You are the SolveNest Earth Observation Analysis Assistant.
Analyze the provided image vision analysis context and return ONLY a valid JSON object matching this exact structure:
{
  "executive_summary": "A high-level 2-3 sentence summary of the main land-cover features.",
  "land_cover_interpretation": "Detailed interpretation of the dominant land cover and what it signifies."
}
IMPORTANT RULES:
1. Never invent measurements or fabricate data. Use ONLY the supplied data.
2. If `is_quantitative` is false or spectral data (NDVI, NDWI, etc.) is missing, you MUST include this exact sentence in your executive_summary: "The uploaded image does not provide sufficient multispectral information for quantitative spectral-index analysis."
3. Do not invent accuracy, pixel counts, acquisition dates, or coordinates.
4. You must ONLY explain values already present in the backend response.'''
        
        context_str = json.dumps(analysis_context, indent=2)
        user_prompt = "Here is the current SolveNest image analysis context:\n" + context_str + "\n\nProvide the structured JSON response."
        
        client = Groq(api_key=api_key)
        
        completion = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.1
        )
        
        content = completion.choices[0].message.content
        return json.loads(content)
        
    except Exception as e:
        logger.error(f"Groq structured analysis Error: {str(e)}")
        return {"error": "AI analysis is temporarily unavailable. Please check the AI service configuration."}
