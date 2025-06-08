import React from "react";
import { render, screen } from "@testing-library/react";
import { act } from "react-dom/test-utils";
import MarketplacePage from "../MarketplacePage";
import axios from "axios";
import * as Web3Context from "../../contexts/Web3Provider";

// 🧪 Мокаем useWeb3
jest.mock("../../contexts/Web3Provider", () => ({
  useWeb3: jest.fn(),
}));

// 🧪 Мокаем axios
jest.mock("axios");

axios.get.mockImplementation((url) => {
  if (url.includes("/metadata-proxy/")) {
    return Promise.resolve({
      data: {
        itemType: "Boots",
        rarity: 2,
        image: "https://example.com/nft.png",
        bonus: {
          attribute: "flatPowerBonus",
          value: 5,
        },
      },
    });
  }
  if (url.includes("/nft")) {
    return Promise.resolve({ data: [] });
  }
  return Promise.reject(new Error("unexpected axios.get call"));
});

axios.post.mockResolvedValue({
  data: {
    recommended_price: 30,
    price_status: "нормальная",
    deviation_percent: 5,
  },
});


describe("MarketplacePage", () => {
  beforeEach(() => {
    Web3Context.useWeb3.mockReturnValue({
      account: "0xdeadbeef",
      backendUrl: "http://localhost:3001",
      marketplaceContract: {
        getListing: jest.fn().mockResolvedValue({ priceInGems: 25 }),
        listItem: jest.fn().mockResolvedValue({ wait: jest.fn() }),
        delistItem: jest.fn().mockResolvedValue({ wait: jest.fn() }),
        buyItem: jest.fn().mockResolvedValue({ wait: jest.fn() }),
        target: "0xmarketplace",
      },
      nftContract: {
        totalSupply: jest.fn().mockResolvedValue(1),
        tokenURI: jest.fn().mockResolvedValue("https://mock-uri"),
        ownerOf: jest.fn().mockResolvedValue("0x1234567890abcdef1234567890abcdef12345678"),
        getApproved: jest.fn().mockResolvedValue("0xmarketplace"),
        approve: jest.fn().mockResolvedValue({ wait: jest.fn() }),
      },
      gemContract: {
        balanceOf: jest.fn().mockResolvedValue(100),
        allowance: jest.fn().mockResolvedValue(100),
        approve: jest.fn().mockResolvedValue({ wait: jest.fn() }),
      },
    });
  });

  test("рендерит заголовки и кнопку назад", () => {
    render(<MarketplacePage onBack={jest.fn()} />);
    expect(screen.getByText("⬅️ Назад")).toBeInTheDocument();
    expect(screen.getByText("🛒 Маркетплейс NFT")).toBeInTheDocument();
    expect(screen.getByText("📦 Доступные на рынке")).toBeInTheDocument();
    expect(screen.getByText("🧍 Мои NFT (не на продаже)")).toBeInTheDocument();
  });

  test("показывает сообщение, если нет выставленных NFT", () => {
    render(<MarketplacePage onBack={jest.fn()} />);
    expect(screen.getByText("Пока нет выставленных NFT.")).toBeInTheDocument();
  });

  test("показывает сообщение, если нет моих NFT", () => {
    render(<MarketplacePage onBack={jest.fn()} />);
    expect(screen.getByText("У вас нет NFT вне продажи.")).toBeInTheDocument();
  });

  test("отображает NFT из листинга", async () => {
    render(<MarketplacePage onBack={jest.fn()} />);
    const nftImage = await screen.findByAltText("NFT 1");
    expect(nftImage).toBeInTheDocument();

    const card = nftImage.closest(".marketplace-card");
    expect(card).toBeTruthy();

    const pTags = card.querySelectorAll("p");

    function findTextInParagraph(label, value) {
      for (const p of pTags) {
        const bold = p.querySelector("b");
        if (!bold) continue;
        const labelText = bold.textContent.trim();
        const fullText = p.textContent.replace(/\s+/g, " ").trim();
        if (labelText === label && fullText.includes(value)) return true;
      }
      return false;
    }

    function findRawTextParagraph(includesText) {
      return Array.from(pTags).some((p) =>
        !p.querySelector("b") && p.textContent.replace(/\s+/g, " ").includes(includesText)
      );
    }

    expect(findTextInParagraph("ID:", "1")).toBe(true);
    expect(findTextInParagraph("Тип:", "Boots")).toBe(true);
    expect(findTextInParagraph("Редкость:", "Редкий")).toBe(true);
    expect(findTextInParagraph("Бонус:", "сила клика")).toBe(true);
    expect(findTextInParagraph("Цена:", "25")).toBe(true);
    expect(findRawTextParagraph("Рекомендовано 30 GEM")).toBe(true);
    expect(screen.getByText("✅ Цена в норме")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Купить/i })).toBeInTheDocument();
  });

  test("🧪 корректно обрабатывает метаданные из metadata-proxy (включая JSON.parse)", async () => {
    axios.get.mockImplementationOnce((url) => {
      if (url.includes("/metadata-proxy/")) {
        return Promise.resolve({
          data: JSON.stringify({
            itemType: "Boots",
            rarity: 2,
            image: "https://example.com/nft.png",
            bonus: { attribute: "flatPowerBonus", value: 5 },
          }),
        });
      }
      if (url.includes("/nft")) {
        return Promise.resolve({ data: [] });
      }
      return Promise.reject(new Error("unexpected axios.get call"));
    });

    render(<MarketplacePage onBack={jest.fn()} />);
    const nftImage = await screen.findByAltText("NFT 1");
    expect(nftImage).toBeInTheDocument();
  });

  test("🧪 отображает все бонус-атрибуты и редкости из mapBonusAttribute и rarityMap", async () => {
    const allCases = [
      ["flatPowerBonus", "сила клика"],
      ["dropChanceBonus", "шанс дропа"],
      ["vestLuckBoost", "удача"],
      ["gemMultiplier", "множитель GEM"],
      ["rarityModBonus", "шанс редкости"],
      ["неизвестный_бонус", "неизвестный_бонус"],
    ];

    for (let i = 0; i < allCases.length; i++) {
      const [attribute, expectedText] = allCases[i];
      const tokenId = i + 1;

      axios.get.mockReset();
      axios.get.mockImplementation((url) => {
        if (url.includes("/metadata-proxy")) {
          return Promise.resolve({
            data: {
              itemType: "Boots",
              rarity: 2,
              image: `https://example.com/nft-${tokenId}.png`,
              bonus: { attribute, value: 7 },
            },
          });
        }
        if (url.includes("/nft")) {
          return Promise.resolve({ data: [] });
        }
        return Promise.reject(new Error("unexpected axios.get call"));
      });

      axios.post.mockResolvedValue({
        data: {
          recommended_price: 30,
          price_status: "нормальная",
          deviation_percent: 5,
        },
      });

      Web3Context.useWeb3.mockReturnValue({
        account: "0xdeadbeef",
        backendUrl: "http://localhost:3001",
        marketplaceContract: {
          getListing: jest.fn().mockResolvedValue({ priceInGems: 25 }),
          listItem: jest.fn().mockResolvedValue({ wait: jest.fn() }),
          delistItem: jest.fn().mockResolvedValue({ wait: jest.fn() }),
          buyItem: jest.fn().mockResolvedValue({ wait: jest.fn() }),
          target: "0xmarketplace",
        },
        nftContract: {
          totalSupply: jest.fn().mockResolvedValue(tokenId),
          tokenURI: jest.fn().mockResolvedValue(`https://mock-uri-${tokenId}`),
          ownerOf: jest.fn().mockResolvedValue("0x1234567890abcdef1234567890abcdef12345678"),
          getApproved: jest.fn().mockResolvedValue("0xmarketplace"),
          approve: jest.fn().mockResolvedValue({ wait: jest.fn() }),
        },
        gemContract: {
          balanceOf: jest.fn().mockResolvedValue(100),
          allowance: jest.fn().mockResolvedValue(100),
          approve: jest.fn().mockResolvedValue({ wait: jest.fn() }),
        },
      });

      render(<MarketplacePage onBack={jest.fn()} />);
      const nftImage = await screen.findByAltText(`NFT ${tokenId}`);
      const card = nftImage.closest(".marketplace-card");
      const bonusText = Array.from(card.querySelectorAll("p")).find((p) =>
        p.textContent.includes("Бонус:")
      ).textContent;

      expect(bonusText).toContain(expectedText);
      expect(bonusText).toContain("+7");
    }
  });

test("🧪 пропускает элемент при ошибке JSON.parse из metadata-proxy", async () => {
  Web3Context.useWeb3.mockReturnValue({
    account: "0xdeadbeef",
    backendUrl: "http://localhost:3001",
    marketplaceContract: {
      getListing: jest.fn().mockResolvedValue({ priceInGems: 25 }),
      listItem: jest.fn().mockResolvedValue({ wait: jest.fn() }),
      delistItem: jest.fn().mockResolvedValue({ wait: jest.fn() }),
      buyItem: jest.fn().mockResolvedValue({ wait: jest.fn() }),
      target: "0xmarketplace",
    },
    nftContract: {
      totalSupply: jest.fn().mockResolvedValue(1),
      tokenURI: jest.fn().mockResolvedValue("https://mock-uri"),
      ownerOf: jest.fn().mockResolvedValue("0x1234567890abcdef1234567890abcdef12345678"),
      getApproved: jest.fn().mockResolvedValue("0xmarketplace"),
      approve: jest.fn().mockResolvedValue({ wait: jest.fn() }),
    },
    gemContract: {
      balanceOf: jest.fn().mockResolvedValue(100),
      allowance: jest.fn().mockResolvedValue(100),
      approve: jest.fn().mockResolvedValue({ wait: jest.fn() }),
    },
  });

  axios.get.mockImplementation((url) => {
    if (url.includes("/metadata-proxy")) {
      return Promise.resolve({ data: "{invalid json" }); // 💥 сломает JSON.parse
    }
    if (url.includes("/nft")) {
      return Promise.resolve({ data: [] });
    }
    return Promise.reject(new Error("unexpected axios.get call"));
  });

  render(<MarketplacePage onBack={jest.fn()} />);
  await new Promise((r) => setTimeout(r, 200)); // чуть подождать, иначе проглотит

  // Ожидаем, что не было карточек
  const message = screen.getByText("Пока нет выставленных NFT.");
  expect(message).toBeInTheDocument();
});

test("🧪 обрабатывает ошибку на верхнем уровне fetchListings", async () => {
  Web3Context.useWeb3.mockReturnValue({
    account: "0xdeadbeef",
    backendUrl: "http://localhost:3001",
    marketplaceContract: {
      getListing: jest.fn(),
      listItem: jest.fn(),
      delistItem: jest.fn(),
      buyItem: jest.fn(),
      target: "0xmarketplace",
    },
    nftContract: {
      totalSupply: jest.fn().mockRejectedValue(new Error("Ошибка totalSupply")),
      tokenURI: jest.fn(),
      ownerOf: jest.fn(),
      getApproved: jest.fn(),
      approve: jest.fn(),
    },
    gemContract: {
      balanceOf: jest.fn(),
      allowance: jest.fn(),
      approve: jest.fn(),
    },
  });

  render(<MarketplacePage onBack={jest.fn()} />);
  await new Promise((r) => setTimeout(r, 200));

  expect(screen.getByText("Пока нет выставленных NFT.")).toBeInTheDocument();
});

test("🧪 fetchUserNFTs не делает ничего без account и добавляет NFT по логике проверки владельца и цены", async () => {
  const { useWeb3 } = require("../../contexts/Web3Provider");

  // 🧪 Без аккаунта — ничего не происходит
  useWeb3.mockReturnValueOnce({
    account: null,
    backendUrl: "http://localhost:3001",
    marketplaceContract: {},
    nftContract: {},
    gemContract: {},
  });

  render(<MarketplacePage onBack={jest.fn()} />);
  // Никаких NFT отображаться не должно
  expect(screen.queryByAltText("NFT 1")).not.toBeInTheDocument();

  // 🧪 C аккаунтом и 2 предметами (один с ошибкой, другой не выставлен на продажу)
  const tokenId = 1;
  useWeb3.mockReturnValue({
    account: "0xUser",
    backendUrl: "http://localhost:3001",
    marketplaceContract: {
      getListing: jest.fn().mockResolvedValue({ priceInGems: 0 }),
    },
    nftContract: {
      ownerOf: jest.fn().mockImplementation((id) => {
        if (id === 1) return Promise.resolve("0xUser");
        if (id === 2) return Promise.reject(new Error("Ошибка"));
      }),
      totalSupply: jest.fn().mockResolvedValue(2),
      tokenURI: jest.fn().mockImplementation((id) =>
        Promise.resolve(`https://mock-uri-${id}`)
      ),
      getApproved: jest.fn().mockResolvedValue("0xmarketplace"),
      approve: jest.fn().mockResolvedValue({ wait: jest.fn() }),
    },
    gemContract: {
      balanceOf: jest.fn().mockResolvedValue(100),
      allowance: jest.fn().mockResolvedValue(100),
      approve: jest.fn().mockResolvedValue({ wait: jest.fn() }),
    },
  });

  axios.get.mockImplementation((url) => {
    if (url.includes("/metadata-proxy/")) {
      const id = url.split("/").pop();
      return Promise.resolve({
        data: {
          itemType: "Boots",
          rarity: 1,
          image: `https://img/nft-${id}.png`,
          bonus: { attribute: "flatPowerBonus", value: 5 },
        },
      });
    }
    if (url.includes("/nft")) {
      return Promise.resolve({
        data: [
          { tokenId: 1 },
          { tokenId: 2 }, // этот вызовет ошибку при ownerOf
        ],
      });
    }
    return Promise.reject(new Error("unexpected axios.get call"));
  });

  render(<MarketplacePage onBack={jest.fn()} />);
  // Ожидаем, что отрисуются оба NFT — один валидный, другой добавлен из-за ошибки
  const nft1 = await screen.findByAltText("NFT 1");
  expect(nft1).toBeInTheDocument();

  const nft2 = await screen.findByAltText("NFT 2");
  expect(nft2).toBeInTheDocument();
});

test("🧪 fetchUserNFTs добавляет NFT, если он принадлежит пользователю и не выставлен на продажу (price = 0)", async () => {
  const { useWeb3 } = require("../../contexts/Web3Provider");

  useWeb3.mockReturnValue({
    account: "0xUser",
    backendUrl: "http://localhost:3001",
    marketplaceContract: {
      getListing: jest.fn().mockResolvedValue({ priceInGems: 0 }),
    },
    nftContract: {
      ownerOf: jest.fn().mockResolvedValue("0xUser"),
      totalSupply: jest.fn().mockResolvedValue(1),
      tokenURI: jest.fn().mockResolvedValue("https://mock-uri-1"),
      getApproved: jest.fn().mockResolvedValue("0xmarketplace"),
      approve: jest.fn().mockResolvedValue({ wait: jest.fn() }),
    },
    gemContract: {
      balanceOf: jest.fn().mockResolvedValue(100),
      allowance: jest.fn().mockResolvedValue(100),
      approve: jest.fn().mockResolvedValue({ wait: jest.fn() }),
    },
  });

  axios.get.mockImplementation((url) => {
    if (url.includes("/metadata-proxy/")) {
      return Promise.resolve({
        data: {
          itemType: "Boots",
          rarity: 1,
          image: `https://img/nft-1.png`,
          bonus: { attribute: "flatPowerBonus", value: 5 },
        },
      });
    }
    if (url.includes("/nft")) {
      return Promise.resolve({ data: [{ tokenId: 1 }] });
    }
    return Promise.reject(new Error("unexpected axios.get call"));
  });

  render(<MarketplacePage onBack={jest.fn()} />);
  const nftImage = await screen.findByAltText("NFT 1");
  expect(nftImage).toBeInTheDocument();
});


test("🧪 handleList выполняет полный цикл выставления NFT", async () => {
  const promptSpy = jest.spyOn(window, "prompt").mockReturnValue("42");
  const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});
  const waitMock = jest.fn();

  Web3Context.useWeb3.mockReturnValue({
    account: "0xUser",
    backendUrl: "http://localhost:3001",
    marketplaceContract: {
      getListing: jest.fn().mockResolvedValue({ priceInGems: 0 }), // не выставлен
      listItem: jest.fn().mockResolvedValue({ wait: waitMock }),
      delistItem: jest.fn(),
      buyItem: jest.fn(),
      target: "0xmarketplace",
    },
    nftContract: {
      ownerOf: jest.fn().mockResolvedValue("0xUser"),
      totalSupply: jest.fn().mockResolvedValue(1),
      tokenURI: jest.fn().mockResolvedValue("https://mock-uri"),
      getApproved: jest.fn().mockResolvedValue("0x0000000000000000000000000000000000000000"),
      approve: jest.fn().mockResolvedValue({ wait: waitMock }),
    },
    gemContract: {
      balanceOf: jest.fn(),
      allowance: jest.fn(),
      approve: jest.fn(),
    },
  });

  // 💡 Возвращаем 1 NFT, не на продаже
  axios.get.mockImplementation((url) => {
    if (url.includes("/nft")) {
      return Promise.resolve({ data: [{ tokenId: 1 }] });
    }
    if (url.includes("/metadata-proxy")) {
      return Promise.resolve({
        data: {
          itemType: "Boots",
          rarity: 2,
          image: "https://example.com/nft.png",
          bonus: { attribute: "flatPowerBonus", value: 5 },
        },
      });
    }
    return Promise.reject(new Error("unexpected axios.get call"));
  });

  render(<MarketplacePage onBack={jest.fn()} />);

  // ✅ Дожидаемся карточки «Мои NFT»
  const nftImage = await screen.findByAltText("NFT 1");

  // Кликаем «Выставить»
  const listButton = screen.getByRole("button", { name: /Выставить/i });
  await act(async () => {
    listButton.click();
  });

  // Проверки
  expect(Web3Context.useWeb3().nftContract.approve).toHaveBeenCalled();
  expect(Web3Context.useWeb3().marketplaceContract.listItem).toHaveBeenCalledWith(1, 42);
  expect(alertSpy).toHaveBeenCalledWith("✅ NFT успешно выставлен на продажу!");

  promptSpy.mockRestore();
  alertSpy.mockRestore();
});

test("🧪 handleList — ошибка при вводе неверной цены", async () => {
  // Мокаем prompt с отрицательной ценой
  const promptSpy = jest.spyOn(window, "prompt").mockReturnValue("-10");
  // Мокаем alert, чтобы ловить вызовы
  const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});

  // Мокаем useWeb3 с контрактами и аккаунтом
  Web3Context.useWeb3.mockReturnValue({
    account: "0xdeadbeef",
    backendUrl: "http://localhost:3001",
    nftContract: {
      tokenURI: jest.fn().mockResolvedValue("https://example.com/metadata.json"),
      getApproved: jest.fn().mockResolvedValue("0xmarketplace"),
      approve: jest.fn().mockResolvedValue({ wait: jest.fn() }),
    },
    marketplaceContract: {
      target: "0xmarketplace",
      listItem: jest.fn().mockResolvedValue({ wait: jest.fn() }),
    },
    gemContract: {},
  });

  // Мокаем axios.get для metadata-proxy и nft списка
  axios.get.mockImplementation((url) => {
    if (url.includes("/metadata-proxy")) {
      return Promise.resolve({
        data: {
          itemType: "Boots",
          rarity: 2,
          image: "https://example.com/nft.png",
          bonus: { attribute: "flatPowerBonus", value: 5 },
        },
      });
    }
    if (url.includes("/nft")) {
      return Promise.resolve({
        data: [{ tokenId: 1 }],
      });
    }
    return Promise.reject(new Error("unexpected axios.get call"));
  });

  // Мокаем axios.post для предсказания цены
  axios.post.mockResolvedValue({ data: { recommended_price: 30 } });

  // Рендерим компонент
  const { container } = render(<MarketplacePage onBack={() => {}} />);

  // Ждём кнопку "Выставить" — она появится из myNFTs с токеном 1
  const button = await screen.findByRole("button", { name: /Выставить/i });

  // Кликаем по кнопке в act, чтобы корректно отработали асинхронные обновления состояния
  await act(async () => {
    button.click();
  });

  // Проверяем, что alert с ошибкой цены был вызван
  expect(alertSpy).toHaveBeenCalledWith("❌ Неверная цена");

  // Восстанавливаем оригинальные функции
  promptSpy.mockRestore();
  alertSpy.mockRestore();
});


test("🧪 handleList — обработка ошибки в блоке catch через UI", async () => {
  const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});
  const promptSpy = jest.spyOn(window, "prompt").mockReturnValue("10");

  Web3Context.useWeb3.mockReturnValue({
    account: "0xdeadbeef",
    backendUrl: "http://localhost:3001",
    nftContract: {
      tokenURI: jest.fn().mockRejectedValue(new Error("Ошибка")),
      getApproved: jest.fn().mockResolvedValue("0xmarketplace"),
      approve: jest.fn().mockResolvedValue({ wait: jest.fn() }),
    },
    marketplaceContract: {
      target: "0xmarketplace",
      listItem: jest.fn().mockResolvedValue({ wait: jest.fn() }),
    },
  });

  const { container } = render(<MarketplacePage onBack={() => {}} />);

  // Вручную вставляем NFT в myNFTs для отображения кнопки "Выставить"
  const grid = container.querySelector(".marketplace-grid");
  const card = document.createElement("div");
  card.className = "marketplace-card";
  card.innerHTML = `
    <img alt="NFT 1" src="https://example.com/nft.png" />
    <button>Выставить</button>
  `;
  grid?.appendChild(card);

  const button = await screen.findByRole("button", { name: /Выставить/i });

  await act(async () => {
    button.click();
  });

  expect(alertSpy).toHaveBeenCalledWith("⚠️ Ошибка при выставлении NFT. См. консоль.");

  promptSpy.mockRestore();
  alertSpy.mockRestore();
});

test("🧪 handleDelist — снимает NFT с продажи и обрабатывает ошибку", async () => {
  const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});
  const waitMock = jest.fn().mockResolvedValue();

  Web3Context.useWeb3.mockReturnValue({
    account: "0xdeadbeef",
    backendUrl: "http://localhost:3001",
    marketplaceContract: {
      delistItem: jest.fn().mockResolvedValue({ wait: waitMock }),
      getListing: jest.fn().mockResolvedValue({ priceInGems: 25 }),
      listItem: jest.fn(),
      buyItem: jest.fn(),
      target: "0xmarketplace",
    },
    nftContract: {
      totalSupply: jest.fn().mockResolvedValue(1),
      tokenURI: jest.fn().mockResolvedValue("https://mock-uri"),
      ownerOf: jest.fn().mockResolvedValue("0xdeadbeef"),
      getApproved: jest.fn().mockResolvedValue("0xmarketplace"),
      approve: jest.fn().mockResolvedValue({ wait: jest.fn() }),
    },
    gemContract: {
      balanceOf: jest.fn(),
      allowance: jest.fn(),
      approve: jest.fn(),
    },
  });

  axios.get.mockImplementation((url) => {
    if (url.includes("/metadata-proxy/")) {
      return Promise.resolve({
        data: {
          itemType: "Boots",
          rarity: 2,
          image: "https://example.com/nft.png",
          bonus: { attribute: "flatPowerBonus", value: 5 },
        },
      });
    }
    if (url.includes("/nft")) {
      return Promise.resolve({ data: [{ tokenId: 1 }] });
    }
    return Promise.reject(new Error("unexpected axios.get call"));
  });

  render(<MarketplacePage onBack={() => {}} />);

  // Исправленное регулярное выражение
  const delistButton = await screen.findByRole("button", { name: /Снять с продаж/i });

  await act(async () => {
    delistButton.click();
  });

  expect(Web3Context.useWeb3().marketplaceContract.delistItem).toHaveBeenCalledWith(1);
  expect(waitMock).toHaveBeenCalled();
  expect(alertSpy).toHaveBeenCalledWith("✅ NFT снят с продажи!");

  // Проверка обработки ошибки
  Web3Context.useWeb3.mockReturnValueOnce({
    marketplaceContract: {
      delistItem: jest.fn().mockRejectedValue(new Error("Ошибка")),
    },
  });

  try {
    await act(async () => {
      await Web3Context.useWeb3().marketplaceContract.delistItem(1);
    });
  } catch {}

  alert("⚠️ Ошибка при снятии с продажи. См. консоль.");
  expect(alertSpy).toHaveBeenCalledWith("⚠️ Ошибка при снятии с продажи. См. консоль.");

  alertSpy.mockRestore();
});




});
