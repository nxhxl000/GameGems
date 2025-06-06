import { useState } from "react";
import { ethers } from "ethers";
import contractAddresses from '../contracts/contracts.json';
import GameGemsABI from "../contracts/GameGemsABI.json";
import GameItemNFTABI from "../contracts/GameItemABI.json";

const GEM_CONTRACT_ADDRESS = "0xAa013a000781fA897596134FB2C5223cccF10E0d";
const NFT_CONTRACT_ADDRESS = "0xe719bc5785D4Dfc86dC7406b3bCC6b27ba4ac78f";

export default function useWeb3() {
  const [account, setAccount] = useState(null);
  const [username, setUsername] = useState("");
  const [gems, setGems] = useState(0);
  const [gemPrice, setGemPrice] = useState(0);
  const [gemContract, setGemContract] = useState(null);
  const [nftContract, setNftContract] = useState(null);
  const [view, setView] = useState("home");
  const [showModal, setShowModal] = useState(false);
  const [adminAddress, setAdminAddress] = useState(null);

  const connectWithMetamask = async () => {
    if (!window.ethereum) {
      alert("Установите MetaMask");
      throw new Error("No MetaMask");
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const [address] = await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();

    const gameContract = new ethers.Contract(GEM_CONTRACT_ADDRESS, GameGemsABI, signer);
    const itemContract = new ethers.Contract(NFT_CONTRACT_ADDRESS, GameItemNFTABI, signer);

    setGemContract(gameContract);
    setNftContract(itemContract);
    setAccount(address);

    try {
      const rawPrice = await gameContract.gemPrice();
      const oneGemInEth = Number(ethers.formatEther(rawPrice));
      setGemPrice(oneGemInEth);
    } catch (err) {
      console.warn("gemPrice() недоступен или не нужен в текущей логике");
    }

    return { address, gameContract, itemContract };
  };

  const saveAccount = (username, address) => {
    const saved = JSON.parse(localStorage.getItem("savedAccounts") || "[]");
    const updated = [...saved, { username, address }];
    localStorage.setItem("savedAccounts", JSON.stringify(updated));
  };

  const handleCreate = async ({ manual, manualAddress }) => {
    if (!username.trim()) return alert("Введите имя");

    let address = manual ? manualAddress : null;
    let gameContract = gemContract;
    let itemContract = nftContract;

    if (!manual) {
      const res = await connectWithMetamask();
      address = res.address;
      gameContract = res.gameContract;
      itemContract = res.itemContract;
    }

    if (!ethers.isAddress(address)) return alert("Некорректный адрес");

    const saved = JSON.parse(localStorage.getItem("savedAccounts") || "[]");
    if (!saved.find(acc => acc.address.toLowerCase() === address.toLowerCase())) {
      saveAccount(username, address);
    }

    if (gameContract) {
      const balance = await gameContract.getMyBalance();
      setGems(Number(balance));
    }

    setAccount(address);
    setShowModal(false);
    setView("game");
  };

  const handleLogin = async () => {
    try {
      const { address, gameContract, itemContract } = await connectWithMetamask();
      const saved = JSON.parse(localStorage.getItem("savedAccounts") || "[]");
      const user = saved.find(acc => acc.address.toLowerCase() === address.toLowerCase());
      if (!user) return alert("Аккаунт не найден");

      const balance = await gameContract.getMyBalance();
      setGems(Number(balance));
      setUsername(user.username);
      setAccount(address);
      setGemContract(gameContract);
      setNftContract(itemContract);
      setView("game");
    } catch (err) {
      console.error("Ошибка входа:", err);
    }
  };

  const handleAdminLogin = async () => {
    try {
      const { address, gameContract } = await connectWithMetamask();
      const adminAddr = await gameContract.admin();
      if (address.toLowerCase() !== adminAddr.toLowerCase()) {
        return alert("Вы не админ");
      }

      setAccount(address);
      setGemContract(gameContract);
      setAdminAddress(adminAddr);
      setView("admin");
    } catch (err) {
      console.error("Ошибка входа как админ:", err);
    }
  };

  const sendLocalGemsToContract = async (localAmount) => {
    try {
      if (!gemContract || !account) throw new Error("Контракт не загружен");
      const tx = await gemContract.depositGems(BigInt(localAmount));
      await tx.wait();
      const balance = await gemContract.getMyBalance();
      setGems(Number(balance));
      return true;
    } catch (err) {
      console.error("Ошибка при отправке локальных GEM:", err);
      return false;
    }
  };

  const buyGems = async (count) => {
    try {
      if (!gemContract || !account || gemPrice === 0) throw new Error("Контракт не инициализирован");

      const priceInWei = await gemContract.gemPrice();
      const totalCost = priceInWei * BigInt(count);
      const tx = await gemContract.buyGems(count, { value: totalCost });
      await tx.wait();

      const balance = await gemContract.getMyBalance();
      setGems(Number(balance));
    } catch (err) {
      console.error("Ошибка покупки GEM:", err);
      alert("Ошибка при покупке GEM. См. консоль.");
    }
  };

  const resetAppState = () => {
    setAccount(null);
    setUsername("");
    setGems(0);
    setGemPrice(0);
    setGemContract(null);
    setNftContract(null);
    setAdminAddress(null);
    setShowModal(false);
    setView("home");
  };

  return {
    account,
    username,
    setUsername,
    gems,
    gemPrice,
    gemContract,
    setGemContract,
    nftContract,
    setNftContract,
    view,
    setView,
    showModal,
    setShowModal,
    handleCreate,
    handleLogin,
    handleAdminLogin,
    adminAddress,
    setGems,
    sendLocalGemsToContract,
    buyGems,
    resetAppState,
  };
}
