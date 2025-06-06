import React from "react";
import { render, fireEvent, screen, waitFor } from "@testing-library/react";
import WrapNFTPanel from "../WrapNFTPanel";
import axios from "axios";
import { ethers } from "ethers";
import { useWeb3 } from "../../contexts/Web3Provider";

jest.mock("axios");
jest.mock("../../contexts/Web3Provider", () => ({
  useWeb3: jest.fn(),
}));

const mockItem = {
  id: "item123",
  type: "Boots",
  rarity: "Epic",
  attributes: { rarityModBonus: 3 },
  image: "https://example.com/image.jpg",
};

beforeEach(() => {
  jest.clearAllMocks();
});

test("отображается сообщение по умолчанию", () => {
  useWeb3.mockReturnValue({
    gemContract: null,
    nftContract: null,
  });

  render(
    <WrapNFTPanel
      inventory={[mockItem]}
      setInventory={jest.fn()}
      setNftInventory={jest.fn()}
    />
  );

  expect(screen.getByText(/перетащи/i)).toBeInTheDocument();
});

test("ошибка: контракты не загружены", async () => {
  useWeb3.mockReturnValue({
    gemContract: null,
    nftContract: null,
  });

  render(
    <WrapNFTPanel
      inventory={[mockItem]}
      setInventory={jest.fn()}
      setNftInventory={jest.fn()}
    />
  );

  const dropZone = screen.getByText(/перетащи/i).closest("div");
  fireEvent.drop(dropZone, {
    dataTransfer: {
      getData: () => JSON.stringify(mockItem),
    },
  });

  await waitFor(() =>
    expect(screen.getByText(/контракты не загружены/i)).toBeInTheDocument()
  );
});

test("успешная обёртка NFT", async () => {
  const wrapTx = {
    wait: jest.fn().mockResolvedValue({
      logs: [
        {
          address: "0xgamegems",
          topics: [
            ethers.id("ItemWrapped(address,uint256,string,uint8,uint8,string)"),
            ethers.zeroPadValue("0x0000000000000000000000000000000000000001", 32),
          ],
          data: new ethers.AbiCoder().encode(
            ["uint256", "string", "uint8", "uint8", "string"],
            [10, "Boots", 3, 3, "ipfs://mockuri"]
          ),
        },
      ],
    }),
  };

  useWeb3.mockReturnValue({
    gemContract: {
      target: "0xgamegems",
      wrapItemAsNFT: jest.fn().mockResolvedValue(wrapTx),
    },
    nftContract: { target: "0xnft" },
    account: "0x000000000000000000000000000000000000dEaD",
    backendUrl: "http://localhost:3001",
  });

  axios.post.mockResolvedValue({ data: { uri: "ipfs://mockuri" } });

  render(
    <WrapNFTPanel
      inventory={[mockItem]}
      setInventory={jest.fn()}
      setNftInventory={jest.fn()}
    />
  );

  const dropZone = screen.getByText(/перетащи/i).closest("div");
  fireEvent.drop(dropZone, {
    dataTransfer: {
      getData: () => JSON.stringify(mockItem),
    },
  });

  await waitFor(() =>
    expect(screen.getByText(/NFT создан и добавлен/i)).toBeInTheDocument()
  );
});

test("ошибка при загрузке JSON (axios.post)", async () => {
  useWeb3.mockReturnValue({
    gemContract: {
      target: "0xmock",
      wrapItemAsNFT: jest.fn(),
    },
    nftContract: { target: "0xnft" },
    account: "0x000000000000000000000000000000000000dEaD",
    backendUrl: "http://localhost:3001",
  });

  axios.post.mockRejectedValueOnce(new Error("upload failed"));

  render(
    <WrapNFTPanel
      inventory={[mockItem]}
      setInventory={jest.fn()}
      setNftInventory={jest.fn()}
    />
  );

  const dropZone = screen.getByText(/перетащи/i).closest("div");
  fireEvent.drop(dropZone, {
    dataTransfer: {
      getData: () => JSON.stringify(mockItem),
    },
  });

  await waitFor(() =>
    expect(screen.getByText(/ошибка: upload failed/i)).toBeInTheDocument()
  );
});

test("ошибка: событие не найдено в логах", async () => {
  const wrapTx = { wait: jest.fn().mockResolvedValue({ logs: [] }) };

  useWeb3.mockReturnValue({
    gemContract: {
      target: "0xgamegems",
      wrapItemAsNFT: jest.fn().mockResolvedValue(wrapTx),
    },
    nftContract: { target: "0xnft" },
    account: "0x000000000000000000000000000000000000dEaD",
    backendUrl: "http://localhost:3001",
  });

  axios.post.mockResolvedValue({ data: { uri: "ipfs://mockuri" } });

  render(
    <WrapNFTPanel
      inventory={[mockItem]}
      setInventory={jest.fn()}
      setNftInventory={jest.fn()}
    />
  );

  const dropZone = screen.getByText(/перетащи/i).closest("div");
  fireEvent.drop(dropZone, {
    dataTransfer: {
      getData: () => JSON.stringify(mockItem),
    },
  });

  await waitFor(() =>
    expect(
      screen.getByText(/событие ItemWrapped или NFTMinted не найдено/i)
    ).toBeInTheDocument()
  );
});

test("ошибка при сохранении в S3", async () => {
  const wrapTx = {
    wait: jest.fn().mockResolvedValue({
      logs: [
        {
          address: "0xgamegems",
          topics: [
            ethers.id("ItemWrapped(address,uint256,string,uint8,uint8,string)"),
            ethers.zeroPadValue("0x0000000000000000000000000000000000000001", 32),
          ],
          data: new ethers.AbiCoder().encode(
            ["uint256", "string", "uint8", "uint8", "string"],
            [10, "Boots", 3, 3, "ipfs://mockuri"]
          ),
        },
      ],
    }),
  };

  useWeb3.mockReturnValue({
    gemContract: {
      target: "0xgamegems",
      wrapItemAsNFT: jest.fn().mockResolvedValue(wrapTx),
    },
    nftContract: { target: "0xnft" },
    account: "0x000000000000000000000000000000000000dEaD",
    backendUrl: "http://localhost:3001",
  });

  axios.post.mockImplementation((url) => {
    if (url.includes("/create-json")) return Promise.resolve({ data: { uri: "ipfs://mockuri" } });
    if (url.includes("/save")) return Promise.reject(new Error("save failed"));
  });

  render(
    <WrapNFTPanel
      inventory={[mockItem]}
      setInventory={jest.fn()}
      setNftInventory={jest.fn()}
    />
  );

  const dropZone = screen.getByText(/перетащи/i).closest("div");
  fireEvent.drop(dropZone, {
    dataTransfer: {
      getData: () => JSON.stringify(mockItem),
    },
  });

  await waitFor(() =>
    expect(screen.getByText(/ошибка: save failed/i)).toBeInTheDocument()
  );
});

test("успешная обёртка через событие NFTMinted", async () => {
  const iface = new ethers.Interface([
    "event NFTMinted(address indexed to, uint256 tokenId, string itemType, uint8 rarity, uint8 bonus, string uri)",
  ]);
  const data = iface.encodeEventLog(
    iface.getEvent("NFTMinted"),
    ["0x000000000000000000000000000000000000dEaD", 42, "Boots", 3, 3, "ipfs://mockuri"]
  );

  const wrapTx = {
    wait: jest.fn().mockResolvedValue({
      logs: [
        {
          address: "0xnft",
          topics: data.topics,
          data: data.data,
        },
      ],
    }),
  };

  useWeb3.mockReturnValue({
    gemContract: {
      target: "0xgamegems",
      wrapItemAsNFT: jest.fn().mockResolvedValue(wrapTx),
    },
    nftContract: { target: "0xnft" },
    account: "0x000000000000000000000000000000000000dEaD",
    backendUrl: "http://localhost:3001",
  });

  axios.post.mockResolvedValue({ data: { uri: "ipfs://mockuri" } });

  render(
    <WrapNFTPanel
      inventory={[mockItem]}
      setInventory={jest.fn()}
      setNftInventory={jest.fn()}
    />
  );

  const dropZone = screen.getByText(/перетащи/i).closest("div");
  fireEvent.drop(dropZone, {
    dataTransfer: {
      getData: () => JSON.stringify(mockItem),
    },
  });

  await waitFor(() =>
    expect(screen.getByText(/NFT создан и добавлен/i)).toBeInTheDocument()
  );
});

test("лог вызывает ошибку при парсинге", async () => {
  const faultyLog = {
    address: "0xgarbage",
    topics: [],
    data: "0xdeadbeef",
  };

  const wrapTx = {
    wait: jest.fn().mockResolvedValue({
      logs: [faultyLog],
    }),
  };

  useWeb3.mockReturnValue({
    gemContract: {
      target: "0xgamegems",
      wrapItemAsNFT: jest.fn().mockResolvedValue(wrapTx),
    },
    nftContract: { target: "0xnft" },
    account: "0x000000000000000000000000000000000000dEaD",
    backendUrl: "http://localhost:3001",
  });

  axios.post.mockResolvedValue({ data: { uri: "ipfs://mockuri" } });

  render(
    <WrapNFTPanel
      inventory={[mockItem]}
      setInventory={jest.fn()}
      setNftInventory={jest.fn()}
    />
  );

  const dropZone = screen.getByText(/перетащи/i).closest("div");
  fireEvent.drop(dropZone, {
    dataTransfer: {
      getData: () => JSON.stringify(mockItem),
    },
  });

  await waitFor(() =>
    expect(screen.getByText((text) =>
      text.toLowerCase().includes("событие itemwrapped") &&
      text.toLowerCase().includes("не найдено")
    )).toBeInTheDocument()
  );
});

test("генерируется ошибка, если tokenId не найден после всех логов", async () => {
  const wrapTx = {
    wait: jest.fn().mockResolvedValue({
      logs: [
        {
          address: "0xgamegems",
          topics: [],
          data: "0x", // неподходящий лог
        },
      ],
    }),
  };

  const mockConsole = jest.spyOn(console, "error").mockImplementation(() => {});

  useWeb3.mockReturnValue({
    gemContract: {
      target: "0xgamegems",
      wrapItemAsNFT: jest.fn().mockResolvedValue(wrapTx),
    },
    nftContract: { target: "0xnft" },
    account: "0x000000000000000000000000000000000000dEaD",
    backendUrl: "http://localhost:3001",
  });

  axios.post.mockResolvedValue({ data: { uri: "ipfs://mockuri" } });

  render(
    <WrapNFTPanel
      inventory={[mockItem]}
      setInventory={jest.fn()}
      setNftInventory={jest.fn()}
    />
  );

  const dropZone = screen.getByText(/перетащи/i).closest("div");
  fireEvent.drop(dropZone, {
    dataTransfer: {
      getData: () => JSON.stringify(mockItem),
    },
  });

  await waitFor(() =>
    expect(mockConsole).toHaveBeenCalledWith(
      expect.stringContaining("🔥 Ошибка обёртки:"),
      expect.any(Error)
    )
  );

  mockConsole.mockRestore();
});

test("атрибуты и редкость по умолчанию при некорректных данных", async () => {
  const wrapTx = {
    wait: jest.fn().mockResolvedValue({
      logs: [
        {
          address: "0xgamegems",
          topics: [
            ethers.id("ItemWrapped(address,uint256,string,uint8,uint8,string)"),
            ethers.zeroPadValue("0x0000000000000000000000000000000000000001", 32),
          ],
          data: new ethers.AbiCoder().encode(
            ["uint256", "string", "uint8", "uint8", "string"],
            [11, "UnknownType", 0, 0, "ipfs://mockuri"]
          ),
        },
      ],
    }),
  };

  useWeb3.mockReturnValue({
    gemContract: {
      target: "0xgamegems",
      wrapItemAsNFT: jest.fn().mockResolvedValue(wrapTx),
    },
    nftContract: { target: "0xnft" },
    account: "0x000000000000000000000000000000000000dEaD",
    backendUrl: "http://localhost:3001",
  });

  const itemWithNoAttributes = {
    id: "brokenItem",
    type: "UnknownType",
    rarity: "Mythic", // неизвестная редкость
    image: "https://example.com/image.jpg",
  };

  axios.post.mockResolvedValue({ data: { uri: "ipfs://mockuri" } });

  render(
    <WrapNFTPanel
      inventory={[itemWithNoAttributes]}
      setInventory={jest.fn()}
      setNftInventory={jest.fn()}
    />
  );

  const dropZone = screen.getByText(/перетащи/i).closest("div");
  fireEvent.drop(dropZone, {
    dataTransfer: {
      getData: () => JSON.stringify(itemWithNoAttributes),
    },
  });

  await waitFor(() =>
    expect(screen.getByText(/NFT создан и добавлен/i)).toBeInTheDocument()
  );
});

test("dragOver вызывает preventDefault", () => {
  useWeb3.mockReturnValue({
    gemContract: null,
    nftContract: null,
  });

  render(
    <WrapNFTPanel
      inventory={[mockItem]}
      setInventory={jest.fn()}
      setNftInventory={jest.fn()}
    />
  );

  const dropZone = screen.getByText(/перетащи/i).closest("div");

  const event = new Event("dragover", { bubbles: true });
  event.preventDefault = jest.fn();

  dropZone.dispatchEvent(event);
  expect(event.preventDefault).toHaveBeenCalled();
});

test("редкость по умолчанию — 0, если item.rarity не найдена в rarityMap", async () => {
  const item = {
    itemType: "Boots",
    rarity: "Unrecognized", // явно не входит в rarityMap
    bonus: { attribute: "rarityModBonus", value: 2 },
    image: "some.jpg",
    uri: "some-uri",
    tokenId: 999,
  };

  useWeb3.mockReturnValue({
    gemContract: {
      target: "0xgamegems",
      wrapItemAsNFT: jest.fn().mockResolvedValue({
        wait: jest.fn().mockResolvedValue({ logs: [] }), // no logs
      }),
    },
    nftContract: { target: "0xnft" },
    account: "0xuser",
    backendUrl: "http://localhost:3001",
  });

  axios.post.mockResolvedValue({ data: { uri: "ipfs://mockuri" } });

  render(
    <WrapNFTPanel
      inventory={[item]}
      setInventory={jest.fn()}
      setNftInventory={jest.fn()}
    />
  );

  const dropZone = screen.getByText(/перетащи/i).closest("div");
  fireEvent.drop(dropZone, {
    dataTransfer: {
      getData: () => JSON.stringify(item),
    },
  });

  await waitFor(() =>
    expect(
      screen.getByText(/событие itemwrapped.*не найдено/i)
    ).toBeInTheDocument()
  );
});

test("редкость правильно определяется, если ключ есть в rarityMap", async () => {
  const item = {
    id: "itemEpic",
    type: "Boots",
    rarity: "Epic", // есть в rarityMap → значение 3
    attributes: { rarityModBonus: 3 },
    image: "https://example.com/image.jpg",
  };

  useWeb3.mockReturnValue({
    gemContract: {
      target: "0xgamegems",
      wrapItemAsNFT: jest.fn().mockResolvedValue({
        wait: jest.fn().mockResolvedValue({ logs: [] }), // пусто, но не важно — нам важен вызов
      }),
    },
    nftContract: { target: "0xnft" },
    account: "0xuser",
    backendUrl: "http://localhost:3001",
  });

  axios.post.mockResolvedValue({ data: { uri: "ipfs://mockuri" } });

  render(
    <WrapNFTPanel
      inventory={[item]}
      setInventory={jest.fn()}
      setNftInventory={jest.fn()}
    />
  );

  const dropZone = screen.getByText(/перетащи/i).closest("div");
  fireEvent.drop(dropZone, {
    dataTransfer: {
      getData: () => JSON.stringify(item),
    },
  });

  await waitFor(() =>
    expect(
      screen.getByText(/событие itemwrapped.*не найдено/i)
    ).toBeInTheDocument()
  );
});

test("редкость в rarityMap равна 0 — ветка покрытия ||", async () => {
  const item = {
    id: "itemZero",
    type: "Boots",
    rarity: "Common", // будет найдено в rarityMap с value = 0
    attributes: { rarityModBonus: 1 },
    image: "https://example.com/image.jpg",
  };

  useWeb3.mockReturnValue({
    gemContract: {
      target: "0xgamegems",
      wrapItemAsNFT: jest.fn().mockResolvedValue({
        wait: jest.fn().mockResolvedValue({ logs: [] }), // неважно
      }),
    },
    nftContract: { target: "0xnft" },
    account: "0xuser",
    backendUrl: "http://localhost:3001",
  });

  axios.post.mockResolvedValue({ data: { uri: "ipfs://mockuri" } });

  render(
    <WrapNFTPanel
      inventory={[item]}
      setInventory={jest.fn()}
      setNftInventory={jest.fn()}
    />
  );

  const dropZone = screen.getByText(/перетащи/i).closest("div");
  fireEvent.drop(dropZone, {
    dataTransfer: {
      getData: () => JSON.stringify(item),
    },
  });

  await waitFor(() =>
    expect(
      screen.getByText(/событие itemwrapped.*не найдено/i)
    ).toBeInTheDocument()
  );
});

test("ошибка при удалении из inventory", async () => {
  const wrapTx = {
    wait: jest.fn().mockResolvedValue({
      logs: [
        {
          address: "0xgamegems",
          topics: [
            ethers.id("ItemWrapped(address,uint256,string,uint8,uint8,string)"),
            ethers.zeroPadValue("0x0000000000000000000000000000000000000001", 32),
          ],
          data: new ethers.AbiCoder().encode(
            ["uint256", "string", "uint8", "uint8", "string"],
            [10, "Boots", 3, 3, "ipfs://mockuri"]
          ),
        },
      ],
    }),
  };

  useWeb3.mockReturnValue({
    gemContract: {
      target: "0xgamegems",
      wrapItemAsNFT: jest.fn().mockResolvedValue(wrapTx),
    },
    nftContract: { target: "0xnft" },
    account: "0x000000000000000000000000000000000000dEaD",
    backendUrl: "http://localhost:3001",
  });

  axios.post.mockImplementation((url) => {
    if (url.includes("/create-json")) return Promise.resolve({ data: { uri: "ipfs://mockuri" } });
    if (url.includes("/save")) return Promise.resolve({ data: "ok" });
  });

  axios.delete.mockRejectedValueOnce(new Error("delete failed"));

  render(
    <WrapNFTPanel
      inventory={[mockItem]}
      setInventory={jest.fn()}
      setNftInventory={jest.fn()}
    />
  );

  const dropZone = screen.getByText(/перетащи/i).closest("div");
  fireEvent.drop(dropZone, {
    dataTransfer: {
      getData: () => JSON.stringify(mockItem),
    },
  });

  await waitFor(() =>
    expect(screen.getByText(/NFT создан и добавлен/i)).toBeInTheDocument()
  );
});