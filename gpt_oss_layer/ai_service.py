import os
import json
import logging
import requests

logger = logging.getLogger(__name__)

api_key = os.environ.get("GROQ_API_KEY")

SYSTEM_INSTRUCTION = '''
You are the SolveNest Earth Observation Analysis Assistant.

Your job is to interpret Earth observation and machine-learning results supplied by SolveNest.

Never invent measurements, probabilities, indices, classifications, or validation metrics.
Only use values supplied in the analysis context.

Clearly distinguish prediction probability from model accuracy.
Do not present inference results as independently validated ground truth.

Explain uncertainty whenever the probability distribution is ambiguous.

Interpret NDVI, NDWI/MNDWI, NDBI, BSI, SAVI, EVI, Sentinel-1 VV/VH and other features scientifically but cautiously.
Do not claim causation from a single index.

When information is missing, explicitly say that it is unavailable.

Give concise, understandable explanations suitable for a student/research/project demonstration.

Base every conclusion on the supplied SolveNest result.

Structure your response clearly with these sections (if applicable):
- Overall Interpretation
- Class Probability Analysis
- Spectral Evidence
- SAR Evidence
- Confidence & Limitations
- Recommended Next Steps

If the user is asking a follow-up question, answer it directly using the current context while maintaining these safety rules.
'''

SYSTEM_INSTRUCTION_COMPARISON = '''
You are the SolveNest Earth Observation Analysis Assistant specializing in Multi-Temporal Land Cover Comparison.

Your job is to interpret the JSON difference between two time periods supplied in the context.

CRITICAL RULES:
1. Never invent measurements, indices, or land cover percentages. Use ONLY the supplied JSON comparison data.
2. If data is identical or missing, explicitly state it.
3. Your analysis will be used in a professional PDF report. Keep it structured, objective, and scientific.

Please provide your analysis strictly with these sections using markdown:
### Executive Summary
### Land Cover Interpretation
### Spectral Index Interpretation
### Environmental Implications
### Confidence & Limitations
'''

def generate_ai_analysis(analysis_context: dict, question: str = None, previous_history: list = None) -> str:
    """Generates an AI analysis using Groq."""
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return "Error: GROQ_API_KEY is not configured in the environment variables. Please add it to your .env file."
        
    if not analysis_context or len(analysis_context) == 0:
        return "GEE analysis data is unavailable."
    
    try:
        is_comparison = "comparison" in analysis_context or "changes" in analysis_context
        sys_prompt = SYSTEM_INSTRUCTION_COMPARISON if is_comparison else SYSTEM_INSTRUCTION
        
        context_str = json.dumps(analysis_context, indent=2)
        print("=== SENDING TO GROQ ===")
        print(context_str)
        print("=======================")
        
        user_prompt = "Here is the current SolveNest analysis context:\n" + context_str + "\n\n"
        if question:
            user_prompt += f"User Question: {question}\n"
        else:
            user_prompt += "Please provide a comprehensive AI Analysis based on this context following your system instructions. Do not invent any numerical values. Only use values from the JSON."
            
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": "openai/gpt-oss-120b",
            "messages": [
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.1
        }
        
        response = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]
        
    except Exception as e:
        logger.warning(f"Groq API unavailable ({str(e)})")
        return f"Error: Failed to generate AI analysis. {str(e)}"

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
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": "openai/gpt-oss-120b",
            "messages": [
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1
        }
        
        response = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        
        content = response.json()["choices"][0]["message"]["content"]
        return json.loads(content)
        
    except Exception as e:
        logger.warning(f"Groq structured analysis unavailable ({str(e)})")
        return {"error": f"Failed to generate structured AI analysis. {str(e)}"}
