# 🕹️ GameGems

**GameGems** — это Web3-игра-кликер с NFT-предметами, токеном GEM и торговой площадкой.  
Проект включает frontend на React, backend на FastAPI, смарт-контракты на Solidity и ML-модель для оценки цены NFT-предметов на рынке и предоставлении рекомендации по торговле.

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
Разворачивает 3 контракта: GameItemNFT, GameGems, GameMarketplace;
Сохраняет адреса в файл: contracts/contracts.json;
Сохраняет ABI всех контрактов в src/contracts/*.json;
Устанавливает связь между смарт-контрактами.
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

## 🧩 Frontend (React)
Фронтенд написан на React с использованием ethers.js, axios и контекста Web3.
📁 Структура проекта:
```
src/
├── assets/             # Изображения и медиафайлы
├── components/         # UI-компоненты (игровое поле, модалки, инвентарь и пр.)
├── contexts/           # Контексты, включая Web3Provider
├── contracts/          # ABI и адреса смарт-контрактов
├── hooks/              # Пользовательские хуки (например, useWeb3)
├── styles/             # CSS-стили для компонентов
├── utils/              # Вспомогательные утилиты (например, генерация предметов)
├── App.jsx             # Основной компонент приложения
├── main.jsx            # Точка входа
└── index.css           # Общие стили
```
⚙️ Установка и запуск
Перейдите в корень проекта (если вы уже там — пропустите):
```bash
cd gamegems-app
```
Установите зависимости (если не устанавливали ранее):
```bash
npm install
```
Установите зависимости (если не устанавливали ранее):
```bash
npm run dev
```
Перейдите в браузере по адресу:
```
http://localhost:5173/
```
## ✅ Тестирование Frontend 
Тесты написаны с использованием Jest и React Testing Library для основных компонентов интерфейса.
📁 Все тесты находятся в папке:
```
src/components/__tests__/
```
Каждый тест покрывает функциональность соответствующего компонента, включая:
```
Отображение элементов;
Взаимодействие (клики, ввод);
Граничные и ошибочные случаи.
```
Запуск всех тестов:
```bash
npm test
```
💡 Также можно включить покрытие (coverage):
```bash
npm test -- --coverage
```
## 📊 ML-модель: Оценка стоимости NFT-предметов
В проект встроена ML-модель на основе RandomForestRegressor, которая предсказывает рекомендованную цену NFT-предмета в GEM на основе следующих параметров:
```
itemType — тип предмета (например, Sword, Pickaxe и т.д.);
rarity — редкость (common, rare, epic, legendary);
bonusValue — численное значение бонуса;
price (опционально) — текущая цена, которую задал пользователь (используется для расчёта отклонения).
```
Модель обучена на синтетических данных (в дальнейшем возможна замена на более точную регрессию или ML-сервис).

📁 Модель хранится в ml_model/nft_price_regressor.pkl и используется в API-эндпойнте /predict-price.
🔬 Пример запроса:
```
POST /predict-price
{
  "itemType": "Sword",
  "rarity": "epic",
  "bonusValue": 14,
  "price": 80
}
```
🔁 Пример ответа:
```
POST /predict-price
{
  "status": "ok",
  "recommended_price": 72,
  "deviation": 11.11,
  "price_status": "завышена"
}
```
## ✅ Тестирование модели
Тесты для модели размещены в ml_model/test_model.py. Они покрывают оба варианта использования:
```
Предсказание без передачи price;
Предсказание с расчётом отклонения от предложенной цены;
Тесты API для модели проводились при backend тестировании. 
```
Запуск тестов:
```bash
cd ml_model
pytest test_model.py
```
## 🔧 CI / Continuous Integration
В проекте настроен CI-процесс с использованием GitHub Actions для автоматической проверки стабильности и корректности кода.
Что проверяет CI:
```
✅ Backend (FastAPI) — тесты с использованием pytest, включая логику API, работу с S3, и модель ценообразования.
✅ Smart Contracts (Solidity) — тесты через Hardhat для проверки работы контрактов GameGems, GameItemNFT, GameMarketplace.
✅ Frontend (React) — компонентные тесты с помощью Jest и React Testing Library.
✅ ML-модель — модульные тесты точности и целостности модели, обученной для предсказания цены NFT.
```

## 🤝 Благодарности

- [FastAPI](https://fastapi.tiangolo.com/)
- [Hardhat](https://hardhat.org/)
- [Vite](https://vitejs.dev/)
- [Hugging Face](https://huggingface.co/)

## Разработчики:  
- 🔧 Идея, Backend, смарт-контракты, Frontend, тесты: [Листратенков Глеб]  
- 💻 ML, тесты: [Овчаренко Сергей]  



