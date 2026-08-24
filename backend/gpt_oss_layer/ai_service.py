import os
import json
import logging
try:
    from groq import Groq
except ImportError:
    Groq = None

logger = logging.getLogger(__name__)

SYSTEM_BASE_INSTRUCTION = '''Your name is Orbit. You are Orbit, the GeoLens Earth Observation AI Assistant. You are a friendly, conversational assistant. When asked about your name, identity, or role, always introduce yourself as Orbit.

CRITICAL NUMERICAL ACCURACY DIRECTIVES (STRICT ZERO-HALLUCINATION ENFORCEMENT):
1. You MUST ONLY cite numerical values (NDVI, NDWI, NDBI, SAVI, confidence %, coordinates) that are EXPLICITLY provided in the "ACTIVE SINGLE SOURCE OF TRUTH" context block below.
2. NEVER estimate, calculate, invent, round significantly, or substitute index values or index names.
3. If an index (such as MNDWI, BSI, EVI) is NOT listed in the active context, state clearly: "That index is not available in the current analysis" — DO NOT GUESS OR INVENT A VALUE FOR IT.
4. When stating confidence or prediction probabilities, cite the exact percentage/value from the active context (e.g., 85%). Never state conflicting numbers.
'''

def _extract_active_source_of_truth(analysis_context: dict) -> dict:
    """Extracts and normalizes the active UI displayed analysis result as the single source of truth."""
    if not isinstance(analysis_context, dict):
        return {}

    # Check top-level or nested keys
    source = (
        analysis_context.get("analysisResult") or
        analysis_context.get("analysis_result") or
        analysis_context.get("active_analysis") or
        analysis_context.get("point_data") or
        analysis_context
    )

    pred_class = (
        source.get("predictedClass") or
        source.get("predicted_class") or
        source.get("class_name") or
        source.get("land_cover")
    )
    
    raw_conf = (
        source.get("confidence") or
        source.get("classProbability") or
        source.get("probability") or
        source.get("confidence_level")
    )
    
    conf_pct = None
    conf_dec = None
    if raw_conf is not None:
        try:
            val = float(raw_conf)
            if val <= 1.0:
                conf_dec = round(val, 4)
                conf_pct = round(val * 100, 1)
            else:
                conf_pct = round(val, 1)
                conf_dec = round(val / 100.0, 4)
        except (ValueError, TypeError):
            pass

    # Extract spectral indices
    indices_raw = (
        source.get("spectralIndices") or
        source.get("spectral_indices") or
        source.get("features") or
        {}
    )
    
    indices = {}
    if isinstance(indices_raw, dict):
        for k, v in indices_raw.items():
            try:
                indices[k.upper()] = round(float(v), 4)
            except (ValueError, TypeError):
                pass

    # Location / coordinates
    loc = source.get("location") or analysis_context.get("region") or "Selected Location"
    coords = None
    if isinstance(loc, dict):
        lat, lon = loc.get("lat"), loc.get("lon")
        if lat is not None and lon is not None:
            coords = f"({lat:.4f}, {lon:.4f})"
            loc = f"Point {coords}"

    features_raw = source.get("features") or analysis_context.get("features")
    feature_list = []
    if isinstance(features_raw, list):
        for idx, f in enumerate(features_raw[:25]):
            if isinstance(f, dict):
                f_name = f.get("name") or f"Feature {f.get('id', idx+1)}"
                feature_list.append({
                    "name": f_name,
                    "ndvi_change": f.get("ndvi_change"),
                    "ndwi_change": f.get("ndwi_change"),
                    "ndbi_change": f.get("ndbi_change"),
                    "mndwi_change": f.get("mndwi_change"),
                    "bsi_change": f.get("bsi_change"),
                    "savi_change": f.get("savi_change"),
                    "period1": f.get("period1_metrics"),
                    "period2": f.get("period2_metrics")
                })

    return {
        "location": loc,
        "coords": coords,
        "predictedClass": pred_class,
        "confidence_pct": conf_pct,
        "confidence_dec": conf_dec,
        "spectralIndices": indices,
        "features": feature_list
    }

def generate_ai_analysis(analysis_context: dict, question: str = None, previous_history: list = None) -> str:
    """Generates an AI analysis using Groq with dynamic response formatting and session memory."""
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        try:
            from dotenv import load_dotenv
            load_dotenv()
            load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))
            load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env"))
            api_key = os.environ.get("GROQ_API_KEY")
        except Exception:
            pass

    if not api_key:
        return "Error: GROQ_API_KEY is not configured in the environment variables. Please add it to your .env file."
        
    if not analysis_context:
        analysis_context = {}

    # Extract Single Source of Truth
    truth = _extract_active_source_of_truth(analysis_context)

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
        
        greeting_words = {"hey", "hii", "hi", "hello", "hey there", "namaste", "hi!", "hello!", "hey!", "hii!", "hey assistant", "yo", "sup"}
        is_greeting = q_lower in greeting_words or (len(q_lower) <= 8 and any(q_lower.startswith(g) for g in ["hey", "hii", "hello", "hi", "yo"]))

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
"""
        elif not is_full_analysis_req:
            format_instruction = """
FORMAT INSTRUCTION:
The user is asking a specific question. Answer directly and concisely in 2-4 sentences using ONLY the exact spectral indices, feature metrics, and confidence values listed in the ACTIVE SINGLE SOURCE OF TRUTH block below.
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
        
        # 3. Format Single Source of Truth Prompt Payload
        truth_lines = [
            "======================================================================",
            "ACTIVE SINGLE SOURCE OF TRUTH (UI DISPLAYED METRICS FOR THIS LOCATION)",
            "======================================================================",
            f"Location / Region: {truth.get('location') or 'Selected Location'}",
        ]
        if truth.get("predictedClass"):
            truth_lines.append(f"Predicted Land Cover Class: {truth.get('predictedClass')}")
        if truth.get("confidence_pct") is not None:
            truth_lines.append(f"Prediction Confidence Score: {truth.get('confidence_pct')}% (decimal: {truth.get('confidence_dec')})")
        
        indices = truth.get("spectralIndices") or {}
        if indices:
            truth_lines.append("Computed Spectral Indices (EXACT COMPUTED VALUES):")
            for k, v in indices.items():
                truth_lines.append(f"  - {k}: {v}")
        else:
            truth_lines.append("Computed Spectral Indices: None available for this specific query")

        feature_stats = truth.get("features") or []
        if feature_stats:
            truth_lines.append("Feature-Level Breakdown (Per-Feature Vector Attributes):")
            for f in feature_stats[:20]:
                truth_lines.append(f"  - {f['name']}: NDVI Change={f.get('ndvi_change')}, NDWI Change={f.get('ndwi_change')}, NDBI Change={f.get('ndbi_change')}")
                if f.get("period1") or f.get("period2"):
                    truth_lines.append(f"    * Period 1: {f.get('period1')}")
                    truth_lines.append(f"    * Period 2: {f.get('period2')}")

        truth_lines.append("======================================================================")
        truth_block = "\n".join(truth_lines)
        
        # Create a lightweight copy of context for raw background (strip heavy GIS geometry arrays)
        raw_ctx_copy = {}
        if isinstance(analysis_context, dict):
            for k, v in analysis_context.items():
                if k in ("geojson", "geometry", "coordinates", "border_points"):
                    continue
                if k == "features" and isinstance(v, list):
                    # Keep compact feature summary for up to 10 items
                    compact_feats = []
                    for item in v[:10]:
                        if isinstance(item, dict):
                            compact_feats.append({
                                "id": item.get("feature_id") or item.get("id"),
                                "ndvi_change": item.get("ndvi_change"),
                                "ndwi_change": item.get("ndwi_change"),
                                "ndbi_change": item.get("ndbi_change")
                            })
                    raw_ctx_copy["features"] = compact_feats
                else:
                    raw_ctx_copy[k] = v

        user_prompt = f"{truth_block}\n\nBackground Context Summary:\n{json.dumps(raw_ctx_copy, indent=2)}\n\n"
        if question:
            user_prompt += f"User Question: {question}\n"
        else:
            user_prompt += "Please provide an AI Analysis based on this context following your system instructions."
            
        # 4. Build Messages Array with Conversation History Memory
        messages_payload = [{"role": "system", "content": sys_prompt}]

        if isinstance(conversation_history, list):
            for turn in conversation_history:
                if isinstance(turn, dict) and "role" in turn and "content" in turn:
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
        
        models_to_try = ["openai/gpt-oss-120b", "groq/compound", "openai/gpt-oss-20b"]
        completion = None
        last_err = None
        for m in models_to_try:
            try:
                completion = client.chat.completions.create(
                    model=m,
                    messages=coalesced_messages,
                    temperature=0.1
                )
                break
            except Exception as ex:
                last_err = ex
                continue

        if completion:
            response_text = completion.choices[0].message.content
            
            # --- NUMERICAL CITATION VALIDATION & AUDIT LOGGING ---
            logger.info(f"[Numerical Audit] Question: '{question}'")
            logger.info(f"[Numerical Audit] Source of Truth -> Class: {truth.get('predictedClass')}, Conf: {truth.get('confidence_pct')}%, Indices: {truth.get('spectralIndices')}")
            
            return response_text
        raise last_err or RuntimeError("No Groq model available.")
        
    except Exception as e:
        logger.error(f"Groq API Error: {str(e)}")
        err_msg = str(e)
        q_lower = (question or "").lower()
        loc = truth.get("location") or "this location"
        pred = truth.get("predictedClass") or "Unknown"
        conf_str = f"{truth.get('confidence_pct')}%" if truth.get('confidence_pct') is not None else "N/A"
        indices = truth.get("spectralIndices") or {}
        indices_str = ", ".join([f"{k}: {v}" for k, v in indices.items()]) if indices else "No spectral indices available for this point"

        prefix = f"⚠️ [Groq API Unavailable - Fallback Mode: {err_msg}]\n\n"

        if "hello" in q_lower or "hi" in q_lower or "hey" in q_lower or "name" in q_lower:
            return (
                f"{prefix}Hello! I am Orbit, the GeoLens Earth Intelligence AI Assistant. "
                f"I am currently operating in fallback mode. How can I help you analyze geospatial data for {loc}?"
            )
        else:
            return (
                f"{prefix}**[ML Results]** Location **{loc}** is classified as **{pred}** (Confidence: **{conf_str}**).\n\n"
                f"**[Spectral Analysis]** {indices_str}."
            )

def generate_structured_image_analysis(analysis_context: dict) -> dict:
    """Generates a structured AI analysis using Groq JSON mode."""
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return {"error": "Error: GROQ_API_KEY is not configured"}
        
    if not analysis_context or len(analysis_context) == 0:
        return {"error": "GEE analysis data is unavailable."}
    
    try:
        sys_prompt = '''You are Orbit, the GeoLens Earth Observation Analysis Assistant.
You provide clear, accurate, and scientific analysis of satellite imagery, multi-spectral indices (NDVI, NDWI, MNDWI, NDBI, BSI, SAVI), and machine learning land-cover classification data.
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
        
        models_to_try = ["openai/gpt-oss-120b", "groq/compound", "openai/gpt-oss-20b"]
        completion = None
        last_err = None
        for m in models_to_try:
            try:
                completion = client.chat.completions.create(
                    model=m,
                    messages=[
                        {"role": "system", "content": sys_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.1
                )
                break
            except Exception as ex:
                last_err = ex
                continue

        if completion:
            content = completion.choices[0].message.content
            return json.loads(content)
        raise last_err or RuntimeError("No Groq model available.")
        
    except Exception as e:
        logger.error(f"Groq structured analysis Error: {str(e)}")
        return {"error": "AI analysis is temporarily unavailable. Please check the AI service configuration."}
