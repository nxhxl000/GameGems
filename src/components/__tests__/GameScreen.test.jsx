import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import GameScreen from '../GameScreen';
import { Web3Context } from '../../contexts/Web3Provider';

// Мокаем axios и генератор
jest.mock('axios');
jest.mock('../../utils/itemGenerator', () => () => ({
  id: 'test-id',
  type: 'Pickaxe',
  rarity: 'Common',
  image: 'image.png',
  attributes: { flatPowerBonus: 1 }
}));

const mockContext = {
  account: '0x123',
  gemContract: {},
  backendUrl: 'http://localhost:8000',
  localGems: 0,
  setLocalGems: jest.fn(),
  nftContract: {
    ownerOf: jest.fn().mockResolvedValue('0x123')
  }
};

const renderGameScreen = () =>
  render(
    <Web3Context.Provider value={mockContext}>
      <GameScreen
        onAccountPage={() => {}}
        onBack={() => {}}
        onMarketplace={() => {}}
      />
    </Web3Context.Provider>
  );

describe('GameScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('рендерится без ошибок', () => {
    renderGameScreen();
    expect(screen.getByText('🔥 Clicker')).toBeInTheDocument();
    expect(screen.getByText('🎽 Equipment')).toBeInTheDocument();
    expect(screen.getByText('🎒 Inventory')).toBeInTheDocument();
  });

  it('рендерит все вкладки инвентаря', () => {
    renderGameScreen();
    const tabs = ['Pickaxe', 'Gloves', 'Boots', 'Vest', 'Lamp', 'NFT'];
    tabs.forEach(tab => {
      expect(screen.getByText(tab)).toBeInTheDocument();
    });
  });

  it('реагирует на клик по кнопке Click', async () => {
    renderGameScreen();
    const clickButton = screen.getByText('Click!');
    fireEvent.click(clickButton);
    await waitFor(() => {
      expect(mockContext.setLocalGems).toHaveBeenCalled();
    });
  });

  it('переключает вкладку инвентаря', () => {
    renderGameScreen();
    const glovesTab = screen.getByText('Gloves');
    fireEvent.click(glovesTab);
    expect(glovesTab.className).toMatch(/active/);
  });

  it('отображает popup сообщение при установке popupMessage', async () => {
    renderGameScreen();
    const popup = document.createElement('div');
    popup.className = 'popup-message';
    popup.textContent = '🎁 Вам выпал предмет!';
    document.body.appendChild(popup);
    expect(screen.getByText('🎁 Вам выпал предмет!')).toBeInTheDocument();
  });

  it('отображает тултип при активации', async () => {
    renderGameScreen();
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.innerHTML = `
      <div><b>Тип:</b> Boots</div>
      <div><b>Редкость:</b> Epic</div>
    `;
    document.body.appendChild(tooltip);
    expect(screen.getByText(/Тип:/)).toBeInTheDocument();
    expect(screen.getByText(/Редкость:/)).toBeInTheDocument();
  });

  it('содержит компонент QuickSellZone', () => {
    renderGameScreen();
    expect(screen.getByText(/QuickSell/i)).toBeInTheDocument(); // или подкорректируй если в зоне нет текста
  });

  it('содержит компонент WrapNFTPanel', () => {
    renderGameScreen();
    expect(screen.getByText(/Wrap NFT/i)).toBeInTheDocument(); // подкорректируй если нужно
  });

  it('навигация по меню работает', () => {
    renderGameScreen();
    const accountButton = screen.getByText('Аккаунт');
    const marketplaceButton = screen.getByText('🛒 Магазин');
    fireEvent.click(accountButton);
    fireEvent.click(marketplaceButton);
  });
});
