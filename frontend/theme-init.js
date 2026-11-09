// Appliqué avant le premier rendu (évite le flash de thème). Fichier externe : CSP sans script inline.
try { var t = localStorage.getItem("darwin-theme"); if (t === "light" || t === "dark") document.documentElement.dataset.theme = t; } catch (e) { /* stockage indisponible */ }
