import { useEffect, useState } from "react";
import { ethers } from "ethers";
import GameGemsABI from "../contracts/GameGemsABI.json";

const GEM_CONTRACT_ADDRESS = "0xAa013a000781fA897596134FB2C5223cccF10E0d";

export default function useTransactionHistory(account, provider) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const loadHistory = async () => {
      if (!account || !provider) return;

      const contract = new ethers.Contract(GEM_CONTRACT_ADDRESS, GameGemsABI, provider);

      const purchased = await contract.queryFilter(contract.filters.GemsPurchased(account));
      const deposited = await contract.queryFilter(contract.filters.GemsDeposited(account));
      const drops = await contract.queryFilter(contract.filters.ItemDropped(account));

      const all = [
        ...purchased.map((e) => ({ type: "Purchase", ...e.args, blockNumber: e.blockNumber })),
        ...deposited.map((e) => ({ type: "Deposit", ...e.args, blockNumber: e.blockNumber })),
        ...drops.map((e) => ({ type: "Drop", ...e.args, blockNumber: e.blockNumber })),
      ];

      // Сортировка по номеру блока (по убыванию)
      all.sort((a, b) => b.blockNumber - a.blockNumber);
      setHistory(all);
    };

    loadHistory();
  }, [account, provider]);

  return history;
}
