"use strict";

(() => {
  const KEY = "broken-throne-reader-v1";

  const defaults = {
    theme: "dark",
    font: "modern",
    size: 100,
    line: 2,
    width: 760,
    align: "right",
    paragraph: "space",
    gap: 1.4,
    weight: 400,
    numbers: "show",
    bar: "show",
    ornament: "show"
  };

  const themes = ["dark", "light", "sepia"];
  const fonts = ["modern", "naskh", "kufi"];

  function clamp(value, min, max, fallback) {
    const number = Number(value);

    return Number.isFinite(number)
      ? Math.min(max, Math.max(min, number))
      : fallback;
  }

  function sanitizeSettings(value = {}) {
    if (!value || typeof value !== "object") value = {};

    return {
      theme: themes.includes(value.theme) ? value.theme : defaults.theme,
      font: fonts.includes(value.font) ? value.font : defaults.font,
      size: clamp(value.size, 80, 160, defaults.size),
      line: clamp(value.line, 1.4, 2.8, defaults.line),
      width: clamp(value.width, 480, 960, defaults.width),
      align: value.align === "justify" ? "justify" : "right",
      paragraph: value.paragraph === "indent" ? "indent" : "space",
      gap: clamp(value.gap ?? defaults.gap, 0.5, 2.5, defaults.gap),
      weight: [400, 600, 700].includes(Number(value.weight))
        ? Number(value.weight)
        : 400,
      numbers: value.numbers === "hide" ? "hide" : "show",
      bar: value.bar === "hide" ? "hide" : "show",
      ornament: value.ornament === "hide" ? "hide" : "show"
    };
  }

  function readState() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "{}") || {};

      return {
        settings: sanitizeSettings(saved.settings),
        chapters:
          saved.chapters && typeof saved.chapters === "object"
            ? saved.chapters
            : {},
        lastId: typeof saved.lastId === "string" ? saved.lastId : null
      };
    } catch {
      return {
        settings: { ...defaults },
        chapters: {},
        lastId: null
      };
    }
  }

  let state = readState();

  function applySettings() {
    const s = state.settings;
    const root = document.documentElement;

    root.dataset.readTheme = s.theme;
    root.dataset.readFont = s.font;
    root.dataset.paragraph = s.paragraph;
    root.dataset.numbers = s.numbers;
    root.dataset.bar = s.bar;
    root.dataset.ornament = s.ornament;

    root.style.setProperty("--reading-scale", s.size / 100);
    root.style.setProperty("--paragraph-gap", `${s.gap}em`);
    root.style.setProperty("--reading-weight", s.weight);
    root.style.setProperty("--reading-size", `${s.size}%`);
    root.style.setProperty("--reading-line", s.line);
    root.style.setProperty("--reading-width", `${s.width}px`);
    root.style.setProperty("--reading-align", s.align);
  }

  function commit() {
    let saved = true;

    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      saved = false;
    }

    applySettings();

    window.dispatchEvent(
      new CustomEvent("bt:change", { detail: { saved } })
    );

    if (!saved && !document.getElementById("storage-warning")) {
      const warning = document.createElement("p");

      warning.id = "storage-warning";
      warning.className = "storage-warning";
      warning.setAttribute("role", "status");
      warning.textContent =
        "تعذّر الحفظ الدائم في هذا المتصفح. تغييراتك متاحة خلال هذه الصفحة فقط.";

      document.body.appendChild(warning);
    }
  }

  function chapter(id) {
    const item = state.chapters[id] || {};

    return {
      status: ["unread", "reading", "read"].includes(item.status)
        ? item.status
        : "unread",
      progress: clamp(item.progress, 0, 1, 0),
      paragraph: typeof item.paragraph === "string" ? item.paragraph : "",
      bookmarks: Array.isArray(item.bookmarks) ? item.bookmarks : [],
      words: clamp(item.words, 0, 1000000, 0)
    };
  }

  function updateChapter(id, changes, setLast = false) {
    state.chapters[id] = { ...chapter(id), ...changes };

    if (setLast) {
      state.lastId = id;
    }

    commit();
  }

  window.BT = {
    defaults,

    get settings() {
      return { ...state.settings };
    },

    get lastId() {
      return state.lastId;
    },

    chapter,

    changeSettings(changes) {
      state.settings = sanitizeSettings({
        ...state.settings,
        ...changes
      });

      commit();
    },

    resetSettings() {
      state.settings = { ...defaults };
      commit();
    },

    savePosition(id, progress, paragraph) {
      const old = chapter(id);

      updateChapter(
        id,
        {
          progress,
          paragraph,
          status:
            old.status === "read" || progress >= 0.98
              ? "read"
              : "reading"
        },
        true
      );
    },

    setWords(id, words) {
      if (chapter(id).words !== words) {
        updateChapter(id, { words });
      }
    },

    markRead(id, read) {
      updateChapter(id, {
        status: read ? "read" : "unread",
        progress: read ? 1 : 0,
        paragraph: ""
      });
    },

    markAll(ids) {
      ids.forEach((id) => {
        state.chapters[id] = {
          ...chapter(id),
          status: "read",
          progress: 1
        };
      });

      commit();
    },

    resetProgress(ids) {
      ids.forEach((id) => {
        state.chapters[id] = {
          ...chapter(id),
          status: "unread",
          progress: 0,
          paragraph: ""
        };
      });

      if (ids.includes(state.lastId)) {
        state.lastId = null;
      }

      commit();
    },

    toggleBookmark(id, paragraph) {
      const old = chapter(id);
      const exists = old.bookmarks.includes(paragraph);

      updateChapter(id, {
        bookmarks: exists
          ? old.bookmarks.filter((item) => item !== paragraph)
          : [...old.bookmarks, paragraph]
      });
    }
  };

  window.addEventListener("storage", (event) => {
    if (event.key === KEY || event.key === null) {
      state = readState();
      applySettings();
      window.dispatchEvent(new CustomEvent("bt:change"));
    }
  });

  applySettings();
  installReaderPanel();

  function installReaderPanel() {
    const host = document.querySelector(".reader-tools");
    if (!host) return;

    host.innerHTML = `
      <button
        id="open-reader-settings"
        class="bt-button reader-gear"
        type="button"
        aria-label="إعدادات القراءة"
        aria-haspopup="dialog"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M19.39 8.94 L19.83 10.34 L21.85 10.26 L21.85 13.74 L19.83 13.66 L19.39 15.06 L18.71 16.36 L20.19 17.74 L17.74 20.19 L16.36 18.71 L15.06 19.39 L13.66 19.83 L13.74 21.85 L10.26 21.85 L10.34 19.83 L8.94 19.39 L7.64 18.71 L6.26 20.19 L3.81 17.74 L5.29 16.36 L4.61 15.06 L4.17 13.66 L2.15 13.74 L2.15 10.26 L4.17 10.34 L4.61 8.94 L5.29 7.64 L3.81 6.26 L6.26 3.81 L7.64 5.29 L8.94 4.61 L10.34 4.17 L10.26 2.15 L13.74 2.15 L13.66 4.17 L15.06 4.61 L16.36 5.29 L17.74 3.81 L20.19 6.26 L18.71 7.64 Z"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linejoin="round"
          />
          <circle
            cx="12"
            cy="12"
            r="3.2"
            stroke="currentColor"
            stroke-width="1.5"
          />
        </svg>
        <span>إعدادات القراءة</span>
      </button>
    `;

    const dialog = document.createElement("dialog");
    dialog.className = "reader-dialog";
    dialog.setAttribute("aria-labelledby", "reader-settings-title");

    dialog.innerHTML = `
      <header class="settings-heading">
        <div>
          <p class="settings-kicker" lang="en">READING EXPERIENCE</p>
          <h2 id="reader-settings-title">على راحتك</h2>
          <p class="bt-muted">خصّص الصفحة لتناسب قراءتك.</p>
        </div>

        <button
          type="button"
          class="bt-button settings-close"
          aria-label="إغلاق الإعدادات"
          autofocus
        >×</button>
      </header>

      <div class="settings-preview" aria-label="معاينة الخط">
        <span>معاينة مباشرة</span>
        <p>كان للعرش هيبة، قبل أن ينكسر.</p>
      </div>

      <section class="settings-section">
        <h3>المظهر والخط</h3>

        <div class="settings-fields">
          <label>
            لون الصفحة
            <select data-setting="theme">
              <option value="dark">داكن</option>
              <option value="light">فاتح</option>
              <option value="sepia">ورقي</option>
            </select>
          </label>

          <label>
            نوع الخط
            <select data-setting="font" dir="ltr" lang="en">
              <option value="modern">Cairo</option>
              <option value="naskh">Amiri</option>
              <option value="kufi">Noto Kufi Arabic</option>
            </select>
          </label>

          <label>
            سماكة النص
            <select data-setting="weight">
              <option value="400">عادي</option>
              <option value="600">متوسط</option>
              <option value="700">عريض</option>
            </select>
          </label>

          <div class="size-field">
            <span>حجم الخط</span>
            <div class="font-size-control" dir="ltr">
              <button
                id="font-decrease"
                class="bt-button"
                type="button"
                aria-label="تصغير الخط"
              >−</button>

              <output id="font-percentage" aria-live="polite">100%</output>

              <button
                id="font-increase"
                class="bt-button"
                type="button"
                aria-label="تكبير الخط"
              >+</button>
            </div>
          </div>
        </div>
      </section>

      <section class="settings-section">
        <h3>مساحة القراءة</h3>

        <div class="settings-fields">
          <label>
            تباعد الأسطر
            <output data-value="line"></output>
            <input
              aria-label="تباعد الأسطر"
              data-setting="line"
              type="range"
              min="1.4"
              max="2.8"
              step="0.1"
            >
          </label>

          <label>
            عرض النص
            <output data-value="width"></output>
            <input
              aria-label="عرض النص"
              data-setting="width"
              type="range"
              min="480"
              max="960"
              step="40"
            >
          </label>

          <label>
            تباعد الفقرات
            <output data-value="gap"></output>
            <input
              aria-label="تباعد الفقرات"
              data-setting="gap"
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
            >
          </label>

          <label>
            محاذاة النص
            <select data-setting="align">
              <option value="right">يمين</option>
              <option value="justify">ضبط الطرفين</option>
            </select>
          </label>

          <label>
            نمط الفقرات
            <select data-setting="paragraph">
              <option value="space">فقرات متباعدة</option>
              <option value="indent">مسافة في بداية الفقرة</option>
            </select>
          </label>
        </div>
      </section>

      <section class="settings-section">
        <h3>تفاصيل الصفحة</h3>

        <div class="settings-fields">
          <label>
            أرقام الفقرات
            <select data-setting="numbers">
              <option value="show">إظهار</option>
              <option value="hide">إخفاء</option>
            </select>
          </label>

          <label>
            شريط تقدّم القراءة
            <select data-setting="bar">
              <option value="show">إظهار</option>
              <option value="hide">إخفاء</option>
            </select>
          </label>

          <label>
            زخرفة الخلفية
            <select data-setting="ornament">
              <option value="show">إظهار</option>
              <option value="hide">إخفاء</option>
            </select>
          </label>
        </div>
      </section>

      <footer class="settings-footer">
        <button
          id="focus-mode"
          class="bt-button bt-primary"
          type="button"
        >وضع التركيز</button>

        <button
          id="reset-settings"
          class="bt-button"
          type="button"
        >استعادة الافتراضي</button>

        <p class="bt-muted">
          تُحفظ اختياراتك تلقائيًا في هذا المتصفح.
        </p>
      </footer>
    `;

    document.body.appendChild(dialog);

    dialog.addEventListener("keydown", (event) => {
      event.stopPropagation();
    });

    const opener = document.getElementById("open-reader-settings");

    opener.addEventListener("click", () => {
      dialog.showModal();
    });

    dialog.querySelector(".settings-close").addEventListener("click", () => {
      dialog.close();
    });

    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;

      const box = dialog.getBoundingClientRect();

      if (
        event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom
      ) {
        dialog.close();
      }
    });

    document.getElementById("focus-mode").addEventListener("click", () => {
      dialog.close();
    });

    dialog.addEventListener("close", () => {
      const target = document.body.classList.contains("focus-mode")
        ? document.getElementById("exit-focus")
        : opener;

      target?.focus({ preventScroll: true });
    });

    document.getElementById("exit-focus")?.addEventListener("click", () => {
      queueMicrotask(() => opener.focus({ preventScroll: true }));
    });

    document.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        !dialog.open &&
        document.body.classList.contains("focus-mode")
      ) {
        event.preventDefault();
        document.getElementById("exit-focus").click();
      }
    });

    function syncPanel() {
      dialog.querySelectorAll("[data-value]").forEach((output) => {
        const key = output.dataset.value;
        output.value = state.settings[key] + (key === "width" ? " px" : "");
      });

      dialog.querySelector('[data-setting="gap"]').disabled =
        state.settings.paragraph === "indent";
    }

    window.addEventListener("bt:change", syncPanel);
    syncPanel();
  }
})();
