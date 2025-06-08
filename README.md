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

Структура backend-папки:
```
backend/
├── __init__.py              # Позволяет импортировать как модуль
├── main.py                  # Главный файл FastAPI: роуты, запуск сервера
├── s3_utils.py              # Утилиты для загрузки и чтения файлов из S3
├── requirements.txt         # Зависимости проекта
└── .env                     # Переменные окружения (не публикуется)
```


Перейди в папку backend
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

После запуска сервер будет доступен по адресу:
```
http://127.0.0.1:8000
```
## ✅ Тестирование backend

Проект использует pytest для тестирования API и логики

Убедитесь, что у вас установлен pytest:
```bash
pip install pytest
```

Для запуска всех тестов используйте следующую команду из корня проекта:

```bash
pytest test/test_api.py
```

## 📦 Деплой смарт-контрактов

Установите зависимости:
```bash
npm install
```
Создайте файл .env в корне проекта и Впишите приватный ключ от аккаунта Ganache (или любого другого EVM-сетевого аккаунта):
```
PRIVATE_KEY=ваш_приватный_ключ
```

Убедитесь что Hardhat настроен, В hardhat.config.js должен использоваться .env:

```
require("dotenv").config();
const { PRIVATE_KEY } = process.env;

module.exports = {
  solidity: "0.8.21",
  defaultNetwork: "localhost",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
      accounts: [PRIVATE_KEY]
    }
  }
};
```
📤 Деплой на локальный Ganache
  Убедитесь, что Ganache работает на http://127.0.0.1:7545, затем выполните:
```bash
npx hardhat run contracts/deploy.cjs --network ganache
```
📁 После деплоя
```
Скрипт автоматически:
Разворачивает 3 контракта: GameItemNFT, GameGems, GameMarketplace.
Сохраняет адреса в файл: contracts/contracts.json
Сохраняет ABI всех контрактов в src/contracts/*.json
Устанавливает связь между GameItemNFT и GameGems.
```
## ✅ Тестирование смарт-контрактов
Убедись, что установлен hardhat и все зависимости:
```bash
npm install
```
Затем запусти тесты:
```bash
npx hardhat test
```


