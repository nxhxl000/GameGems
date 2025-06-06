import { useState, useEffect } from "react";
import { ethers } from "ethers";
import axios from "axios";
import { BACKEND_URL } from "../contexts/Web3Provider";

export default function useAdminData(contract, isActive, currentAccount) {
  const [totalSupply, setTotalSupply] = useState(0);
  const [availableForSale, setAvailableForSale] = useState(0);
  const [accounts, setAccounts] = useState([]);
  const [ethBalance, setEthBalance] = useState(0);
  const [adminAddress, setAdminAddress] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminReady, setIsAdminReady] = useState(false);

  const refreshAdminData = async () => {
    console.log("🔁 refreshAdminData вызван");
    if (!contract || !contract.runner?.provider) {
      console.warn("⚠️ Нет контракта или provider");
      return;
    }

    try {
      console.log("📡 Получаем totalSupply и admin...");
      const [supplyRaw, adminAddr, availableRaw] = await Promise.all([
        contract.totalSupply(),
        contract.admin(),
        contract.availableForSale(), // ← добавили это
      ]);

      console.log("✅ admin =", adminAddr, " currentAccount =", currentAccount);

      setAdminAddress(adminAddr);
      const isRealAdmin = currentAccount?.toLowerCase() === adminAddr.toLowerCase();
      setIsAdmin(isRealAdmin);
      setIsAdminReady(true);
      if (!isRealAdmin) {
        console.warn("🚫 Не админ — не загружаем профили");
        return;
      }

      setTotalSupply(Number(supplyRaw));
      setAvailableForSale(Number(availableRaw));
      console.log("📦 totalSupply:", Number(supplyRaw));
      console.log("🛒 AvailableForSale:", Number(availableRaw));

      // 📥 Загрузка профилей из backend (а не из localStorage)
      const res = await axios.get(`${BACKEND_URL}/profiles`);
      const profiles = res.data || [];
      console.log(`📄 Загружено ${profiles.length} профилей из S3`);

      // 💰 Получение баланса GEM
      const balances = await Promise.all(
        profiles.map(async (profile) => {
          const bal = await contract.balanceOf(profile.address);
          return {
            ...profile,
            balance: Number(bal),
          };
        })
      );

      setAccounts(balances);

      // 💸 ETH на контракте
      const provider = contract.runner.provider;
      const ethBal = await provider.getBalance(contract.target || contract.address);
      const formatted = Number(ethers.formatEther(ethBal)).toExponential(8);
      setEthBalance(formatted);

      console.log("💸 Баланс контракта (ETH):", formatted);
    } catch (e) {
      console.error("❌ Ошибка в refreshAdminData:", e);
      setIsAdminReady(true);
    }
  };

  const exportAccounts = () => {
    console.log("📤 Экспорт аккаунтов в CSV");
    const csv = ["Имя,Адрес,Баланс GEM"];
    accounts.forEach((acc) => {
      csv.push(`${acc.nickname || ""},${acc.address},${acc.balance}`);
    });
    const blob = new Blob([csv.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "accounts.csv";
    a.click();
  };

  const withdrawEth = async () => {
    if (!contract) return;
    try {
      const tx = await contract.withdrawEth();
      await tx.wait();
      await refreshAdminData();
      alert("✅ ETH выведены");
    } catch (err) {
      console.error("❌ Ошибка вывода ETH:", err);
      alert("Не удалось вывести ETH");
    }
  };

  const dropTokens = async (amount) => {
    if (!contract) return;
    try {
      const tx = await contract.dropTokens(BigInt(amount));
      await tx.wait();
      await refreshAdminData();
      alert(`✅ Добавлено ${amount} GEM`);
    } catch (err) {
      console.error("❌ Ошибка дропа токенов:", err);
      alert("Не удалось дропнуть токены");
    }
  };

  useEffect(() => {
    console.log("🚀 useEffect сработал:", { isActive, currentAccount, contract });
    if (!isActive || !currentAccount) {
      console.warn("⛔ useEffect не активен");
      return;
    }

    refreshAdminData();
    const interval = setInterval(refreshAdminData, 10000);
    return () => clearInterval(interval);
  }, [contract, isActive, currentAccount]);

  return {
    totalSupply: isAdmin ? totalSupply : 0,
    availableForSale: isAdmin ? availableForSale : 0, // ← обязательно
    accounts: isAdmin ? accounts : [],
    ethBalance: isAdmin ? ethBalance : 0,
    adminAddress,
    isAdmin,
    isAdminReady,
    refreshAdminData,
    exportAccounts,
    withdrawEth,
    dropTokens,
  };
}
