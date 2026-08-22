import requests
resp = requests.post("http://127.0.0.1:5000/api/predict/location", json={"latitude": 20.5937, "longitude": 78.9629, "year": 2024})
print(resp.json())
