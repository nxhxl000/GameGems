import React, { createContext, useContext, useState } from "react";
import { ethers } from "ethers";
import axios from "axios";
import contractAddresses from '../contracts/contracts.json';
import GameGemsABI from "../contracts/GameGemsABI.json";
import GameItemABI from "../contracts/GameItemABI.json";
import GameMarketplaceABI from "../contracts/GameMarketplaceABI.json";


const Web3Context = createContext(null);
export { Web3Context };

const GEM_CONTRACT_ADDRESS = contractAddresses.GameGems;
const NFT_CONTRACT_ADDRESS = contractAddresses.GameItemNFT;
const MARKETPLACE_CONTRACT_ADDRESS = contractAddresses.GameMarketplace;


export const BACKEND_URL = "http://127.0.0.1:8000";

const getLocalGems = (address) => {
  const saved = JSON.parse(localStorage.getItem("localGems") || "{}");
  return saved[address.toLowerCase()] || 0;
};

const setLocalGemsForAddress = (address, value) => {
  const saved = JSON.parse(localStorage.getItem("localGems") || "{}");
  saved[address.toLowerCase()] = value;
  localStorage.setItem("localGems", JSON.stringify(saved));
};

export function Web3Provider({ children }) {
  const [account, setAccount] = useState(null);
  const [username, setUsername] = useState("");
  const [gems, setGems] = useState(0);
  const [gemContract, setGemContract] = useState(null);
  const [nftContract, setNftContract] = useState(null);
  const [marketplaceContract, setMarketplaceContract] = useState(null);
  const [view, setView] = useState("home");
  const [showModal, setShowModal] = useState(false);
  const [adminAddress, setAdminAddress] = useState(null);
  const [gemPrice, setGemPrice] = useState(null);
  const [txHistory, setTxHistory] = useState([]);
  const [onChainGems, setOnChainGems] = useState(0);
  const [localGemsState, setLocalGemsState] = useState(0);

  const localGems = localGemsState;

  const setLocalGems = (valueOrUpdater) => {
  if (!account) return;
  const current = getLocalGems(account);
  const newValue = typeof valueOrUpdater === "function"
    ? valueOrUpdater(current)
    : valueOrUpdater;
  setLocalGemsForAddress(account, newValue);
  setLocalGemsState(newValue);
};

  const addLocalGem = () => {
    if (!account) return;
    const current = getLocalGems(account);
    const newValue = current + 1;
    setLocalGems(newValue);
  };

  const connectWithMetamask = async () => {
    if (!window.ethereum) throw new Error("MetaMask не найден");

    const provider = new ethers.BrowserProvider(window.ethereum);
    const [address] = await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();

    const gameContract = new ethers.Contract(GEM_CONTRACT_ADDRESS, GameGemsABI, signer);
    const itemContract = new ethers.Contract(NFT_CONTRACT_ADDRESS, GameItemABI, signer);
    const marketplace = new ethers.Contract(MARKETPLACE_CONTRACT_ADDRESS, GameMarketplaceABI, signer); // ← 🎯

    setAccount(address);
    setGemContract(gameContract);
    setNftContract(itemContract);
    setMarketplaceContract(marketplace); // ← ✅

    return { address, gameContract, itemContract, provider };
  };

  // Обновлённая функция fetchHistory со всеми событиями
const fetchHistory = async () => {
  if (!account || !gemContract || !marketplaceContract) return;

  try {
    const browserProvider = new ethers.BrowserProvider(window.ethereum);
    const provider = browserProvider;

    const gem = new ethers.Contract(GEM_CONTRACT_ADDRESS, GameGemsABI, provider);
    const market = new ethers.Contract(MARKETPLACE_CONTRACT_ADDRESS, GameMarketplaceABI, provider);

    // События GameGems
    const [gemsPurchasedEvents, gemsDepositedEvents, itemWrappedEvents] = await Promise.all([
      gem.queryFilter(gem.filters.GemsPurchased(), 0, "latest"),
      gem.queryFilter(gem.filters.GemsDeposited(), 0, "latest"),
      gem.queryFilter(gem.filters.ItemWrapped(), 0, "latest")
    ]);

    // События Marketplace
    const [itemPurchasedEvents, paymentEvents] = await Promise.all([
      market.queryFilter(market.filters.ItemPurchased(), 0, "latest"),
      market.queryFilter(market.filters.MarketplacePayment(), 0, "latest")
    ]);

    // Обработка событий GameGems
    const purchased = gemsPurchasedEvents
      .filter(e => e.args?.buyer?.toLowerCase() === account.toLowerCase())
      .map(e => ({
        type: "Покупка GEM",
        value: `${e.args?.gemsReceived?.toString() || "—"}`,
        blockNumber: e.blockNumber,
        timestamp: null,
      }));

    const deposited = gemsDepositedEvents
      .filter(e => e.args?.player?.toLowerCase() === account.toLowerCase())
      .map(e => ({
        type: "Депозит GEM",
        value: `${e.args?.amountSent?.toString() || "—"}`,
        blockNumber: e.blockNumber,
        timestamp: null,
      }));

    const wrapped = itemWrappedEvents
      .filter(e => e.args?.player?.toLowerCase() === account.toLowerCase())
      .map(e => ({
        type: "Создание NFT",
        value: `${e.args?.tokenId?.toString() || "—"}`,
        blockNumber: e.blockNumber,
        timestamp: null,
      }));

    // Обработка событий Marketplace
    const boughtNFTs = itemPurchasedEvents
      .filter(e => e.args?.buyer?.toLowerCase() === account.toLowerCase())
      .map(e => ({
        type: "Покупка NFT",
        value: `Token #${e.args?.tokenId?.toString()} за ${e.args?.priceInGems?.toString() || "?"} GEM`,
        blockNumber: e.blockNumber,
        timestamp: null,
      }));

    const soldNFTs = paymentEvents
      .filter(e => e.args?.seller?.toLowerCase() === account.toLowerCase())
      .map(e => ({
        type: "Доход от продажи",
        value: `${e.args?.amount?.toString() || "?"} GEM (комиссия ${e.args?.commission?.toString() || "0"})`,
        blockNumber: e.blockNumber,
        timestamp: null,
      }));

    // Объединение и сортировка
    const all = [...purchased, ...deposited, ...wrapped, ...boughtNFTs, ...soldNFTs];
    all.sort((a, b) => b.blockNumber - a.blockNumber);

    const historyWithTimestamps = await Promise.all(
      all.map(async (tx) => {
        const block = await provider.getBlock(tx.blockNumber);
        return {
          ...tx,
          timestamp: block?.timestamp
            ? new Date(block.timestamp * 1000).toLocaleString()
            : "—",
        };
      })
    );

    setTxHistory(historyWithTimestamps);
    console.log("📜 История транзакций:", historyWithTimestamps);
  } catch (err) {
    console.error("Ошибка загрузки истории транзакций:", err);
  }
};



  const resetAppState = () => {
  setAccount(null);
  setUsername("");
  setGems(0);
  setGemContract(null);
  setNftContract(null);
  setAdminAddress(null);
  setGemPrice(null);
  setTxHistory([]);
  setLocalGemsState(0); // ← ВАЖНО: сброс локального баланса
  setView("home");
};

  const handleCreate = async ({ manual, manualAddress }) => {
  try {
    const address = manual
      ? manualAddress.toLowerCase()
      : (await window.ethereum.request({ method: "eth_requestAccounts" }))[0].toLowerCase();

    // 1. Проверяем наличие в S3
    const existing = await axios
      .get(`${BACKEND_URL}/profile/${address}`)
      .then(() => true)
      .catch((err) => {
        if (err.response?.status === 404) return false;
        throw err;
      });

    if (existing) {
      alert("Аккаунт с таким адресом уже существует в системе");
      return;
    }

    // 2. Создаём профиль в S3
    await axios.post(`${BACKEND_URL}/profile/`, {
      address,
      nickname: username || "Без имени",
    });

    alert("✅ Аккаунт успешно создан и сохранён в хранилище!");
    setShowModal(false);
  } catch (err) {
    console.error("Ошибка при создании аккаунта:", err);
    alert("❌ Не удалось создать аккаунт");
  }
};

  const handleLogin = async () => {
  try {
    const { address, gameContract, itemContract } = await connectWithMetamask();
    const cleanAddress = address.toLowerCase();

    // ✅ Запрос к бэкенду для проверки профиля
    const resp = await axios.get(`${BACKEND_URL}/profile/${cleanAddress}`).catch(() => null);

    if (!resp || !resp.data) {
      alert("❌ Профиль не найден. Сначала создайте аккаунт.");
      return;
    }

    const nickname = resp.data.nickname || "Без имени";

    setUsername(nickname);
    setAccount(cleanAddress);
    setGems(Number(await gameContract.balanceOf(cleanAddress)));
    setLocalGems(getLocalGems(cleanAddress));

     // 🔽 Загрузка gemPrice
    const price = await gameContract.gemPrice();
    setGemPrice(Number(price));

    setGemContract(gameContract);
    setNftContract(itemContract);
    setView("game");

    console.log(`📥 Загружено локальных GEM для ${cleanAddress}:`, getLocalGems(cleanAddress));
  } catch (err) {
    console.error("Ошибка входа:", err);
    alert("⚠️ Не удалось войти");
  }
};

  const handleAdminLogin = async () => {
  console.log("🔐 handleAdminLogin вызван");

  try {
    const { address, gameContract, itemContract } = await connectWithMetamask();
    const cleanAddress = address.toLowerCase();

    setAccount(cleanAddress);
    setGemContract(gameContract);
    setNftContract(itemContract);
    setLocalGems(getLocalGems(cleanAddress));

    

    setView("admin");
  } catch (err) {
    console.error("Ошибка при входе админа:", err);
    alert("Не удалось подключиться через MetaMask");
  }
};

  const sendLocalGemsToContract = async (amount) => {
    try {
      const tx = await gemContract.depositGems(amount);
      await tx.wait();
      const balance = await gemContract.balanceOf(account);
      setGems(Number(balance));
      await fetchHistory();
      return true;
    } catch (err) {
      console.error("Ошибка при отправке GEM в контракт:", err);
      return false;
    }
  };

  const buyGems = async (count) => {
    try {
      if (!gemContract || !gemPrice) return alert("Контракт не готов");

      const price = BigInt(gemPrice) * BigInt(count);
      const tx = await gemContract.buyGems({ value: price });
      await tx.wait();

      console.log(`✅ Куплено ${count} GEM за ${price} wei`);

      // 🔄 Обновление баланса после покупки
      const balance = await gemContract.balanceOf(account);
      setGems(Number(balance));

      await fetchHistory(); // если нужно
      return true;
    } catch (err) {
      console.error("❌ Ошибка при покупке GEM:", err);
      alert("Ошибка при покупке GEM. См. консоль.");
      return false;
    }
  };

  return (
    <Web3Context.Provider
      value={{
        account,
        username,
        setUsername,
        gems,
        setGems,
        gemContract,
        nftContract,
        marketplaceContract,
        view,
        setView,
        showModal,
        setShowModal,
        handleLogin,
        sendLocalGemsToContract,
        localGems,
        setLocalGems,
        addLocalGem,
        handleAdminLogin,
        handleCreate,
        fetchHistory,
        buyGems,
        txHistory,
        resetAppState,
        backendUrl: BACKEND_URL,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  return useContext(Web3Context);
}
