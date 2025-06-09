// src/components/MarketplacePage.jsx
import React, { useEffect, useState } from "react";
import { useWeb3 } from "../contexts/Web3Provider";
import axios from "axios";
import "../styles/MarketplacePage.css";

const rarityMap = {
  1: "Обычный",
  2: "Редкий",
  3: "Эпический",
  4: "Легендарный",
};

const mapBonusAttribute = (attr) => {
  switch (attr) {
    case "flatPowerBonus":
      return "сила клика";
    case "dropChanceBonus":
      return "шанс дропа";
    case "vestLuckBoost":
      return "удача";
    case "gemMultiplier":
      return "множитель GEM";
      case "rarityModBonus":
      return "шанс редкости";
      
    default:
      return attr;
  }
};

const MarketplacePage = ({ onBack }) => {
  const { marketplaceContract, nftContract, account, backendUrl, gemContract } = useWeb3();
  const [listings, setListings] = useState([]);
  const [myNFTs, setMyNFTs] = useState([]);

  const fetchListings = async () => {
  try {
  
    const totalSupply = await nftContract.totalSupply();

    const items = [];

    for (let i = 1; i <= Number(totalSupply); i++) {
  

      const listing = await marketplaceContract.getListing(i);
      const priceInGems = Number(listing.priceInGems);

      if (listing && priceInGems > 0) {
        

        const tokenURI = await nftContract.tokenURI(i);
        const owner = await nftContract.ownerOf(i);

        let metadata = {};

        try {
          const response = await axios.get(`${backendUrl}/metadata-proxy/`, {
            params: { url: tokenURI }
          });

          metadata = typeof response.data === 'string'
            ? JSON.parse(response.data)
            : response.data;

          
        } catch (err) {
        
          continue;
        }

        const itemType = metadata.itemType || 'Unknown';
        const rarityIndex = metadata.rarity || 1;
        const bonusValue = metadata.bonus?.value || 0;

        const rarityMap = {
          1: "Common",
          2: "Rare",
          3: "Epic",
          4: "Legendary"
        };
        const rarity = rarityMap[rarityIndex] || "Common";

        // 📤 Запрос к ML модели с ценой
        console.log(`📤 ML запрос для токена ${i}:`, {
          itemType,
          rarity,
          bonusValue,
          price: priceInGems
        });

        let recommendedPrice = null;
        let priceStatus = "неизвестно";
        let deviationPercent = null;

        try {
          const mlRes = await axios.post(`${backendUrl}/predict-price`, {
            itemType,
            rarity,
            bonusValue,
            price: priceInGems
          });

          recommendedPrice = mlRes.data.recommended_price;

          const labelMap = {
            занижена: "цена ниже рынка",
            нормальная: "рыночная цена",
            завышена: "цена выше рынка"
          };

          priceStatus = labelMap[mlRes.data.price_status] || "неизвестно";
          deviationPercent = mlRes.data.deviation_percent;
        } catch (err) {}

        items.push({
          tokenId: i,
          price: priceInGems,
          owner,
          itemType,
          rarity: rarityIndex,
          bonus: metadata.bonus || {},
          image: metadata.image || '',
          recommendedPrice,
          priceStatus,
          deviationPercent
        });
      }
    }

    
    setListings(items);

  } catch (error) {}
};


  const fetchUserNFTs = async () => {
    if (!account) {  
      return;
    }

    try {
      // Запрос всех NFT из backend без фильтра по аккаунту
      const url = `${backendUrl}/nft`;
      
      const response = await axios.get(url);

      const allNFTs = Array.isArray(response.data) ? response.data : [];
      const parsedNFTs = allNFTs.map(x => (typeof x === "string" ? JSON.parse(x) : x));

      

      const userNFTs = [];
      let checkCount = 0;

      for (const item of parsedNFTs) {
        try {
          // Проверяем текущего владельца через смарт-контракт
          const owner = await nftContract.ownerOf(item.tokenId);
          checkCount++;

          if (owner.toLowerCase() === account.toLowerCase()) {
            

            // Проверяем, не выставлен ли NFT на продажу
            const listing = await marketplaceContract.getListing(item.tokenId);
            const price = Number(listing.priceInGems);

            if (price > 0) {} else {userNFTs.push(item)}
          } else {continue;}
        } catch (err) {
          userNFTs.push(item);
        }
      }

      
      setMyNFTs(userNFTs);
    } catch (err) {setMyNFTs([])}
  };



  const handleList = async (tokenId) => {
  try {
    // Получаем URI и метаданные NFT
    const tokenURI = await nftContract.tokenURI(tokenId);
    const response = await axios.get(`${backendUrl}/metadata-proxy/`, {
      params: { url: tokenURI }
    });

    const metadata = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;

    const itemType = metadata.itemType;
    const rarityIndex = metadata.rarity;
    const bonusValue = metadata.bonus?.value || 0;

    // Преобразование индекса редкости в строку
    const rarityMap = {
      1: "Common",
      2: "Rare",
      3: "Epic",
      4: "Legendary"
    };
    const rarity = rarityMap[rarityIndex] || "Common";

  

    // Запрос на рекомендованную цену
    const predictRes = await axios.post(`${backendUrl}/predict-price`, {
      itemType,
      rarity,
      bonusValue
    });

    const recommendedPrice = predictRes.data?.recommended_price;

    // Запрашиваем цену у пользователя
    const priceStr = prompt(
      `💡 Рекомендуемая цена: ${recommendedPrice} GEM\n\nВведите свою цену для листинга:`
    );

    if (!priceStr) return;

    const price = parseInt(priceStr);
    if (isNaN(price) || price <= 0) {
      alert("❌ Неверная цена");
      return;
    }

  
    const approved = await nftContract.getApproved(tokenId);
    const marketplaceAddress = marketplaceContract.target;

    const approvedToMarketplace =
      typeof approved === "string" &&
      typeof marketplaceAddress === "string" &&
      approved.toLowerCase() === marketplaceAddress.toLowerCase();

    if (!approvedToMarketplace) {
      const approvalTx = await nftContract.approve(marketplaceAddress, tokenId);
      await approvalTx.wait();
    }

    const tx = await marketplaceContract.listItem(tokenId, price);
    await tx.wait();

    alert("✅ NFT успешно выставлен на продажу!");

    fetchUserNFTs();
    fetchListings();
  } catch (err) {alert("⚠️ Ошибка при выставлении NFT. См. консоль.");}
};


const handleDelist = async (tokenId) => {
  try {
    const tx = await marketplaceContract.delistItem(tokenId);
    await tx.wait();
    alert("✅ NFT снят с продажи!");
    fetchListings();
    fetchUserNFTs();
  } catch (err) {alert("⚠️ Ошибка при снятии с продажи. См. консоль.");}
};

const handleBuy = async (tokenId, priceInGems, sellerAddress) => {
  console.log(`🛒 handleBuy вызван с tokenId=${tokenId}, priceInGems=${priceInGems}, sellerAddress=${sellerAddress}`);

  if (!gemContract) {
    console.log("⛔ Контракт GameGems (gemContract) не загружен");
    return;
  }
  if (!marketplaceContract) {
    console.log("⛔ Контракт Marketplace не загружен");
    return;
  }
  if (!account) {
    console.log("⛔ Аккаунт не загружен");
    return;
  }

  if (priceInGems === undefined || priceInGems === null) {
    console.error("❌ Цена не определена, прерываю покупку");
    return;
  }

  try {
    const marketplaceAddress = marketplaceContract.target;

    const gemsBalance = await gemContract.balanceOf(account);
    console.log(`💎 Баланс GEM: ${gemsBalance.toString()} | Цена: ${priceInGems}`);

    if (gemsBalance < priceInGems) {
      console.log("❌ Недостаточно GEM для покупки");
      return;
    }

    const allowance = await gemContract.allowance(account, marketplaceAddress);
    console.log(`🔍 Текущий allowance: ${allowance.toString()}`);

    if (allowance < priceInGems) {
      console.log(`⚠️ Недостаточный approve, отправляем новый...`);
      const txApprove = await gemContract.approve(marketplaceAddress, priceInGems);
      await txApprove.wait();
      console.log(`✅ Approve выполнен`);
    } else {
      console.log(`✅ Достаточный approve уже установлен`);
    }

    // Покупка NFT через смарт-контракт (внутри buyItem происходит transferForMarketplace с комиссией)
    const tx = await marketplaceContract.buyItem(tokenId);
    await tx.wait();
    console.log(`🎉 Покупка токена ${tokenId} завершена!`);

    // Обновляем локальное состояние листингов и NFT
    await fetchListings();
    await fetchUserNFTs();

    console.log(`✅ Владелец NFT с tokenId=${tokenId} обновлён в блокчейне и отражён во фронтенде`);

  } catch (error) {
    console.error(`❌ Ошибка при покупке токена ${tokenId}:`, error);
  }
};


  useEffect(() => {
    
    fetchListings();
    fetchUserNFTs();
  }, [account]);

  return (
    <div className="marketplace-layout">
      <div className="marketplace-screen">
        <div className="marketplace-header">
          <button onClick={onBack} className="marketplace-back-button">⬅️ Назад</button>
          <h2>🛒 Маркетплейс NFT</h2>
        </div>

        <div className="marketplace-section">
          <h3>📦 Доступные на рынке</h3>
          {listings.length === 0 ? (
            <p>Пока нет выставленных NFT.</p>
          ) : (
            <div className="marketplace-grid">
            {listings.map((item) => (
              <div
                key={item.tokenId}
                className={`marketplace-card ${
                  item.priceStatus === "цена ниже рынка"
                    ? "card-green"
                    : item.priceStatus === "рыночная цена"
                    ? "card-yellow"
                    : item.priceStatus === "цена выше рынка"
                    ? "card-red"
                    : ""
                }`}
              >
                <img src={item.image} alt={`NFT ${item.tokenId}`} className="nft-image" />
                <p><b>ID:</b> {item.tokenId}</p>
                <p><b>Тип:</b> {item.itemType}</p>
                <p><b>Редкость:</b> {rarityMap[item.rarity]}</p>
                {item.bonus && (
                  <p><b>Бонус:</b> {mapBonusAttribute(item.bonus.attribute)} +{item.bonus.value}</p>
                )}
                <p><b>Владелец:</b> {item.owner.slice(0, 6)}...{item.owner.slice(-4)}</p>
                <p><b>Цена:</b> {item.price} GEM</p>

                {/* 👉 Оценка от модели */}
                {item.priceStatus && (
                    <>
                      <p
                        style={{
                          color:
                            item.priceStatus === 'цена ниже рынка'
                              ? 'green'
                              : item.priceStatus === 'рыночная цена'
                              ? 'goldenrod'
                              : item.priceStatus === 'цена выше рынка'
                              ? 'red'
                              : 'black',
                          fontWeight: 'bold',
                          margin: '0.25em 0 0',
                        }}
                      >
                        {item.priceStatus === 'цена ниже рынка' && '📉 Цена занижена'}
                        {item.priceStatus === 'рыночная цена' && '✅ Цена в норме'}
                        {item.priceStatus === 'цена выше рынка' && '📈 Цена завышена'}
                      </p>
                      {typeof item.recommendedPrice === 'number' && (
                        <p style={{ fontStyle: 'italic', margin: 0 }}>
                          Рекомендовано {item.recommendedPrice} GEM
                        </p>
                      )}
                    </>
                  )}
                {item.owner.toLowerCase() === account.toLowerCase() ? (
                  <button onClick={() => handleDelist(item.tokenId)}>Снять с продажи</button>
                ) : (
                  <button onClick={() => handleBuy(item.tokenId, item.price, item.owner)}>Купить</button>
                )}
                </div>
            ))}
            </div>
          )}
        </div>

        <div className="marketplace-section">
          <h3>🧍 Мои NFT (не на продаже)</h3>
          {myNFTs.length === 0 ? (
            <p>У вас нет NFT вне продажи.</p>
          ) : (
            <div className="marketplace-grid">
              {myNFTs.map((item, index) => {
                

                return (
                  <div key={item.tokenId || index} className="marketplace-card">
                    <img src={item.image} alt={`NFT ${item.tokenId}`} className="nft-image" />
                    <p><b>ID:</b> {item.tokenId}</p>
                    <p><b>Тип:</b> {item.itemType}</p>
                    <p><b>Редкость:</b> {rarityMap[item.rarity]}</p>
                    {item.bonus && (
                      <p><b>Бонус:</b> {mapBonusAttribute(item.bonus.attribute)} +{item.bonus.value}</p>
                    )}
                    <button onClick={() => handleList(item.tokenId)}>Выставить на продажу</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarketplacePage;
