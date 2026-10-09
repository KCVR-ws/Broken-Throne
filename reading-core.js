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
    paragraph: "space"
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
    return {
      theme: themes.includes(value.theme) ? value.theme : defaults.theme,
      font: fonts.includes(value.font) ? value.font : defaults.font,
      size: clamp(value.size, 80, 160, defaults.size),
      line: clamp(value.line, 1.4, 2.8, defaults.line),
      width: clamp(value.width, 480, 960, defaults.width),
      align: value.align === "justify" ? "justify" : "right",
      paragraph: value.paragraph === "indent" ? "indent" : "space"
    };
  }

  function readState() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "{}");

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
})();
