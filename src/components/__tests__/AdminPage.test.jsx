import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { act } from "react";
import AdminPage from "../AdminPage";
import axios from "axios";

jest.mock("axios");

describe("AdminPage", () => {
  const mockProps = {
    totalSupply: 1000,
    availableForSale: 500,
    accounts: [
      { username: "Alice", address: "0x123", balance: 300 },
      { username: "Bob", address: "0x456", balance: 200 },
    ],
    ethBalance: "1.5",
    adminAddress: "0xADMIN",
    onBack: jest.fn(),
    onRefresh: jest.fn(),
    onExport: jest.fn(),
    onWithdraw: jest.fn(),
    onAdminDrop: jest.fn(),
  };

  beforeEach(() => {
    axios.get.mockResolvedValue({
      data: { common: 10, rare: 20, epic: 50, legendary: 100 },
    });

    window.alert = jest.fn();
    jest.clearAllMocks();
  });

  it("renders all base info correctly", async () => {
    await act(async () => {
      render(<AdminPage {...mockProps} />);
    });
    expect(screen.getByText(/Админ-панель/)).toBeInTheDocument();
    expect(screen.getByText(/0xADMIN/i)).toBeInTheDocument();
    expect(screen.getByText(/1000/)).toBeInTheDocument();
    expect(screen.getByText(/500/)).toBeInTheDocument();
    expect(screen.getByText(/1.5 ETH/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("10")).toBeInTheDocument();
  });

  it("calls onRefresh when 'Обновить' clicked", async () => {
    await act(async () => {
      render(<AdminPage {...mockProps} />);
    });
    fireEvent.click(screen.getByText((t) => t.includes("Обновить")));
    expect(mockProps.onRefresh).toHaveBeenCalled();
  });

  it("calls onAdminDrop with valid input", async () => {
    await act(async () => {
      render(<AdminPage {...mockProps} />);
    });
    fireEvent.change(screen.getByPlaceholderText(/Количество GEM/i), {
      target: { value: "50" },
    });
    fireEvent.click(screen.getByText("Добавить"));
    expect(mockProps.onAdminDrop).toHaveBeenCalledWith(50);
  });

  it("does not call onAdminDrop with invalid input", async () => {
    await act(async () => {
      render(<AdminPage {...mockProps} />);
    });
    fireEvent.change(screen.getByPlaceholderText(/Количество GEM/i), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByText("Добавить"));
    expect(mockProps.onAdminDrop).not.toHaveBeenCalled();
  });

  it("sorts accounts by balance", async () => {
    await act(async () => {
      render(<AdminPage {...mockProps} />);
    });
    fireEvent.click(screen.getByText(/Баланс GEM/));
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Bob");
    expect(rows[2]).toHaveTextContent("Alice");
  });

  it("saves prices via axios.post and shows alert", async () => {
    axios.post.mockResolvedValue({});
    await act(async () => {
      render(<AdminPage {...mockProps} />);
    });
    fireEvent.click(screen.getByText((t) => t.includes("Сохранить цены")));
    await waitFor(() => {
      expect(axios.post).toHaveBeenCalled();
      expect(window.alert).toHaveBeenCalledWith("Цены сохранены!");
    });
  });

  it("shows alert on axios.post error", async () => {
    axios.post.mockRejectedValue(new Error("Network error"));
    await act(async () => {
      render(<AdminPage {...mockProps} />);
    });
    fireEvent.click(screen.getByText((t) => t.includes("Сохранить цены")));
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith("Не удалось сохранить цены");
    });
  });

  it("calls onBack when 'Назад' clicked", async () => {
    await act(async () => {
      render(<AdminPage {...mockProps} />);
    });
    fireEvent.click(screen.getByText((t) => t.includes("Назад")));
    expect(mockProps.onBack).toHaveBeenCalled();
  });

  it("calls onExport when 'Экспорт' clicked", async () => {
    await act(async () => {
      render(<AdminPage {...mockProps} />);
    });
    fireEvent.click(screen.getByText((t) => t.includes("Экспорт")));
    expect(mockProps.onExport).toHaveBeenCalled();
  });

  it("calls onWithdraw when 'Вывод ETH' clicked и подтверждено", async () => {
    window.confirm = jest.fn(() => true);
    await act(async () => {
      render(<AdminPage {...mockProps} />);
    });
    fireEvent.click(screen.getByRole("button", { name: /Вывод ETH/i }));
    expect(mockProps.onWithdraw).toHaveBeenCalled();
  });

  it("не вызывает onAdminDrop при 0 или отрицательном значении", async () => {
    await act(async () => {
      render(<AdminPage {...mockProps} />);
    });

    const input = screen.getByPlaceholderText(/Количество GEM/i);
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.click(screen.getByText("Добавить"));
    expect(mockProps.onAdminDrop).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "-5" } });
    fireEvent.click(screen.getByText("Добавить"));
    expect(mockProps.onAdminDrop).not.toHaveBeenCalled();
  });

  it("позволяет изменять цены и сохраняет их", async () => {
    axios.post.mockResolvedValue({});
    await act(async () => {
      render(<AdminPage {...mockProps} />);
    });

    fireEvent.change(screen.getByDisplayValue("10"), {
      target: { value: "15" },
    });

    fireEvent.click(screen.getByText(/Сохранить цены/));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining("/sell-prices"),
        {
          common: 15,
          rare: 20,
          epic: 50,
          legendary: 100,
        }
      );
      expect(window.alert).toHaveBeenCalledWith("Цены сохранены!");
    });
  });

  it("не вызывает onWithdraw, если отменено подтверждение", async () => {
    window.confirm = jest.fn(() => false);
    await act(async () => {
      render(<AdminPage {...mockProps} />);
    });
    fireEvent.click(screen.getByRole("button", { name: /Вывод ETH/i }));
    expect(mockProps.onWithdraw).not.toHaveBeenCalled();
  });
});
