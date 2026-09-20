import "./style.css";
import { initSimulator } from "./simulator";
import { initStats } from "./stats";
import { initMap } from "./map";

async function boot() {
  const simEl = document.getElementById("simulator");
  const statsEl = document.getElementById("stats");
  const mapEl = document.getElementById("map");
  const noticeBtn = document.getElementById("notice-btn");
  const modal = document.getElementById("notice-modal");
  const modalClose = document.getElementById("notice-close");
  const modalBackdrop = document.getElementById("notice-backdrop");

  if (simEl) initSimulator(simEl);
  if (statsEl) initStats(statsEl);
  if (mapEl) initMap(mapEl);

  const openModal = () => modal?.classList.add("open");
  const closeModal = () => modal?.classList.remove("open");
  noticeBtn?.addEventListener("click", openModal);
  modalClose?.addEventListener("click", closeModal);
  modalBackdrop?.addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

boot();
