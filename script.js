document.addEventListener("DOMContentLoaded", () => {
  // ==========================================================================
  // Общие проверки
  // ==========================================================================
  const isFinePointer = window.matchMedia("(pointer: fine)").matches;
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const isMobileOS = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // ==========================================================================
  // 0. ЛОГОТИП — скролл наверх без прыжка на "#"
  // ==========================================================================
  document.querySelectorAll(".js-scrolltop").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  // ==========================================================================
  // 0.1 VIBER — на десктопе без приложения ссылка ничего не делает,
  // на десктопе уводим на tel:, чтобы клик не выглядел мёртвым
  // ==========================================================================
  if (!isMobileOS) {
    document.querySelectorAll('a[href^="viber://"]').forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = "tel:+375295784449";
      });
    });
  }

  // ==========================================================================
  // 1. ПЕРЕКЛЮЧАТЕЛЬ ЯЗЫКА
  // ==========================================================================
  const btnRu = document.getElementById("btn-ru");
  const btnEn = document.getElementById("btn-en");

  // Селекторы с HTML-контентом (innerHTML вместо textContent)
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
    const isRu = lang === "ru";
    btnRu?.classList.toggle("active", isRu);
    btnEn?.classList.toggle("active", !isRu);
    btnRu?.setAttribute("aria-pressed", String(isRu));
    btnEn?.setAttribute("aria-pressed", String(!isRu));

    document.documentElement.lang = lang;

    // Элементы с HTML-контентом (innerHTML)
    HTML_SELECTORS.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        const val = el.getAttribute("data-" + lang);
        if (val !== null) el.innerHTML = val;
      });
    });

    // Все остальные — через textContent
    document.querySelectorAll("[data-ru][data-en]").forEach((el) => {
      if (HTML_SELECTORS.some((s) => el.matches(s))) return;
      if (el.closest(".hero-fx-frame")) return;
      if (el.id === "hero-marquee") return;
      if (el.classList.contains("hero-title")) return;
      const val = el.getAttribute("data-" + lang);
      if (val !== null) el.textContent = val;
    });

    // hero-title — innerHTML + word-reveal
    const heroTitle = document.querySelector(".hero-title");
    if (heroTitle) {
      const val = heroTitle.getAttribute("data-" + lang);
      if (val !== null) {
        heroTitle.innerHTML = val;
        initHeroReveal();
      }
    }

    // Marquee
    if (window._fillMarquee) window._fillMarquee(lang);

    // data-label у featured карточки для ::before
    document
      .querySelectorAll("[data-label-ru][data-label-en]")
      .forEach((el) => {
        el.setAttribute(
          "data-label",
          el.getAttribute("data-label-" + lang) || "",
        );
      });

    // Подписи для скринридеров, alt и meta description
    document
      .querySelectorAll("[data-aria-ru][data-aria-en]")
      .forEach((el) =>
        el.setAttribute("aria-label", el.getAttribute("data-aria-" + lang)),
      );
    document
      .querySelectorAll("[data-alt-ru][data-alt-en]")
      .forEach((el) =>
        el.setAttribute("alt", el.getAttribute("data-alt-" + lang)),
      );
    const metaDesc = document.querySelector("meta[data-desc-ru][data-desc-en]");
    if (metaDesc) metaDesc.content = metaDesc.getAttribute("data-desc-" + lang);

    // FIX: пересчёт суффиксов счётчиков при смене языка
    // data-suffix-ru / data-suffix-en не попадают в общий цикл [data-ru][data-en]
    document.querySelectorAll("[data-counter]").forEach((el) => {
      const suffix =
        el.getAttribute("data-suffix-" + lang) ||
        el.getAttribute("data-suffix") ||
        "";
      const target = parseInt(el.getAttribute("data-counter"), 10);
      el.textContent = target + suffix;
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
  // 2. БЕГУЩАЯ СТРОКА
  // ==========================================================================
  const marqueeEl = document.getElementById("hero-marquee");

  if (marqueeEl) {
    const marqueeRU = marqueeEl.getAttribute("data-ru") || "";
    const marqueeEN = marqueeEl.getAttribute("data-en") || marqueeRU;

    const marqueeInner = document.createElement("span");
    marqueeInner.className = "hero-marquee__inner";
    marqueeEl.innerHTML = "";
    marqueeEl.appendChild(marqueeInner);

    // Ширину измеряем один раз (и при resize / загрузке шрифтов), а не каждый кадр:
    // чтение scrollWidth сразу после записи transform вызывало принудительную компоновку.
    let halfWidth = 0;
    const measureMarquee = () => {
      halfWidth = marqueeInner.scrollWidth / 2;
    };
    // ResizeObserver вызывает измерение уже ПОСЛЕ раскладки браузера: никакой принудительной
    // компоновки при старте (раньше первое чтение scrollWidth заставляло считать всю страницу).
    if ("ResizeObserver" in window) {
      new ResizeObserver(measureMarquee).observe(marqueeInner);
    } else {
      requestAnimationFrame(measureMarquee);
    }

    function fillMarquee(lang) {
      const text = lang === "en" ? marqueeEN : marqueeRU;
      const sep = "\u00a0\u00a0//\u00a0\u00a0";
      marqueeInner.innerHTML = (text + sep).repeat(8);
    }
    window._fillMarquee = fillMarquee;
    fillMarquee(initLang);

    let pos = 0;
    let paused = false;
    let tabVisible = !document.hidden;

    marqueeEl.addEventListener("mouseenter", () => (paused = true));
    marqueeEl.addEventListener("mouseleave", () => (paused = false));
    document.addEventListener("visibilitychange", () => {
      tabVisible = !document.hidden;
    });

    (function tick() {
      if (
        !prefersReducedMotion &&
        !paused &&
        tabVisible &&
        halfWidth > 0
      ) {
        pos -= 0.45;
        if (Math.abs(pos) >= halfWidth) pos = 0;
        marqueeInner.style.transform = `translateX(${pos}px)`;
      }
      requestAnimationFrame(tick);
    })();
  }

  // ==========================================================================
  // 3. КАСТОМНЫЙ КУРСОР — canvas-след
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
      if (points.length > MAX_POINTS)
        points.splice(0, points.length - MAX_POINTS);
      lastX = x;
      lastY = y;
    });

    document.addEventListener("mouseleave", () => {
      lastX = null;
      lastY = null;
    });

    function drawTrail() {
      if (document.hidden) {
        requestAnimationFrame(drawTrail);
        return;
      }
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
  // 4. HERO TITLE — Word Reveal
  // ==========================================================================
  function initHeroReveal() {
    const heroTitle = document.querySelector(".hero-title");
    if (!heroTitle) return;

    heroTitle.classList.remove("revealed");

    const raw = heroTitle.innerHTML;
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

  setTimeout(() => {
    applyLang(initLang);
  }, 0);

  // ==========================================================================
  // 5. FAQ
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
  // 6. PHOTO PARALLAX (mouse)
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
  // 7. MAGNETIC BUTTONS
  // ==========================================================================
  if (isFinePointer) {
    document.querySelectorAll(".magnetic").forEach((btn) => {
      let leaveTimer = null;

      btn.addEventListener("mousemove", (e) => {
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
  // 8. SCROLL ANIMATIONS — IntersectionObserver
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
          const el = e.target;
          el.classList.add("in-view");
          obs.unobserve(el);

          // .anim-up.in-view держит transform: translateY(0) и перебивает hover-подъём
          // карточек. Когда появление закончилось, снимаем служебные классы.
          const cleanup = () => {
            el.classList.remove("anim-up", "in-view", "d1", "d2", "d3", "d4");
            el.removeEventListener("transitionend", onEnd);
            clearTimeout(timer);
          };
          const onEnd = (ev) => {
            if (ev.target === el && ev.propertyName === "transform") cleanup();
          };
          const timer = setTimeout(cleanup, 1500); // запасной вариант без transitionend
          el.addEventListener("transitionend", onEnd);
        }
      });
    },
    { threshold: 0.08 },
  );
  document.querySelectorAll(".anim-up").forEach((el) => scrollObs.observe(el));

  // ==========================================================================
  // 9. ЛИПКИЙ ХЕДЕР
  // ==========================================================================
  const header = document.querySelector(".header");
  if (header) {
    let ticking = false;
    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          requestAnimationFrame(() => {
            header.classList.toggle("is-sticky", scrollY > 60);
            ticking = false;
          });
          ticking = true;
        }
      },
      { passive: true },
    );
  }

  // ==========================================================================
  // 10. БУРГЕР
  // ==========================================================================
  const burgerBtn = document.getElementById("burger-btn");
  const mobileMenu = document.getElementById("mobile-menu");

  if (burgerBtn && mobileMenu) {
    function toggleMenu(force) {
      const wasOpen = burgerBtn.classList.contains("open");
      const open = force !== undefined ? force : !wasOpen;
      if (open === wasOpen) return; // Escape при закрытом меню ничего не делает
      burgerBtn.classList.toggle("open", open);
      burgerBtn.setAttribute("aria-expanded", String(open));
      mobileMenu.classList.toggle("open", open);
      document.body.style.overflow = open ? "hidden" : "";
      // role="dialog": переносим фокус внутрь и возвращаем на кнопку при закрытии
      if (open) mobileMenu.querySelector("a")?.focus();
      else burgerBtn.focus();
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
  // 11. КНОПКА НАВЕРХ
  // ==========================================================================
  const topBtn = document.getElementById("top-btn");
  if (topBtn) {
    let ticking = false;
    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          requestAnimationFrame(() => {
            topBtn.classList.toggle("visible", scrollY > 450);
            ticking = false;
          });
          ticking = true;
        }
      },
      { passive: true },
    );
    topBtn.addEventListener("click", () =>
      scrollTo({ top: 0, behavior: "smooth" }),
    );
  }

  // ==========================================================================
  // 12. СЧЁТЧИКИ
  // getSuffix() читает data-suffix-ru / data-suffix-en с учётом текущего языка
  // ==========================================================================
  document.querySelectorAll("[data-counter]").forEach((el) => {
    const target = parseInt(el.getAttribute("data-counter"), 10);
    const getSuffix = () => {
      const lang = getLang();
      return (
        el.getAttribute("data-suffix-" + lang) ||
        el.getAttribute("data-suffix") ||
        ""
      );
    };
    const duration = 1600;

    new IntersectionObserver(
      (entries, obs) => {
        if (!entries[0].isIntersecting) return;
        obs.disconnect();
        const t0 = performance.now();
        (function upd(now) {
          const p = Math.min((now - t0) / duration, 1);
          el.textContent =
            Math.round((1 - Math.pow(1 - p, 3)) * target) + getSuffix();
          if (p < 1) requestAnimationFrame(upd);
        })(t0);
      },
      { threshold: 0.5 },
    ).observe(el);
  });

  // ==========================================================================
  // 13. АВТОГОД
  // FIX: год устанавливается отдельно в #footer-year,
  //      независимо от смены языка в .footer-copy
  // ==========================================================================

  const yr = document.getElementById("footer-year");
  if (yr) yr.textContent = new Date().getFullYear();

  // ==========================================================================
  // 14. SERVICE IDX — hover цвет
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

// ==========================================================================
// ПЛАВНОЕ РАСКРЫТИЕ «ТЕХНИЧЕСКИХ ДЕТАЛЕЙ» В КАРТОЧКАХ ПРОЕКТОВ
// <details> по умолчанию открывается мгновенно — анимируем высоту сами.
// ==========================================================================
(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const DURATION = 380;
  const EASING = "cubic-bezier(0.22, 0.61, 0.36, 1)";

  const init = () => {
    document.querySelectorAll(".poster-details").forEach((details) => {
      const summary = details.querySelector("summary");
      if (!summary || !details.animate) return;

      let animation = null;

      const run = (from, to, onDone) => {
        if (animation) animation.cancel();
        details.style.overflow = "hidden";
        animation = details.animate(
          { height: [from + "px", to + "px"] },
          { duration: DURATION, easing: EASING },
        );
        animation.onfinish = () => {
          details.style.overflow = "";
          animation = null;
          if (onDone) onDone();
        };
        animation.oncancel = () => {
          details.style.overflow = "";
        };
      };

      // высота закрытого блока = summary + рамки
      const collapsedHeight = () =>
        summary.offsetHeight + (details.offsetHeight - details.clientHeight);

      summary.addEventListener("click", (e) => {
        if (reduceMotion.matches) return; // без анимации — стандартное поведение
        e.preventDefault();

        if (details.open) {
          run(details.offsetHeight, collapsedHeight(), () => {
            details.open = false;
          });
        } else {
          const from = details.offsetHeight;
          details.open = true;
          run(from, details.offsetHeight);
        }
      });
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

// ==========================================================================
// ФОНОВАЯ ДОГРУЗКА КАРТИНОК ПРОЕКТОВ
// loading="lazy" ускоряет первый экран, но картинки карточек начинают качаться
// только рядом с экраном и «выскакивают» уже после появления карточки.
// Когда страница загружена и браузер свободен, докачиваем их заранее.
// ==========================================================================
window.addEventListener("load", () => {
  // в режиме экономии трафика и на медленной сети ничего не форсируем
  const conn = navigator.connection;
  if (conn && (conn.saveData || (conn.effectiveType && conn.effectiveType !== "4g"))) {
    return;
  }

  const preload = () => {
    document
      .querySelectorAll('#portfolio img[loading="lazy"]')
      .forEach((img) => {
        img.loading = "eager";
      });
  };

  if ("requestIdleCallback" in window) {
    requestIdleCallback(preload, { timeout: 2500 });
  } else {
    setTimeout(preload, 1200);
  }
});

// ==========================================================================
// БРИФ: проверка полей, прогресс заполнения, отправка на сервер
// ==========================================================================
(() => {
  const form = document.getElementById("brief-form");
  if (!form) return;

  const ENDPOINT = form.getAttribute("action") || "brief-handler.php";
  const isEn = () => document.documentElement.lang === "en";
  const t = (ru, en) => (isEn() ? en : ru);

  const statusEl = document.getElementById("brief-status");
  const doneEl = document.getElementById("brief-done");
  const barEl = document.getElementById("brief-progress-bar");
  const barText = document.getElementById("brief-progress-text");
  const submitBtn = form.querySelector('button[type="submit"]');

  const MESSAGES = {
    required: ["Это поле обязательно", "This field is required"],
    type: ["Выберите тип сайта", "Choose a website type"],
    contact: [
      "Укажите Telegram (@ник), телефон или email",
      "Enter a Telegram @username, phone number or email",
    ],
    consent: [
      "Нужно согласие на обработку персональных данных",
      "Consent to personal data processing is required",
    ],
  };

  // ---- подсказки в полях на двух языках
  const setPlaceholders = () =>
    form.querySelectorAll("[data-ph-ru]").forEach((el) => {
      el.placeholder = isEn() ? el.dataset.phEn : el.dataset.phRu;
    });

  // ---- ошибки
  const errorBox = (id) => document.getElementById(id + "-error");
  const showError = (id, key, control) => {
    const box = errorBox(id);
    if (box) box.textContent = t(...MESSAGES[key]);
    if (control) control.setAttribute("aria-invalid", "true");
    if (box) box.dataset.key = key;
  };
  const clearError = (id, control) => {
    const box = errorBox(id);
    if (box) {
      box.textContent = "";
      delete box.dataset.key;
    }
    if (control) control.removeAttribute("aria-invalid");
  };
  const refreshErrors = () =>
    form.querySelectorAll(".brief__error[data-key]").forEach((box) => {
      box.textContent = t(...MESSAGES[box.dataset.key]);
    });

  const validContact = (value) => {
    const v = value.trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return true; // email
    if (/^[+\d\s().-]+$/.test(v) && v.replace(/\D/g, "").length >= 7) return true; // телефон
    return /^(@|https?:\/\/t\.me\/)?[A-Za-z][A-Za-z0-9_]{4,31}$/.test(v); // Telegram
  };

  const validate = () => {
    let firstBad = null;
    const fail = (id, key, control, focusTarget) => {
      showError(id, key, control);
      if (!firstBad) firstBad = focusTarget || control;
    };

    // тип сайта
    const typeChecked = form.querySelector('input[name="type"]:checked');
    clearError("type");
    if (!typeChecked) {
      fail("type", "type", null, form.querySelector('input[name="type"]'));
    }

    // обязательные текстовые поля
    ["niche", "name"].forEach((id) => {
      const el = form.elements[id];
      clearError(id, el);
      if (!el.value.trim()) fail(id, "required", el);
    });

    // контакт
    const contact = form.elements.contact;
    clearError("contact", contact);
    if (!contact.value.trim()) fail("contact", "required", contact);
    else if (!validContact(contact.value)) fail("contact", "contact", contact);

    // согласие
    const consent = form.elements.consent;
    clearError("consent", consent);
    if (!consent.checked) fail("consent", "consent", consent);

    if (firstBad) firstBad.focus();
    return !firstBad;
  };

  // ---- прогресс заполнения
  const TOTAL = 11;
  const answered = () => {
    const filled = (name) => !!form.elements[name] && !!String(form.elements[name].value || "").trim();
    const checked = (name) => !!form.querySelector(`input[name="${name}"]:checked`);
    return [
      checked("type"),
      filled("niche"),
      filled("info"),
      checked("actions[]"),
      checked("readiness"),
      checked("content"),
      checked("budget"),
      checked("deadline"),
      filled("source"),
      filled("name"),
      filled("contact"),
    ].filter(Boolean).length;
  };
  const updateProgress = () => {
    const n = answered();
    barEl.style.width = Math.round((n / TOTAL) * 100) + "%";
    barText.textContent = t(`Заполнено ${n} из ${TOTAL}`, `Filled ${n} of ${TOTAL}`);
  };

  const setStatus = (html, isError) => {
    statusEl.className = "brief__status" + (isError ? " brief__status--error" : "");
    statusEl.textContent = "";
    if (typeof html === "string") statusEl.textContent = html;
    else statusEl.append(...html);
  };

  const showFailure = () => {
    setStatus(
      t(
        "Не получилось отправить бриф. Ваши ответы остались в форме — попробуйте ещё раз чуть позже.",
        "The brief could not be sent. Your answers are still in the form — please try again a little later.",
      ),
      true,
    );
  };

  const showSuccess = () => {
    form.reset();
    updateProgress();
    form.hidden = true;
    document.querySelector(".brief__progress").hidden = true;
    doneEl.hidden = false;
    doneEl.focus();
  };

  // ---- события
  form.addEventListener("input", (e) => {
    const el = e.target;
    if (el.id && errorBox(el.id)) clearError(el.id, el);
    if (el.name === "type") clearError("type");
    updateProgress();
  });
  form.addEventListener("change", updateProgress);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const data = new FormData(form);
    data.set("lang", isEn() ? "en" : "ru");
    submitBtn.disabled = true;
    setStatus(t("Отправляю…", "Sending…"), false);

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" },
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result || !result.ok) {
        console.error("Бриф не отправлен. Ответ сервера:", response.status, result);
        throw new Error("send failed");
      }
      showSuccess();
    } catch (err) {
      showFailure();
    } finally {
      submitBtn.disabled = false;
    }
  });

  // смена языка: подсказки, сообщения об ошибках, счётчик
  new MutationObserver(() => {
    setPlaceholders();
    refreshErrors();
    updateProgress();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  setPlaceholders();
  updateProgress();
})();

// ==========================================================================
// ЗАЯВКА: короткая форма (имя, контакт, задача, бюджет)
// ==========================================================================
(() => {
  const form = document.getElementById("quick-form");
  if (!form) return;

  const ENDPOINT = form.getAttribute("action") || "brief-handler.php";
  const isEn = () => document.documentElement.lang === "en";
  const t = (ru, en) => (isEn() ? en : ru);

  const statusEl = document.getElementById("quick-status");
  const doneEl = document.getElementById("quick-done");
  const submitBtn = form.querySelector('button[type="submit"]');

  const MESSAGES = {
    required: ["Это поле обязательно", "This field is required"],
    contact: [
      "Укажите Telegram (@ник), телефон или email",
      "Enter a Telegram @username, phone number or email",
    ],
    consent: [
      "Нужно согласие на обработку персональных данных",
      "Consent to personal data processing is required",
    ],
  };

  const setPlaceholders = () =>
    form.querySelectorAll("[data-ph-ru]").forEach((el) => {
      el.placeholder = isEn() ? el.dataset.phEn : el.dataset.phRu;
    });

  const errorBox = (id) => document.getElementById(id + "-error");
  const showError = (id, key, control) => {
    const box = errorBox(id);
    box.textContent = t(...MESSAGES[key]);
    box.dataset.key = key;
    control.setAttribute("aria-invalid", "true");
  };
  const clearError = (id, control) => {
    const box = errorBox(id);
    if (box) {
      box.textContent = "";
      delete box.dataset.key;
    }
    if (control) control.removeAttribute("aria-invalid");
  };

  const validContact = (value) => {
    const v = value.trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return true;
    if (/^[+\d\s().-]+$/.test(v) && v.replace(/\D/g, "").length >= 7) return true;
    return /^(@|https?:\/\/t\.me\/)?[A-Za-z][A-Za-z0-9_]{4,31}$/.test(v);
  };

  const validate = () => {
    let firstBad = null;
    const fail = (id, key, control) => {
      showError(id, key, control);
      if (!firstBad) firstBad = control;
    };
    const name = form.elements.name;
    const contact = form.elements.contact;
    const task = form.elements.task;
    const consent = form.elements.consent;

    clearError("q-name", name);
    clearError("q-contact", contact);
    clearError("q-task", task);
    clearError("q-consent", consent);

    if (!name.value.trim()) fail("q-name", "required", name);
    if (!contact.value.trim()) fail("q-contact", "required", contact);
    else if (!validContact(contact.value)) fail("q-contact", "contact", contact);
    if (!task.value.trim()) fail("q-task", "required", task);
    if (!consent.checked) fail("q-consent", "consent", consent);

    if (firstBad) firstBad.focus();
    return !firstBad;
  };

  const setStatus = (content, isError) => {
    statusEl.className = "brief__status" + (isError ? " brief__status--error" : "");
    statusEl.textContent = "";
    if (typeof content === "string") statusEl.textContent = content;
    else statusEl.append(...content);
  };

  const showFailure = () => {
    setStatus(
      t(
        "Не получилось отправить заявку. Ваши ответы остались в форме — попробуйте ещё раз чуть позже.",
        "The request could not be sent. Your answers are still in the form — please try again a little later.",
      ),
      true,
    );
  };

  form.addEventListener("input", (e) => {
    const el = e.target;
    if (el.id && errorBox(el.id)) clearError(el.id, el);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const data = new FormData(form);
    data.set("lang", isEn() ? "en" : "ru");
    submitBtn.disabled = true;
    setStatus(t("Отправляю…", "Sending…"), false);

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" },
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result || !result.ok) {
        console.error("Заявка не отправлена. Ответ сервера:", response.status, result);
        throw new Error("send failed");
      }
      form.reset();
      setStatus("", false);
      form.hidden = true;
      doneEl.hidden = false;
      doneEl.focus();
    } catch (err) {
      showFailure();
    } finally {
      submitBtn.disabled = false;
    }
  });

  // после отправки можно описать проект подробнее
  document.getElementById("quick-more")?.addEventListener("click", () => {
    const more = document.getElementById("brief-more");
    if (!more) return;
    more.open = true;
    more.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  new MutationObserver(() => {
    setPlaceholders();
    form.querySelectorAll(".brief__error[data-key]").forEach((box) => {
      box.textContent = t(...MESSAGES[box.dataset.key]);
    });
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  setPlaceholders();
})();

// ==========================================================================
// ПРЯМЫЕ ССЫЛКИ: lenacode.by/#brief — короткая заявка, lenacode.by/#brief-more — подробный бриф
// ==========================================================================
(() => {
  const openFromHash = () => {
    if (location.hash !== "#brief-more") return;
    const more = document.getElementById("brief-more");
    if (!more) return;
    more.open = true;
    // даём странице дорисоваться и прокручиваем к блоку
    requestAnimationFrame(() => more.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  window.addEventListener("hashchange", openFromHash);
  openFromHash();
})();

// ==========================================================================
// ВАЛЮТА ЦЕН
// Основная валюта сайта — белорусский рубль (BYN). Посетителям из Беларуси и при любой
// неопределённости показываются только BYN. Если сервер (currency.php) определил, что
// посетитель из России или другой страны, цены показываются справочно в ₽ или $
// — пересчётом из BYN по курсу Нацбанка РБ. Курсы меняются здесь, в одном месте.
// ==========================================================================
(() => {
  const RATES = {
    date: "26.10.2026", // дата курса НБРБ
    RUB: 100 / 3.6597, // ₽ за 1 BYN (3,6597 BYN за 100 ₽)
    USD: 1 / 2.946, // $ за 1 BYN (2,946 BYN за 1 $)
  };
  const KNOWN = ["BYN", "RUB", "USD"];
  const isEn = () => document.documentElement.lang === "en";
  const note = document.getElementById("currency-note");
  let current = "BYN";

  const roundTo = (value, step) => Math.round(value / step) * step;
  const fmtNum = (n) => n.toLocaleString("ru-RU").replace(/\u00a0/g, " ");

  // «350–500 BYN», «от 2 500 BYN», «до 500 BYN», «от 50 BYN/ч» → в нужной валюте
  const convert = (text, cur = current) => {
    if (cur === "BYN" || !/BYN/.test(text)) return text;
    const hourly = /\/\s*(ч|hr)/i.test(text);
    let first = true;
    const out = text.replace(/\d[\d ]*\d|\d/g, (match) => {
      const byn = parseInt(match.replace(/\s/g, ""), 10);
      const step = cur === "RUB" ? (hourly ? 100 : 500) : hourly ? 1 : 5;
      const value = fmtNum(Math.max(step, roundTo(byn * RATES[cur], step)));
      const prefix = cur === "USD" && first ? "$" : "";
      first = false;
      return prefix + value;
    });
    return cur === "RUB" ? out.replace(/BYN/g, "₽") : out.replace(/\s?BYN/g, "");
  };

  // элементы с ценами: карточки услуг и варианты бюджета в формах
  const targets = [
    ...document.querySelectorAll('.price-tag, #q-budget option, input[name="budget"] + span'),
  ].filter((el) => el.dataset.ru && /BYN/.test(el.dataset.ru));
  targets.forEach((el) => {
    el.dataset.bynRu = el.dataset.ru;
    el.dataset.bynEn = el.dataset.en;
  });

  const renderNote = () => {
    if (!note) return;
    if (current === "BYN") {
      note.hidden = true;
      note.textContent = "";
      return;
    }
    const ru = current === "RUB" ? "российских рублях (₽)" : "долларах США ($)";
    const en = current === "RUB" ? "Russian rubles (₽)" : "US dollars ($)";
    note.textContent = isEn()
      ? `Prices are shown in ${en} as a reference conversion from Belarusian rubles at the National Bank of Belarus rate of ${RATES.date}. The exact amount and payment currency are agreed when we discuss the project.`
      : `Цены показаны в ${ru} как справочный пересчёт из белорусских рублей по курсу Нацбанка РБ на ${RATES.date}. Точная сумма и валюта оплаты согласовываются при обсуждении проекта.`;
    note.hidden = false;
  };

  const apply = (cur) => {
    current = cur;
    document.documentElement.dataset.currency = cur;
    targets.forEach((el) => {
      el.dataset.ru = convert(el.dataset.bynRu, cur);
      el.dataset.en = convert(el.dataset.bynEn, cur);
      el.textContent = isEn() ? el.dataset.en : el.dataset.ru;
    });
    renderNote();
    window.dispatchEvent(new CustomEvent("currencychange", { detail: { currency: cur } }));
  };

  window.SiteCurrency = {
    get current() {
      return current;
    },
    convert: (text) => convert(text),
  };

  new MutationObserver(renderNote).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang"],
  });

  // определяем страну на сервере; при любой ошибке остаются белорусские рубли
  let cached = null;
  try {
    cached = sessionStorage.getItem("siteCurrency");
  } catch (e) {
    /* приватный режим */
  }
  if (KNOWN.includes(cached)) {
    if (cached !== "BYN") apply(cached);
    return;
  }
  fetch("currency.php", { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      const cur = data && KNOWN.includes(data.currency) ? data.currency : "BYN";
      try {
        sessionStorage.setItem("siteCurrency", cur);
      } catch (e) {
        /* приватный режим */
      }
      if (cur !== "BYN") apply(cur);
    })
    .catch(() => {});
})();
