import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import TerminalPage from "./components/TerminalPage.jsx";
import PlaylistEditorPage from "./components/PlaylistEditorPage.jsx";
import GraphicalCrossfadePage from "./components/GraphicalCrossfadePage.jsx";
import { connectSocket } from "./api/socket";

connectSocket();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/playlist-editor" element={<PlaylistEditorPage />} />
        <Route path="/crossfade" element={<GraphicalCrossfadePage />} />
        <Route path="/terminal" element={<TerminalPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
