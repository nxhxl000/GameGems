import React from "react";
import { render, screen } from "@testing-library/react";
import Header from "../Header";

describe("Header", () => {
  const mockProps = {
    username: "testuser",
    account: "0x1234567890abcdef",
    gems: 42,
  };

  it("отображает имя, адрес и баланс GEM", () => {
    render(<Header {...mockProps} />);

    // Проверка полного текста <p> элемента
    expect(screen.getByText((_, el) =>
      el.tagName.toLowerCase() === 'p' && el.textContent === 'Имя: testuser'
    )).toBeInTheDocument();

    expect(screen.getByText((_, el) =>
      el.tagName.toLowerCase() === 'p' && el.textContent === 'Адрес: 0x1234567890abcdef'
    )).toBeInTheDocument();

    expect(screen.getByText((_, el) =>
      el.tagName.toLowerCase() === 'p' && el.textContent === 'Баланс GEM: 42'
    )).toBeInTheDocument();
  });
});