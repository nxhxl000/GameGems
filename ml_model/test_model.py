import sys
import os
import pytest
import pandas as pd
from fastapi.testclient import TestClient

# Добавляем корень проекта в sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.main import app  # Импортируем FastAPI-приложение

client = TestClient(app)

def test_predict_price_without_price():
    payload = {
        "itemType": "Sword",
        "rarity": "rare",
        "bonusValue": 12
    }
    response = client.post("/predict-price", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "recommended_price" in data
    assert isinstance(data["recommended_price"], (int, float))

def test_predict_price_with_price():
    payload = {
        "itemType": "Sword",
        "rarity": "rare",
        "bonusValue": 12,
        "price": 60.0
    }
    response = client.post("/predict-price", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "recommended_price" in data
    assert "deviation" in data
    assert "price_status" in data