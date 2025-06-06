import React, { useState } from "react";
import { useWeb3 } from "../contexts/Web3Provider";
import axios from "axios";
import { Interface } from "ethers";

export default function WrapNFTPanel({ inventory, setInventory, setNftInventory }) {
  const {gemContract, nftContract, account, backendUrl } = useWeb3(); // <- обязательно берем контракты из контекста
  const [draggedItem, setDraggedItem] = useState(null);
  const [message, setMessage] = useState("");

  const handleDrop = async (e) => {
  e.preventDefault();
  const item = JSON.parse(e.dataTransfer.getData("item"));

  // 🚫 Блокировка повторного обёртывания
  if (item.fromNFT) {
  setMessage("❌ Этот предмет уже является частью NFT и не может быть обёрнут повторно.");
  setDraggedItem(null); // сброс отображаемого предмета
  setTimeout(() => setMessage(""), 3000); // очистить сообщение через 3 сек
  return;
  }
  setDraggedItem(item);

  console.log("📦 Контракты перед проверкой:", gemContract, nftContract);

  // СНАЧАЛА ПРОВЕРКА
  if (!gemContract || !nftContract) {
    setMessage("❌ Ошибка: Контракты не загружены");
    console.error("gemContract или nftContract не определены");
    return;
  }

  // Только после проверки — использование адресов
  const gameGemsAddress = gemContract.target?.toLowerCase();
  const gameItemNFTAddress = nftContract.target?.toLowerCase();

  try {
    console.log("🎯 Получен предмет:", item);

    const [attributeKey, attributeValue] = Object.entries(item.attributes || {})[0] || [];
    const rarityMap = { Common: 1, Rare: 2, Epic: 3, Legendary: 4 };
    const rarityValue = rarityMap[item.rarity] || 0;

    const nftJson = {
      itemType: item.type,
      rarity: rarityValue,
      bonus: {
        attribute: attributeKey || "unknown",
        value: attributeValue || 0,
      },
      image: item.image,
    };

    console.log("📦 NFT JSON сформирован:", nftJson);

    const res = await axios.post(`${backendUrl}/nft/create-json`, {
      account,
      itemId: item.id,
      json: nftJson,
    });
    if (!res.data || !res.data.uri) throw new Error("Ошибка загрузки JSON в S3");

    const uri = res.data.uri;
    console.log("✅ JSON успешно загружен. URI:", uri);

    console.log("🪙 Минтим NFT через wrapItemAsNFT...");
    console.log("  - itemType:", nftJson.itemType);
    console.log("  - rarity:", Number(nftJson.rarity));
    console.log("  - bonus:", Number(nftJson.bonus.value));
    console.log("  - uri:", uri);

    const tx = await gemContract.wrapItemAsNFT(
      nftJson.itemType,
      Number(nftJson.rarity),
      Number(nftJson.bonus.value),
      uri
    );

    console.log("⏳ Транзакция отправлена. Ждём подтверждения...");
    const receipt = await tx.wait();

    console.log("✅ Транзакция подтверждена!");
    console.log("🧾 Все логи транзакции:", receipt.logs);

    const ifaceGameGems = new Interface([
      "event ItemWrapped(address indexed player, uint256 tokenId, string itemType, uint8 rarity, uint8 bonus, string uri)",
    ]);
    const ifaceGameItem = new Interface([
      "event NFTMinted(address indexed to, uint256 tokenId, string itemType, uint8 rarity, uint8 bonus, string uri)",
    ]);

    let tokenId;
      for (const log of receipt.logs) {
        try {
          const logAddress = log.address.toLowerCase();
          if (logAddress === gameGemsAddress) {
            const parsed = ifaceGameGems.parseLog(log);
            console.log("📨 Найдено событие GameGems:", parsed.name, parsed.args);
            if (parsed.name === "ItemWrapped") {
              tokenId = Number(parsed.args.tokenId);
              break;
            }
          } else if (logAddress === gameItemNFTAddress) {
            const parsed = ifaceGameItem.parseLog(log);
            console.log("📨 Найдено событие GameItemNFT:", parsed.name, parsed.args);
            if (parsed.name === "NFTMinted") {
              tokenId = Number(parsed.args.tokenId);
              break;
            }
          }
        } catch (parseErr) {
          console.warn("⚠️ Лог не подошёл:", parseErr);
        }
      }

    if (!tokenId) throw new Error("❌ Событие ItemWrapped или NFTMinted не найдено");
    console.log("🎉 NFT успешно создан. Token ID:", tokenId);

    const newNFT = {
      tokenId,
      itemType: nftJson.itemType,
      rarity: nftJson.rarity,
      bonus: nftJson.bonus,
      image: nftJson.image,
      uri,
      owner: account,
    };

    console.log("💾 Сохраняем NFT в S3...");
    await axios.post(`${backendUrl}/nft/save`, newNFT);
    console.log("✅ NFT сохранён!");

    setNftInventory((prev) => [...prev, newNFT]);
    setInventory((prev) => prev.filter((i) => i.id !== item.id));
    try {
      await axios.delete(`${backendUrl}/inventory/${account}/${item.id}`);
      console.log(`🗑️ Предмет ${item.id} удалён из S3`);
    } catch (deleteErr) {
      console.warn(`⚠️ Не удалось удалить предмет ${item.id} из S3:`, deleteErr);
    }
    setMessage("✅ NFT создан и добавлен!");
    setDraggedItem(null);
    setTimeout(() => setMessage(""), 3000);
  } catch (err) {
    console.error("🔥 Ошибка обёртки:", err);
    setMessage("❌ Ошибка: " + err.message);
  }
};

  return (
    <div className="wrap-nft-panel">
      <h3>🔗 Преобразовать в NFT</h3>
      <div
        className="wrap-nft-dropzone"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        {draggedItem ? (
          <span>{draggedItem.type} (⭐{draggedItem.rarity}) готов к обёртке</span>
        ) : (
          <span>Перетащи сюда предмет из инвентаря</span>
        )}
      </div>
      {message && <p>{message}</p>}
    </div>
  );
}
