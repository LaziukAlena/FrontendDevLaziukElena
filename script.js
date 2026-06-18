document.addEventListener("DOMContentLoaded", () => {
  // ==========================================================================
  // Общие проверки — вынесены в начало для использования во всех модулях
  // ==========================================================================
  const isFinePointer = window.matchMedia("(pointer: fine)").matches;

  // БАГ #6 ИСПРАВЛЕН: prefersReducedMotion вынесен в общую область видимости
  // и используется и в курсоре, и в marquee
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  // ==========================================================================
  // 🌐 1. ПЕРЕКЛЮЧАТЕЛЬ ЯЗЫКА
  // ==========================================================================
  const btnRu = document.getElementById("btn-ru");
  const btnEn = document.getElementById("btn-en");

  // Селекторы, в которые вставляется HTML (а не textContent)
  const HTML_SELECTORS = [".manifesto-big-text"];

  function getLang() {
    try {
      return localStorage.getItem("lang") || "ru";
    } catch {
      return "ru";
    }
  }
  function setLang(lang) {
    try {
      localStorage.setItem("lang", lang);
    } catch {}
  }

  function applyLang(lang) {
    (lang === "ru" ? btnRu : btnEn)?.classList.add("active");
    (lang === "ru" ? btnEn : btnRu)?.classList.remove("active");

    // Элементы с HTML-контентом (innerHTML)
    HTML_SELECTORS.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        const val = el.getAttribute("data-" + lang);
        if (val !== null) el.innerHTML = val;
      });
    });

    // Все остальные элементы — через textContent, кроме исключений
    const all = document.querySelectorAll("[data-ru][data-en]");
    all.forEach((el) => {
      if (HTML_SELECTORS.some((s) => el.matches(s))) return;
      if (el.closest(".hero-fx-frame")) return;
      if (el.id === "hero-marquee") return; // marquee рендерится отдельно
      const val = el.getAttribute("data-" + lang);
      if (val !== null) el.textContent = val;
    });

    // БАГ #5 ИСПРАВЛЕН: после смены языка перезапускаем word-reveal для hero-title,
    // потому что applyLang заменяет innerHTML, уничтожая span-обёртки
    const heroTitle = document.querySelector(".hero-title");
    if (heroTitle) {
      const val = heroTitle.getAttribute("data-" + lang);
      if (val !== null) {
        // Восстанавливаем исходный текст с переносами строк через <br>
        // data-атрибут содержит чистый текст с точками — разбиваем на строки вручную
        // Используем специальный разделитель — точку с запятой или просто пробел
        // Фактически восстанавливаем разбивку на слова и перезапускаем reveal
        heroTitle.innerHTML = val;
        initHeroReveal();
      }
    }

    if (window._fillMarquee) window._fillMarquee(lang);

    // Обновляем data-label у featured карточки для ::before псевдоэлемента
    document
      .querySelectorAll("[data-label-ru][data-label-en]")
      .forEach((el) => {
        el.setAttribute(
          "data-label",
          el.getAttribute("data-label-" + lang) || "",
        );
      });

    setLang(lang);
  }

  function switchLanguage(lang, animate) {
    if (!animate) {
      applyLang(lang);
      return;
    }
    const animEls = Array.from(
      document.querySelectorAll("[data-ru][data-en]"),
    ).filter((el) => !el.closest(".hero-fx-frame"));

    animEls.forEach((el) => {
      el.style.transition = "opacity .18s ease";
      el.style.opacity = "0";
    });
    setTimeout(() => {
      applyLang(lang);
      animEls.forEach((el) => {
        el.style.opacity = "1";
        setTimeout(() => {
          el.style.transition = "";
        }, 280);
      });
    }, 190);
  }

  btnRu?.addEventListener("click", () => switchLanguage("ru", true));
  btnEn?.addEventListener("click", () => switchLanguage("en", true));

  const initLang = getLang();

  // ==========================================================================
  // 🎞 2. БЕГУЩАЯ СТРОКА
  // ==========================================================================
  const marqueeEl = document.getElementById("hero-marquee");

  if (marqueeEl) {
    const marqueeRU = marqueeEl.getAttribute("data-ru") || "";
    const marqueeEN = marqueeEl.getAttribute("data-en") || marqueeRU;

    const marqueeInner = document.createElement("span");
    marqueeInner.className = "hero-marquee__inner";
    marqueeEl.innerHTML = "";
    marqueeEl.appendChild(marqueeInner);

    function fillMarquee(lang) {
      const text = lang === "en" ? marqueeEN : marqueeRU;
      const sep = "\u00a0\u00a0//\u00a0\u00a0";
      marqueeInner.innerHTML = (text + sep).repeat(8);
    }
    window._fillMarquee = fillMarquee;
    fillMarquee(initLang);

    let pos = 0,
      paused = false;
    marqueeEl.addEventListener("mouseenter", () => (paused = true));
    marqueeEl.addEventListener("mouseleave", () => (paused = false));

    // БАГ #6 ИСПРАВЛЕН: marquee не анимируется при prefers-reduced-motion
    (function tick() {
      if (!prefersReducedMotion && !paused && marqueeInner.scrollWidth > 0) {
        pos -= 0.45;
        if (Math.abs(pos) >= marqueeInner.scrollWidth / 2) pos = 0;
        marqueeInner.style.transform = `translateX(${pos}px)`;
      }
      requestAnimationFrame(tick);
    })();
  }

  // ==========================================================================
  // 🖱 3. КАСТОМНЫЙ КУРСОР — системная стрелка + затухающий след (canvas)
  // ==========================================================================
  const trailCanvas = document.getElementById("cursor-trail");

  if (trailCanvas && isFinePointer && !prefersReducedMotion) {
    const ctx = trailCanvas.getContext("2d");
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resizeCanvas() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      trailCanvas.width = window.innerWidth * dpr;
      trailCanvas.height = window.innerHeight * dpr;
      trailCanvas.style.width = window.innerWidth + "px";
      trailCanvas.style.height = window.innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const accentColor =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--color-accent")
        .trim() || "#78594f";

    let points = [];
    let lastX = null,
      lastY = null;
    const MAX_LIFE = 26;
    const MAX_POINTS = 40;

    document.addEventListener("mousemove", (e) => {
      const x = e.clientX;
      const y = e.clientY;

      if (lastX !== null) {
        const dist = Math.hypot(x - lastX, y - lastY);
        const steps = Math.min(Math.ceil(dist / 6), 8);
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          points.push({
            x: lastX + (x - lastX) * t,
            y: lastY + (y - lastY) * t,
            life: MAX_LIFE,
          });
        }
      } else {
        points.push({ x, y, life: MAX_LIFE });
      }

      if (points.length > MAX_POINTS) {
        points.splice(0, points.length - MAX_POINTS);
      }

      lastX = x;
      lastY = y;
    });

    document.addEventListener("mouseleave", () => {
      lastX = null;
      lastY = null;
    });

    function drawTrail() {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      points.forEach((p) => (p.life -= 1));
      points = points.filter((p) => p.life > 0);

      if (points.length > 1) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        for (let i = 1; i < points.length; i++) {
          const p0 = points[i - 1];
          const p1 = points[i];
          const lifeRatio = p1.life / MAX_LIFE;

          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.strokeStyle = accentColor;
          ctx.globalAlpha = lifeRatio * 0.5;
          ctx.lineWidth = lifeRatio * 3.5 + 0.4;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      requestAnimationFrame(drawTrail);
    }
    requestAnimationFrame(drawTrail);
  } else if (trailCanvas) {
    trailCanvas.style.display = "none";
  }

  // ==========================================================================
  // ✨ 4. HERO TITLE — Word Reveal
  // БАГ #5 ИСПРАВЛЕН: функция вынесена наружу, вызывается и при смене языка
  // ==========================================================================
  function initHeroReveal() {
    const heroTitle = document.querySelector(".hero-title");
    if (!heroTitle) return;

    // Убираем старые классы перед повторным запуском
    heroTitle.classList.remove("revealed");

    const raw = heroTitle.innerHTML;
    // Разбиваем по <br> — обрабатываем вариант и с тегами, и с чистым текстом
    const lines = raw.split(/<br\s*\/?>/i);

    heroTitle.innerHTML = lines
      .map((line) =>
        line
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .map(
            (w) =>
              `<span class="word-wrap"><span class="word">${w}</span></span>`,
          )
          .join(" "),
      )
      .join("<br>");

    requestAnimationFrame(() => {
      setTimeout(() => {
        heroTitle.classList.add("revealed");
        document.querySelector(".hero-lead")?.classList.add("revealed");
        document.querySelector(".hero-trust")?.classList.add("revealed");
        document.querySelector(".hero-actions")?.classList.add("revealed");
      }, 80);
    });
  }

  // БАГ #2 ИСПРАВЛЕН: applyLang вызывается ПОСЛЕ инициализации всех модулей,
  // в том числе marquee и initHeroReveal. Так _fillMarquee гарантированно назначена.
  setTimeout(() => {
    initHeroReveal();
    applyLang(initLang);
  }, 0);

  // ==========================================================================
  // 📐 5. FAQ
  // ==========================================================================
  document.querySelectorAll(".faq-trigger-modern").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const item = trigger.parentElement;
      const panel = trigger.nextElementSibling;
      const isOpen = item.classList.contains("active");

      document.querySelectorAll(".faq-item-modern.active").forEach((o) => {
        o.classList.remove("active");
        o.querySelector(".faq-panel-modern").style.maxHeight = null;
        o.querySelector(".faq-trigger-modern").setAttribute(
          "aria-expanded",
          "false",
        );
      });

      if (!isOpen) {
        item.classList.add("active");
        panel.style.maxHeight = panel.scrollHeight + "px";
        trigger.setAttribute("aria-expanded", "true");
      }
    });
  });

  // ==========================================================================
  // 🖼 6. PHOTO PARALLAX (mouse)
  // ==========================================================================
  const photoBox = document.getElementById("hero-photo-box");
  if (photoBox && isFinePointer && !prefersReducedMotion) {
    let tx = 0,
      ty = 0,
      cx = 0,
      cy = 0;

    document.addEventListener("mousemove", (e) => {
      tx = ((e.clientX - innerWidth / 2) / (innerWidth / 2)) * 12;
      ty = ((e.clientY - innerHeight / 2) / (innerHeight / 2)) * 10;
    });

    (function anim() {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      photoBox.style.transform = `translate(${cx}px, ${cy}px)`;
      requestAnimationFrame(anim);
    })();
  }

  // ==========================================================================
  // 🧲 7. MAGNETIC BUTTONS
  // БАГ #7 ИСПРАВЛЕН: магнитный эффект применяется только после reveal
  // ==========================================================================
  if (isFinePointer) {
    document.querySelectorAll(".magnetic").forEach((btn) => {
      let leaveTimer = null;

      btn.addEventListener("mousemove", (e) => {
        // Не применяем эффект, пока hero-actions ещё не проявился
        const actions = btn.closest(".hero-actions");
        if (actions && !actions.classList.contains("revealed")) return;

        if (leaveTimer) {
          clearTimeout(leaveTimer);
          leaveTimer = null;
          btn.style.transition = "";
        }
        const r = btn.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) * 0.28;
        const dy = (e.clientY - (r.top + r.height / 2)) * 0.28;
        btn.style.transform = `translate(${dx}px,${dy}px)`;
      });

      btn.addEventListener("mouseleave", () => {
        btn.style.transition = "transform .5s cubic-bezier(.16,1,.3,1)";
        btn.style.transform = "";
        leaveTimer = setTimeout(() => {
          btn.style.transition = "";
          leaveTimer = null;
        }, 500);
      });
    });
  }

  // ==========================================================================
  // 🎬 8. SCROLL ANIMATIONS — один IntersectionObserver
  // ==========================================================================
  const ANIM_SELS = [
    ".section-num",
    ".service-strip",
    ".p-strip",
    ".portfolio-poster",
    ".faq-item-modern",
    ".manifesto-big-text",
    ".manifesto-right",
  ];

  ANIM_SELS.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el, i) => {
      el.classList.add("anim-up");
      const cls = ["", "d1", "d2", "d3", "d4"][Math.min(i % 5, 4)];
      if (cls) el.classList.add(cls);
    });
  });

  const scrollObs = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in-view");
          obs.unobserve(e.target);
        }
      });
    },
    { threshold: 0.08 },
  );

  document.querySelectorAll(".anim-up").forEach((el) => scrollObs.observe(el));

  // ==========================================================================
  // 📌 9. ЛИПКИЙ ХЕДЕР
  // ==========================================================================
  const header = document.querySelector(".header");
  if (header) {
    window.addEventListener(
      "scroll",
      () => {
        header.classList.toggle("is-sticky", scrollY > 60);
      },
      { passive: true },
    );
  }

  // ==========================================================================
  // 🍔 10. БУРГЕР
  // ==========================================================================
  const burgerBtn = document.getElementById("burger-btn");
  const mobileMenu = document.getElementById("mobile-menu");

  if (burgerBtn && mobileMenu) {
    function toggleMenu(force) {
      const open =
        force !== undefined ? force : !burgerBtn.classList.contains("open");
      burgerBtn.classList.toggle("open", open);
      burgerBtn.setAttribute("aria-expanded", String(open));
      mobileMenu.classList.toggle("open", open);
      mobileMenu.setAttribute("aria-hidden", String(!open));
      document.body.style.overflow = open ? "hidden" : "";
    }
    burgerBtn.addEventListener("click", () => toggleMenu());
    mobileMenu
      .querySelectorAll("a")
      .forEach((a) => a.addEventListener("click", () => toggleMenu(false)));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") toggleMenu(false);
    });
  }

  // ==========================================================================
  // ⬆ 11. КНОПКА НАВЕРХ
  // БАГ #1 ИСПРАВЛЕН: кнопка теперь в HTML — JS только управляет видимостью
  // ==========================================================================
  const topBtn = document.getElementById("top-btn");
  if (topBtn) {
    window.addEventListener(
      "scroll",
      () => topBtn.classList.toggle("visible", scrollY > 450),
      { passive: true },
    );
    topBtn.addEventListener("click", () =>
      scrollTo({ top: 0, behavior: "smooth" }),
    );
  }

  // ==========================================================================
  // 🔢 12. СЧЁТЧИКИ
  // ==========================================================================
  document.querySelectorAll("[data-counter]").forEach((el) => {
    const target = parseInt(el.getAttribute("data-counter"), 10);
    const suffix = el.getAttribute("data-suffix") || "";
    const duration = 1600;

    new IntersectionObserver(
      (entries, obs) => {
        if (!entries[0].isIntersecting) return;
        obs.disconnect();
        const t0 = performance.now();
        (function upd(now) {
          const p = Math.min((now - t0) / duration, 1);
          el.textContent =
            Math.round((1 - Math.pow(1 - p, 3)) * target) + suffix;
          if (p < 1) requestAnimationFrame(upd);
        })(t0);
      },
      { threshold: 0.5 },
    ).observe(el);
  });

  // ==========================================================================
  // 📅 13. АВТОГОД
  // ==========================================================================
  const yr = document.getElementById("footer-year");
  if (yr) yr.textContent = new Date().getFullYear();

  // ==========================================================================
  // ✦ 14. SERVICE IDX — hover цвет
  // ==========================================================================
  document.querySelectorAll(".service-strip").forEach((strip) => {
    const idx = strip.querySelector(".service-idx");
    if (!idx) return;
    strip.addEventListener(
      "mouseenter",
      () => (idx.style.color = "var(--color-accent)"),
    );
    strip.addEventListener("mouseleave", () => (idx.style.color = ""));
  });
});
