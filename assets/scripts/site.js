const header = document.querySelector("[data-header]");
const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".main-nav");

// Scroll Header
window.addEventListener("scroll", () => {
  if (header) header.classList.toggle("scrolled", window.scrollY > 24);
}, { passive: true });

// Menú Mobile
if (menuButton && navigation) {
  menuButton.addEventListener("click", () => {
    const isOpen = navigation.classList.contains("open");
    navigation.classList.toggle("open", !isOpen);
    document.body.style.overflow = isOpen ? "" : "hidden";
  });
}

// Reveal animations
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

document.querySelectorAll(".reveal").forEach(el => revealObserver.observe(el));

// Copyright Year
const yearSpan = document.querySelector("#year");
if (yearSpan) yearSpan.textContent = new Date().getFullYear();