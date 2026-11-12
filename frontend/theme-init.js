// Applied before the first render (avoids the theme flash). External file: CSP without inline script.
try { var t = localStorage.getItem("darwin-theme"); if (t === "light" || t === "dark") document.documentElement.dataset.theme = t; } catch (e) { /* storage unavailable */ }
