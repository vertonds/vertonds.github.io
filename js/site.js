/* vertonds.github.io — comportamento da página
   1. entrada suave das seções ao rolar (desligada com prefers-reduced-motion)
   2. gráfico interativo de churn no card do ISP Analytics (SVG, sem biblioteca)
   Sem JavaScript: a página é a mesma, com a imagem estática no lugar do gráfico. */
(function () {
  "use strict";
  document.documentElement.classList.add("js");

  /* ---------- 1. Entrada suave ---------- */
  var menosMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var secoes = document.querySelectorAll(".reveal");
  if (!menosMovimento && "IntersectionObserver" in window) {
    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("visivel"); obs.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    secoes.forEach(function (s) { obs.observe(s); });
  } else {
    secoes.forEach(function (s) { s.classList.add("visivel"); });
  }

  /* ---------- 2. Gráfico de churn ---------- */
  var fig = document.getElementById("grafico-churn");
  var D = window.CHURN;
  if (!fig || !D || !D.meses || !D.series) return;

  var NS = "http://www.w3.org/2000/svg";
  var JANELA = 24;                                   // últimos 24 meses, como na imagem estática
  var ini = Math.max(0, D.meses.length - JANELA);
  var meses = D.meses.slice(ini);
  var series = D.series.map(function (s) {
    return { nome: s.nome, total: s.nome === "Total",
             churn: s.churn.slice(ini), ativos: s.ativos.slice(ini), perdas: s.perdas.slice(ini) };
  });
  var cores = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)", "var(--s5)"];
  function cor(i) { return series[i].total ? "var(--texto)" : cores[i % cores.length]; }

  var W, H, M, pw, ph, estreito;
  function medir() {
    W = Math.max(300, Math.round(fig.clientWidth - 2 * parseFloat(getComputedStyle(fig).paddingLeft)));
    estreito = W < 560;                                    // celular: sem rótulos no fim das linhas (a legenda e a tabela cobrem)
    H = Math.round(Math.min(400, Math.max(220, W * 0.42)));
    M = { t: 16, r: estreito ? 12 : 64, b: 32, l: estreito ? 40 : 48 };
    pw = W - M.l - M.r; ph = H - M.t - M.b;
  }
  medir();
  var maxY = Math.ceil(Math.max.apply(null, series.map(function (s) { return Math.max.apply(null, s.churn); })) * 2) / 2;
  function x(i) { return M.l + (meses.length === 1 ? 0 : i * pw / (meses.length - 1)); }
  function y(v) { return M.t + ph - (v / maxY) * ph; }
  function fmtMes(m) { return m.slice(5, 7) + "/" + m.slice(2, 4); }
  function fmtPct(v) { return v.toFixed(2).replace(".", ",") + "%"; }
  function fmtInt(v) { return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, "."); }
  function el(tag, attrs, pai) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (pai) pai.appendChild(e);
    return e;
  }

  var svg, cruz, marcas, alvo;
  function desenhar() {
  svg = el("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, class: "grafico-svg", role: "img", tabindex: "0",
                    "aria-label": "Churn mensal por filial nos últimos 24 meses. Use as setas para percorrer os meses." });

  // grade e eixo Y (recessivos)
  var passo = maxY <= 2 ? 0.25 : maxY <= 4 ? 0.5 : 1;        // marcas "redondas" no eixo
  for (var v = 0; v <= maxY + 1e-9; v += passo) {
    var yy = y(v);
    el("line", { x1: M.l, x2: W - M.r, y1: yy, y2: yy, class: "grafico-grade" }, svg);
    var t = el("text", { x: M.l - 8, y: yy + 4, "text-anchor": "end", class: "grafico-eixo" }, svg);
    t.textContent = (passo < 1 ? v.toFixed(2).replace(/0$/, "").replace(/\.0$/, "") : String(v)).replace(".", ",") + "%";
  }
  // eixo X: um rótulo a cada 3 meses
  var passoX = estreito ? 6 : 3;
  meses.forEach(function (m, i) {
    if (i % passoX === 0) { var tx = el("text", { x: x(i), y: H - 12, "text-anchor": "middle", class: "grafico-eixo" }, svg); tx.textContent = fmtMes(m); }
  });
  // linhas
  series.forEach(function (s, i) {
    var d = s.churn.map(function (v, k) { return (k ? "L" : "M") + x(k).toFixed(1) + " " + y(v).toFixed(1); }).join(" ");
    el("path", { d: d, fill: "none", stroke: cor(i), "stroke-width": s.total ? 3 : 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
    if (!estreito) {
      var ultimo = s.churn.length - 1;
      var rot = el("text", { x: x(ultimo) + 8, y: y(s.churn[ultimo]) + 4, class: "grafico-rotulo" + (s.total ? " total" : "") }, svg);
      rot.textContent = s.nome.replace("Filial ", "");
    }
  });
  // ajuste simples contra rótulos sobrepostos no fim das linhas
  var rotulos = Array.prototype.slice.call(svg.querySelectorAll(".grafico-rotulo")).sort(function (a, b) { return +a.getAttribute("y") - +b.getAttribute("y"); });
  for (var r = 1; r < rotulos.length; r++) {
    var yAnt = +rotulos[r - 1].getAttribute("y"), yCur = +rotulos[r].getAttribute("y");
    if (yCur - yAnt < 13) rotulos[r].setAttribute("y", yAnt + 13);
  }
  // camada de interação
  cruz = el("line", { y1: M.t, y2: M.t + ph, class: "grafico-cruz", opacity: 0 }, svg);
  marcas = series.map(function (s, i) { return el("circle", { r: 5, fill: cor(i), class: "grafico-marca", opacity: 0 }, svg); });
  alvo = el("rect", { x: M.l, y: M.t, width: pw, height: ph, fill: "transparent", class: "grafico-alvo" }, svg);
  alvo.addEventListener("pointermove", function (ev) { mostrar(indicePeloPonteiro(ev)); });
  alvo.addEventListener("pointerdown", function (ev) { mostrar(indicePeloPonteiro(ev)); });
  svg.addEventListener("pointerleave", esconder);
  svg.addEventListener("focus", function () { mostrar(meses.length - 1); });
  svg.addEventListener("blur", esconder);
  svg.addEventListener("keydown", teclado);
  }

  var tip = document.createElement("div"); tip.className = "grafico-tip"; tip.hidden = true;
  var tipTitulo = document.createElement("div"); tipTitulo.className = "grafico-tip-mes"; tip.appendChild(tipTitulo);
  var tipLista = document.createElement("dl"); tip.appendChild(tipLista);
  var vivo = document.createElement("p"); vivo.className = "sr-only"; vivo.setAttribute("aria-live", "polite");

  var atual = -1;
  function mostrar(i) {
    if (i < 0 || i >= meses.length) return;
    atual = i;
    cruz.setAttribute("x1", x(i)); cruz.setAttribute("x2", x(i)); cruz.setAttribute("opacity", 1);
    series.forEach(function (s, k) { marcas[k].setAttribute("cx", x(i)); marcas[k].setAttribute("cy", y(s.churn[i])); marcas[k].setAttribute("opacity", 1); });
    tipTitulo.textContent = "Mês " + fmtMes(meses[i]);
    while (tipLista.firstChild) tipLista.removeChild(tipLista.firstChild);
    var falado = [];
    series.forEach(function (s, k) {
      var dt = document.createElement("dt"); var chave = document.createElement("i"); chave.style.background = cor(k); dt.appendChild(chave);
      dt.appendChild(document.createTextNode(s.nome));
      var dd = document.createElement("dd"); var forte = document.createElement("strong"); forte.textContent = fmtPct(s.churn[i]); dd.appendChild(forte);
      dd.appendChild(document.createTextNode(" · " + fmtInt(s.perdas[i]) + " de " + fmtInt(s.ativos[i])));
      tipLista.appendChild(dt); tipLista.appendChild(dd);
      falado.push(s.nome + " " + fmtPct(s.churn[i]));
    });
    vivo.textContent = fmtMes(meses[i]) + ": " + falado.join(", ");
    tip.hidden = false;
    var caixa = fig.getBoundingClientRect(), svgBox = svg.getBoundingClientRect();
    var px = svgBox.left - caixa.left + x(i) * svgBox.width / W;
    tip.style.left = (px + 14 + tip.offsetWidth > caixa.width ? px - tip.offsetWidth - 14 : px + 14) + "px";
    tip.style.top = (svgBox.top - caixa.top + M.t * svgBox.height / H) + "px";
  }
  function esconder() {
    atual = -1; tip.hidden = true; cruz.setAttribute("opacity", 0);
    marcas.forEach(function (m) { m.setAttribute("opacity", 0); });
  }
  function indicePeloPonteiro(ev) {
    var box = svg.getBoundingClientRect();
    var gx = (ev.clientX - box.left) * W / box.width;
    var i = Math.round((gx - M.l) / pw * (meses.length - 1));
    return Math.max(0, Math.min(meses.length - 1, i));
  }
  function teclado(ev) {
    if (ev.key === "ArrowLeft") { ev.preventDefault(); mostrar(Math.max(0, (atual < 0 ? meses.length : atual) - 1)); }
    else if (ev.key === "ArrowRight") { ev.preventDefault(); mostrar(Math.min(meses.length - 1, atual + 1)); }
    else if (ev.key === "Home") { ev.preventDefault(); mostrar(0); }
    else if (ev.key === "End") { ev.preventDefault(); mostrar(meses.length - 1); }
    else if (ev.key === "Escape") { esconder(); }
  }

  // legenda (chave em traço, como nas linhas)
  var legenda = document.createElement("ul"); legenda.className = "grafico-legenda"; legenda.setAttribute("aria-label", "Séries");
  series.forEach(function (s, i) {
    var li = document.createElement("li"); var chave = document.createElement("i"); chave.style.background = cor(i);
    if (s.total) chave.style.height = "3px";
    li.appendChild(chave); li.appendChild(document.createTextNode(s.nome)); legenda.appendChild(li);
  });

  // tabela: os mesmos números, sem precisar passar o mouse
  var det = document.createElement("details"); det.className = "grafico-tabela";
  var sum = document.createElement("summary"); sum.textContent = "Ver os números em tabela"; det.appendChild(sum);
  var rol = document.createElement("div"); rol.className = "tabela-rolagem"; rol.setAttribute("role", "region"); rol.setAttribute("tabindex", "0"); rol.setAttribute("aria-label", "Tabela do gráfico, rolável na horizontal em telas estreitas"); det.appendChild(rol);
  var tab = document.createElement("table"); rol.appendChild(tab);
  var cap = document.createElement("caption"); cap.textContent = "Churn mensal (%) por filial · " + D.fonte; tab.appendChild(cap);
  var thead = document.createElement("thead"); var trh = document.createElement("tr"); thead.appendChild(trh); tab.appendChild(thead);
  var th0 = document.createElement("th"); th0.textContent = "Mês"; th0.setAttribute("scope", "col"); trh.appendChild(th0);
  series.forEach(function (s) { var th = document.createElement("th"); th.textContent = s.nome; th.setAttribute("scope", "col"); trh.appendChild(th); });
  var tbody = document.createElement("tbody"); tab.appendChild(tbody);
  meses.forEach(function (m, i) {
    var tr = document.createElement("tr"); var th = document.createElement("th"); th.setAttribute("scope", "row"); th.textContent = fmtMes(m); tr.appendChild(th);
    series.forEach(function (s) { var td = document.createElement("td"); td.textContent = fmtPct(s.churn[i]); tr.appendChild(td); });
    tbody.appendChild(tr);
  });

  // monta: substitui a imagem estática
  var img = fig.querySelector("img");
  var caixa = document.createElement("div"); caixa.className = "grafico-caixa";
  desenhar();
  caixa.appendChild(svg); caixa.appendChild(tip);
  var larguraAnterior = W, timer;
  window.addEventListener("resize", function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      medir();
      if (W === larguraAnterior) return;
      larguraAnterior = W; esconder();
      var velho = svg; desenhar(); caixa.replaceChild(svg, velho);
    }, 120);
  });
  if (img) fig.replaceChild(caixa, img); else fig.insertBefore(caixa, fig.firstChild);
  fig.insertBefore(legenda, caixa);
  fig.appendChild(vivo);
  var legendaFig = fig.querySelector("figcaption");
  if (legendaFig) fig.insertBefore(det, legendaFig); else fig.appendChild(det);
  fig.classList.add("grafico-vivo");
})();
