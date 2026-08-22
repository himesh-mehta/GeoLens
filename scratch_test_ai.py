import requests
import json

resp = requests.post('http://127.0.0.1:5000/api/ai/analyze', json={
    'analysis_result': {'NDVI': 0.4057, 'NDWI': -0.5170, 'BSI': 0.1100, 'SAVI': 0.2506, 'Land Cover': 'Built-up', 'Class Probability': '38.1%'},
    'question': 'What changed here?'
})

data = resp.json()
print("Status:", data.get("status"))
# Write to file to avoid encoding issues
with open("ai_test_result.txt", "w", encoding="utf-8") as f:
    f.write(json.dumps(data, indent=2, ensure_ascii=False))
print("Response written to ai_test_result.txt")
print("Has error?", "Error" in data.get("analysis", ""))
