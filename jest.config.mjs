/** @type {import('jest').Config} */
export default {
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: [
    "src/components/**/*.{js,jsx}",
    "!**/__tests__/**",
    "!**/Web3Provider.jsx",
    "!**/GameScreen.jsx"
  ],
  coveragePathIgnorePatterns: ["Web3Provider.jsx", "GameScreen.jsx"],
  coverageDirectory: "coverage",
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.[jt]sx?$": "babel-jest"
  },
  moduleFileExtensions: ["js", "jsx"],
  moduleNameMapper: {
    "^.+\\.(css|less|scss|sass)$": "identity-obj-proxy"
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testMatch: ["**/__tests__/**/*.test.[jt]s?(x)"]
};