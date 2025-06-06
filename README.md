# 🕹️ GameGems

**GameGems** — это Web3-игра-кликер с NFT-предметами, токеном GEM и торговой площадкой.  
Проект включает frontend на React, backend на FastAPI, смарт-контракты на Solidity и ML-модель для оценки предметов.

---

## 📥 Клонирование репозитория

```bash
git clone https://github.com/nxhxl000/GameGems.git
cd GameGems
```

---

## 🚀 Запуск backend (FastAPI)

```bash
cd backend
```

Создай `.env` файл в папке `backend/`:

```env
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_ENDPOINT_URL=https://storage.yandexcloud.net
S3_BUCKET_NAME=your-bucket-name
```

Установи зависимости:

```bash
pip install -r requirements.txt
```

Запусти сервер:

```bash
uvicorn main:app --reload
```
