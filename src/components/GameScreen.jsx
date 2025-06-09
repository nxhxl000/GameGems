import React from "react";
import "../styles/GameScreen.css";
import { useWeb3 } from "../contexts/Web3Provider";
import QuickSellZone from "../components/QuickSellZone";
import PlayerStatsPanel, { calculateStats } from "../components/PlayerStatsPanel";
import generateItem from "../utils/itemGenerator";
import WrapNFTPanel from "../components/WrapNFTPanel";
import { LayoutPanelLeft } from 'lucide-react';
import axios from "axios";


const fetchLocalGems = async (backendUrl, account, setLocalGems) => {
  try {
    const res = await axios.get(`${backendUrl}/profile/${account}`);
    if (res.data && typeof res.data.local_gems === 'number') {
      console.log("🎯 Получены локальные GEM из профиля:", res.data.local_gems);
      setLocalGems(res.data.local_gems);
    }
  } catch (err) {
    console.error("⚠️ Ошибка загрузки профиля:", err);
  }
};

const saveLocalGems = async (backendUrl, account, gems) => {
  try {
    await axios.patch(`${backendUrl}/profile/${account}`, {
      local_gems: gems,
    });
    console.log("💾 Локальные GEM сохранены в профиль:", gems);
  } catch (err) {
    console.error("⚠️ Ошибка сохранения локальных GEM:", err);
  }
};

const EQUIPMENT_SLOTS = ["Pickaxe", "Gloves", "Boots", "Vest", "Lamp",];
const INVENTORY_TABS = [...EQUIPMENT_SLOTS, "NFT"];

export default function GameScreen({ onAccountPage, onBack, onMarketplace }) {
  const { account, gemContract, backendUrl, localGems, setLocalGems, nftContract } = useWeb3();
  const [equipment, setEquipment] = React.useState({});
  const [inventory, setInventory] = React.useState([]);
  const [nftInventory, setNftInventory] = React.useState([]);
  const [activeTab, setActiveTab] = React.useState("Pickaxe");
  const [showMenu, setShowMenu] = React.useState(false);
  const [hoveredSlot, setHoveredSlot] = React.useState(null);
  const [popupMessage, setPopupMessage] = React.useState("");
  const [tooltip, setTooltip] = React.useState({ visible: false, x: 0, y: 0, item: null });
  const [sellPrices, setSellPrices] = React.useState({});


  React.useEffect(() => {
    if (account && backendUrl) {
      fetchLocalGems(backendUrl, account, setLocalGems);
    }
  }, [account, backendUrl]);

  React.useEffect(() => {
    if (!account) return;

    localStorage.removeItem("equipment");

    const saved = localStorage.getItem(`equipment_${account}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed === 'object' && parsed !== null) {
          setEquipment(parsed);
          console.log("✅ Загружено снаряжение из localStorage:", parsed);
        }
      } catch (err) {
        console.error("❌ Ошибка при парсинге equipment из localStorage", err);
      }
    }
  }, [account])
  
  React.useEffect(() => {
    if (account && Object.keys(equipment).length > 0) {
      localStorage.setItem(`equipment_${account}`, JSON.stringify(equipment));
      console.log("💾 Сохранено снаряжение в localStorage:", equipment);
    }
  }, [equipment, account]);

  React.useEffect(() => {
    console.log("🔐 Аккаунт:", account);
    console.log("📦 Локальные GEM (из контекста):", localGems);
  }, [account, localGems]);

  React.useEffect(() => {
    const loadInventory = async () => {
      try {
        const res = await axios.get(`${backendUrl}/inventory/${account}`);
        let loaded = [];

        if (Array.isArray(res.data)) {
          loaded = res.data;
        } else if (res.data && Array.isArray(res.data.items)) {
          loaded = res.data.items;
        } else {
          console.warn("Неверный формат инвентаря:", res.data);
        }

        // 🧪 ID экипированных предметов
        const equippedIds = Object.values(equipment)
          .filter((item) => item?.id)
          .map((item) => item.id);

        console.log("📥 Загружен инвентарь:", loaded);
        console.log("🧪 Удалим экипированные ID:", equippedIds);

        // 🧹 Удалим дубликаты
        const filtered = loaded.filter((item) => !equippedIds.includes(item.id));
        console.log("📤 Очищенный инвентарь:", filtered);

        setInventory(filtered);
      } catch (err) {
        console.error("Ошибка загрузки инвентаря:", err);
        showPopup("⚠️ Не удалось загрузить инвентарь");
      }
    };
    if (account && backendUrl) loadInventory();
  }, [account, backendUrl, equipment]);

  React.useEffect(() => {
    const loadNFTs = async () => {
      if (!account || !nftContract) {
        console.warn("Нет аккаунта или контракта NFT, пропускаем загрузку NFT");
        setNftInventory([]);
        return;
      }

      try {
        const res = await axios.get(`${backendUrl}/nft`);
        const allNFTs = Array.isArray(res.data) ? res.data : [];
        console.log("🎫 Загруженные NFT с бэка:", allNFTs);

        const ownedNFTs = [];
        for (const item of allNFTs) {
          try {
            const ownerOnChain = await nftContract.ownerOf(item.tokenId);
            if (ownerOnChain.toLowerCase() === account.toLowerCase()) {
              ownedNFTs.push(item);
            }
          } catch (err) {
            console.warn(`Ошибка проверки владельца токена ${item.tokenId}`, err);
          }
        }

        console.log(`✅ NFT, принадлежащие аккаунту ${account}:`, ownedNFTs);
        setNftInventory(ownedNFTs);

        const equippedNFTIds = Object.values(equipment)
          .filter((item) => item?.fromNFT)
          .map((item) => item.id);

        console.log("🧪 ID экипированных NFT:", equippedNFTIds);

        const virtualItemsFromNFTs = ownedNFTs
          .map(nft => ({
            id: `nft-${nft.tokenId}`,
            type: nft.itemType,
            rarity: nft.rarity,
            image: nft.image,
            attributes: {
              [nft.bonus.attribute]: nft.bonus.value
            },
            fromNFT: true
          }))
          .filter(item => !equippedNFTIds.includes(item.id));

        console.log("🎯 NFT для инвентаря:", virtualItemsFromNFTs);

        setInventory((prev) => {
          const filtered = prev.filter(item => !item.fromNFT);
          return [...filtered, ...virtualItemsFromNFTs];
        });

      } catch (err) {
        console.error("Ошибка загрузки NFT:", err);
        setNftInventory([]);
        showPopup("⚠️ Не удалось загрузить NFT");
      }
    };

  loadNFTs();
  }, [account, backendUrl, nftContract, equipment]); // 🧠 equipment обязательно!

  

  React.useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await axios.get(`${backendUrl}/sell-prices`);
        setSellPrices(res.data);
      } catch (err) {
        console.error("Ошибка загрузки цен быстрой продажи:", err);
      }
    };
    fetchPrices();
  }, [backendUrl]);

  const handleClick = async () => {
    const stats = calculateStats(equipment);
    const earnedGems = Math.floor(stats.clickPower * stats.gemMultiplier);
    const newLocalGems = localGems + earnedGems;
    setLocalGems(newLocalGems);
    console.log(`💎 Заработано ${earnedGems} GEM → всего теперь: ${newLocalGems}`);
    const dropBoost = stats.itemDropBoost || 0;
    const baseDropChance = 0.03; // базовый шанс 3%
    const finalChance = baseDropChance + dropBoost / 100;
    if (Math.random() < finalChance) {
      try {
        const newItem = generateItem(stats.bootsRarityMod, stats.vestLuckBoost);
        const res = await axios.post(`${backendUrl}/inventory/${account}`, newItem);
        if (res.status !== 200) throw new Error("Не удалось сохранить предмет на сервере");
        setInventory((prev) => [...prev, newItem]);
        showPopup("🎁 Вам выпал предмет!");
      } catch (err) {
        console.error("Ошибка генерации или сохранения предмета:", err);
        showPopup("⚠️ Ошибка дропа");
      }
    }
  };

  const showPopup = (message) => {
    setPopupMessage(message);
    setTimeout(() => setPopupMessage(""), 2000);
  };

  const handleMouseEnter = (event, item, fromEquipment = false) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltip({
      visible: true,
      x: rect.left - 260,
      y: fromEquipment ? rect.top - 120 : rect.top,
      item,
    });
  };

  const handleMouseLeave = () => {
    setTooltip({ visible: false, x: 0, y: 0, item: null });
  };

  const onDropToEquipment = (e, slotKey) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("item");

    if (!raw) {
      showPopup("❌ Не является предметом!");
      return;
    }
    
    let item;
    try {
      item = JSON.parse(raw);
    } catch (err) {
      console.error("❌ Ошибка разбора JSON:", err);
      showPopup("❌ Неверный формат предмета");
      return;
    }

    // Проверка: NFT не допускается
    if (!item.attributes) {
      showPopup("❌ Не является предметом!");
      return;
    }

    // Проверка соответствия типа слоту
    if (item.type !== slotKey) {
      showPopup("❌ Нельзя поместить в этот слот");
      return;
    }

    // Установка предмета в слот
    setEquipment((prev) => {
      const prevItem = prev[slotKey];
      setInventory((inv) => {
        let updated = inv.filter((i) => i.id !== item.id);
        if (prevItem && !updated.find((i) => i.id === prevItem.id)) {
          updated = [...updated, prevItem];
        }
        return updated;
      });
      return { ...prev, [slotKey]: item };
    });

    setHoveredSlot(null);
    setTooltip({ visible: false, x: 0, y: 0, item: null });
  };

  const onDragOver = (e) => {
    e.preventDefault();
  };

 const onDropToInventory = (e) => {
  e.preventDefault();
  const item = JSON.parse(e.dataTransfer.getData("item"));
  console.log("📥 Перетаскиваем в инвентарь:", item);

  setEquipment((prev) => {
    const newEquip = { ...prev };
    for (const slot in newEquip) {
      if (newEquip[slot]?.id === item.id) {
        console.log(`❌ Удаляем из слота "${slot}" предмет:`, item);
        delete newEquip[slot];
        break;
      }
    }

    // 💾 вручную сохраняем сразу после обновления
    if (account) {
      localStorage.setItem(`equipment_${account}`, JSON.stringify(newEquip));
      console.log("💾 [manual save] equipment сохранён вручную после удаления:", newEquip);
    }

    return newEquip;
  });

  if (item.fromNFT) {
    console.log("🔁 NFT-предмет, переносим обратно в nftInventory:", item);
    setNftInventory((prev) => {
      const exists = prev.some((nft) => `nft-${nft.tokenId}` === item.id);
      if (exists) {
        console.log("⚠️ Уже есть в nftInventory, не добавляем повторно:", item);
        return prev;
      }

      const tokenId = item.id.replace("nft-", "");
      const newNFT = {
        tokenId,
        itemType: item.type,
        rarity: item.rarity,
        image: item.image,
        bonus: {
          attribute: Object.keys(item.attributes)[0],
          value: Object.values(item.attributes)[0],
        },
      };

      console.log("✅ Добавляем обратно в nftInventory:", newNFT);
      return [...prev, newNFT];
    });

    setTooltip({ visible: false, x: 0, y: 0, item: null });
    return;
  }

  // 🎒 Обычный предмет — возвращаем в inventory
  setInventory((prev) => {
    const exists = prev.some((i) => i.id === item.id);
    if (exists) {
      console.log("⚠️ Уже есть в обычном инвентаре, не добавляем:", item);
      return prev;
    }

    console.log("✅ Добавляем обратно в обычный inventory:", item);
    return [...prev, item];
  });

  setTooltip({ visible: false, x: 0, y: 0, item: null });
};
  const onDragOverInventory = (e) => {
    e.preventDefault();
  };
  
  const handleSafeNavigation = async (callback) => {
  try {
    if (account && backendUrl) {
      await axios.patch(`${backendUrl}/profile/${account}`, {
        local_gems: localGems
      });
      console.log("💾 [safe-nav] Локальные GEM сохранены перед переходом:", localGems);
    }
  } catch (err) {
    console.error("❌ Ошибка при сохранении перед переходом:", err);
  }
  callback();
};


  return (
    <div className={`game-layout ${showMenu ? "with-sidebar" : ""}`}>
      <div className="sidebar-toggle-button" onClick={() => setShowMenu(!showMenu)} title="Меню">
        <LayoutPanelLeft size={24} stroke="#ffffff" />
      </div>

      <div className="sidebar-slideout">
        <div className="account-menu">
          <button onClick={() => handleSafeNavigation(onAccountPage)}>Аккаунт</button>
          <button onClick={() => handleSafeNavigation(onBack)}>Выйти</button>
          <button onClick={() => handleSafeNavigation(onMarketplace)}>🛒 Магазин</button>
        </div>
      </div>

      <div className="game-screen">
        {popupMessage && <div className="popup-message">{popupMessage}</div>}

        {tooltip.visible && (
          <div
            className="tooltip"
            style={{
              position: "fixed",
              top: tooltip.y,
              left: tooltip.x,
              backgroundColor: "rgba(0,0,0,0.8)",
              color: "#fff",
              padding: "10px",
              borderRadius: "6px",
              zIndex: 10000,
              maxWidth: 250,
              pointerEvents: "none",
              whiteSpace: "normal",
            }}
          >
            {"tokenId" in tooltip.item && (
              <div style={{ fontWeight: "bold", fontSize: "16px", marginBottom: "6px", color: "#ffd700" }}>
                🎫 NFT
              </div>
            )}
          <div><b>Тип:</b> {tooltip.item.type || tooltip.item.itemType}</div>
          <div><b>Редкость:</b> {tooltip.item.rarity}</div>

          {"tokenId" in tooltip.item && (
            <>
              <div><b>Token ID:</b> {tooltip.item.tokenId}</div>
              <div><b>Бонус:</b></div>
              <ul style={{ listStyleType: "none", paddingLeft: 0 }}>
                <li>{tooltip.item.bonus.attribute}: {tooltip.item.bonus.value}</li>
              </ul>
            </>
          )}

          {"attributes" in tooltip.item && tooltip.item.attributes && (
            <>
              <div><b>Атрибуты:</b></div>
              <ul style={{ listStyleType: "none", paddingLeft: 0 }}>
                {Object.entries(tooltip.item.attributes).map(([key, value]) => {
                  let label = key;
                  let displayValue = value;

                  switch (key) {
                    case "rarityModBonus":
                      label = "🌟 Шанс редкости";
                      displayValue = `+${value}%`;
                      break;
                    case "vestLuckBoost":
                      label = "🍀 Удача";
                      displayValue = `+${value}%`;
                      break;
                    case "dropChanceBonus":
                      label = "📦 Шанс дропа";
                      displayValue = `+${value}%`;
                      break;
                    case "flatPowerBonus":
                      label = "🎯 Сила клика";
                      displayValue = `+${value}`;
                      break;
                    case "gemMultiplierBonus":
                      label = "💎 Множитель GEM";
                      displayValue = `x${value}`;
                      break;
                    default:
                      label = key;
                      displayValue = value;
                  }

                  return (
                    <li key={key}>
                      {label}: {displayValue}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}

          <div style={{ display: "flex", gap: 20, alignItems: "stretch", marginBottom: 20 }}>
            <div className="player-stats-wrapper">
              <PlayerStatsPanel equipment={equipment} />
            </div>

            <div className="clicker">
              <h2 className="clicker-title">🔥 Clicker</h2>
              <button className="clicker-button" onClick={handleClick}>Click!</button>
              <p className="clicker-gems">💎 GEM 💎 : {localGems}</p>
            </div>
          </div>

          <div style={{ flex: "1 1 60%", display: "flex", gap: 20 }}>
            <div className="equipment">
              <h3>🎽 Equipment</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                {EQUIPMENT_SLOTS.map((slot) => (
                  <div
                    key={slot}
                    className={`slot ${hoveredSlot === slot ? "drag-over" : ""}`}
                    onDrop={(e) => onDropToEquipment(e, slot)}
                    onDragOver={onDragOver}
                    onDragLeave={() => setHoveredSlot(null)}
                    onDragEnter={() => setHoveredSlot(slot)}
                  >
                    <strong>{slot}</strong>
                    {equipment[slot] ? (
                      <div
                      className={`item ${equipment[slot]?.fromNFT ? 'nft-border' : ''}`}
                      draggable
                      onDragStart={(e) =>
                        e.dataTransfer.setData("item", JSON.stringify(equipment[slot]))
                      }
                      title={`${equipment[slot].type} (${equipment[slot].rarity})`}
                      style={{ marginTop: 4 }}
                    >
                      <img
                        src={equipment[slot].image}
                        alt={equipment[slot].type}
                        style={{
                          width: 32,
                          height: 32,
                          objectFit: "contain",
                          marginTop: 4,
                        }}
                        onMouseEnter={(e) => handleMouseEnter(e, equipment[slot], true)}
                        onMouseLeave={handleMouseLeave}
                      />
                    </div>
                    ) : (
                      <span className="empty">Empty</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

          <div className="inventory" onDrop={onDropToInventory} onDragOver={onDragOverInventory}>
          <h3>🎒 Inventory</h3>
          
          <div className="tabs">
            {INVENTORY_TABS.map((tab) => (
              <button
                key={tab}
                className={`tab-button ${activeTab === tab ? "active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="inventory-list">
            {activeTab === "NFT"
                ? nftInventory.map((item) => (
                    <div
                      key={item.tokenId}
                      className="item"
                      title={`${item.itemType} (⭐${item.rarity})`}
                      onMouseEnter={(e) => handleMouseEnter(e, item)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <img src={item.image} alt={item.itemType} />
                    </div>
                  ))
              : inventory
                  .filter((item) => item.type === activeTab)
                  .map((item) => (
                    <div
                      key={item.id}
                      className={`item ${item.fromNFT ? 'nft-border' : ''}`}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("item", JSON.stringify(item))}
                      onMouseEnter={(e) => handleMouseEnter(e, item)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <img src={item.image} alt={item.type} />
                    </div>
                  ))}
          </div>
        </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <QuickSellZone
              sellPrices={sellPrices}
              inventory={inventory}
              setInventory={setInventory}
              setGems={setLocalGems}
              account={account}
            />

            <WrapNFTPanel
              inventory={inventory}
              setInventory={setInventory}
              setNftInventory={setNftInventory}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
