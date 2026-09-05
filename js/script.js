// SCRIPTS DE INTERACTIVIDAD - UGI
const header = document.querySelector("[data-header]");
const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".main-nav");
const menuLabel = menuButton?.querySelector(".sr-only");

// Función para el fondo del header al hacer scroll
const updateHeader = () => {
  if (header) {
    header.classList.toggle("scrolled", window.scrollY > 24);
  }
};

// Función para cerrar el menú móvil
const closeMenu = () => {
  menuButton?.setAttribute("aria-expanded", "false");
  navigation?.classList.remove("open");
  document.body.style.overflow = "";
  if (menuLabel) menuLabel.textContent = "Abrir menú";
};

// Evento Click para abrir/cerrar menú
if (menuButton && navigation) {
  menuButton.addEventListener("click", () => {
    const isOpen = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!isOpen));
    navigation.classList.toggle("open", !isOpen);
    document.body.style.overflow = isOpen ? "" : "hidden";
    if (menuLabel) {
      menuLabel.textContent = isOpen ? "Abrir menú" : "Cerrar menú";
    }
  });

  // Cerrar menú al hacer clic en un enlace
  navigation.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });
}

// Escuchar el scroll
window.addEventListener("scroll", updateHeader, { passive: true });
updateHeader();

// Animaciones de aparición (Reveal)
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("visible");
      revealObserver.unobserve(entry.target);
    });
  },
  { threshold: 0.14 }
);

document.querySelectorAll(".reveal").forEach((element, index) => {
  // Retraso escalonado para que aparezcan de a uno
  element.style.transitionDelay = `${Math.min(index % 3, 2) * 90}ms`;
  revealObserver.observe(element);
});

// Actualizar el año del copyright automáticamente
const year = document.querySelector("[data-year]");
if (year) {
  year.textContent = String(new Date().getFullYear());
}