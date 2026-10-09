"use strict";

(() => {
  const chapterId = document.body.dataset.chapterId;
  const article = document.getElementById("chapter-text");
  const paragraphs = [...article.querySelectorAll("p[id]")];

  const chapter = BT_CHAPTERS.find((item) => item.id === chapterId);

  if (!chapter) {
    document.getElementById("reader-message").textContent =
      "بيانات هذا الفصل غير موجودة في chapters-data.js.";
    return;
  }

  const published = BT_CHAPTERS
    .filter((item) => item.status === "published")
    .sort((a, b) => a.number - b.number);

  const chapterIndex = published.findIndex((item) => item.id === chapterId);
  const previous = published[chapterIndex - 1];
  const next = published[chapterIndex + 1];

  const text = paragraphs.map((paragraph) => paragraph.textContent).join(" ");
  const wordCount = text.trim().split(/\s+/u).filter(Boolean).length;

  const initialPosition = BT.chapter(chapterId);
  let ready = false;
  let saveTimer;
  let progress = 0;

  document.title = `${chapter.title} | Broken Throne`;
  document.getElementById("chapter-title").textContent =
    `الفصل ${chapter.number}: ${chapter.title}`;

  BT.setWords(chapterId, wordCount);

  function createLink(label, target) {
    const link = document.createElement("a");
    link.className = "bt-button";
    link.textContent = label;
    link.href = target;
    return link;
  }

  document.querySelectorAll(".chapter-navigation").forEach((nav) => {
    if (previous) {
      nav.appendChild(createLink("→ الفصل السابق", previous.file));
    }

    nav.appendChild(createLink("قائمة الفصول", "index.html"));

    if (next) {
      nav.appendChild(createLink("الفصل التالي ←", next.file));
    }
  });

  if (next) {
    const prefetch = document.createElement("link");
    prefetch.rel = "prefetch";
    prefetch.href = next.file;
    document.head.appendChild(prefetch);
  }

  function syncControls() {
    const settings = BT.settings;

    document.documentElement.style.setProperty(
      "--reading-scale",
      settings.size / 100
    );

    document.querySelectorAll("[data-setting]").forEach((control) => {
      control.value = settings[control.dataset.setting];
    });

    document.getElementById("font-percentage").value = `${settings.size}%`;

    document.getElementById("font-decrease").disabled = settings.size <= 80;
    document.getElementById("font-increase").disabled = settings.size >= 160;

    const bookmarks = BT.chapter(chapterId).bookmarks;

    paragraphs.forEach((paragraph) => {
      const button = paragraph.querySelector(".paragraph-bookmark");
      if (!button) return;

      const saved = bookmarks.includes(paragraph.id);

      button.setAttribute("aria-pressed", String(saved));
      button.title = saved ? "إزالة الإشارة" : "حفظ إشارة على الفقرة";
    });
  }

  function currentParagraph() {
    return paragraphs.find(
      (paragraph) => paragraph.getBoundingClientRect().bottom > 60
    ) || paragraphs[paragraphs.length - 1];
  }

  function preservePosition(change) {
    const anchor = currentParagraph();
    const offset = anchor.getBoundingClientRect().top;

    change();

    requestAnimationFrame(() => {
      window.scrollBy(0, anchor.getBoundingClientRect().top - offset);
      updateProgress();
    });
  }

  document.querySelectorAll("[data-setting]").forEach((control) => {
    control.addEventListener("input", () => {
      const key = control.dataset.setting;
      const value = ["line", "width"].includes(key)
        ? Number(control.value)
        : control.value;

      preservePosition(() => {
        BT.changeSettings({ [key]: value });
      });
    });
  });

  document.getElementById("font-decrease").addEventListener("click", () => {
    preservePosition(() => {
      BT.changeSettings({ size: BT.settings.size - 10 });
    });
  });

  document.getElementById("font-increase").addEventListener("click", () => {
    preservePosition(() => {
      BT.changeSettings({ size: BT.settings.size + 10 });
    });
  });

  document.getElementById("reset-settings").addEventListener("click", () => {
    preservePosition(() => BT.resetSettings());
  });

  function setFocus(enabled) {
    preservePosition(() => {
      document.body.classList.toggle("focus-mode", enabled);
    });

    if (enabled) {
      document.getElementById("exit-focus").focus({ preventScroll: true });
    } else {
      document.getElementById("focus-mode").focus({ preventScroll: true });
    }
  }

  document.getElementById("focus-mode").addEventListener("click", () => {
    setFocus(true);
  });

  document.getElementById("exit-focus").addEventListener("click", () => {
    setFocus(false);
  });

  paragraphs.forEach((paragraph, index) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "paragraph-bookmark";
    button.textContent = index + 1;
    button.setAttribute("aria-label", `إشارة مرجعية للفقرة ${index + 1}`);

    button.addEventListener("click", () => {
      BT.toggleBookmark(chapterId, paragraph.id);
    });

    paragraph.prepend(button);
  });

  function measureProgress() {
    const top = article.getBoundingClientRect().top + window.scrollY;
    const bottom = top + article.offsetHeight;

    const start = Math.max(0, top - 70);
    const finish = Math.max(start + 1, bottom - window.innerHeight + 30);

    return Math.min(
      1,
      Math.max(0, (window.scrollY - start) / (finish - start))
    );
  }

  function updateProgress() {
    progress = measureProgress();

    document.getElementById("reader-progress").style.width =
      `${progress * 100}%`;

    const minutes = Math.ceil((wordCount * (1 - progress)) / 200);

    document.getElementById("chapter-statistics").textContent =
      `${wordCount} كلمة · ${Math.round(progress * 100)}% · ${
        minutes > 0 ? `متبقٍ نحو ${minutes} دقائق` : "وصلت إلى النهاية"
      }`;
  }

  function savePosition() {
    if (!ready) return;

    updateProgress();

    BT.savePosition(
      chapterId,
      progress,
      currentParagraph().id
    );
  }

  window.addEventListener("scroll", () => {
    if (!ready) return;

    updateProgress();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(savePosition, 350);
  }, { passive: true });

  window.addEventListener("resize", updateProgress);

  window.addEventListener("pagehide", savePosition);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      savePosition();
    }
  });

  document.addEventListener("keydown", (event) => {
    const editing = event.target.closest(
      "input, textarea, select, button, [contenteditable='true']"
    );

    if (
      editing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) return;

    if (event.key === "Escape") {
      setFocus(false);
    }

    if (event.key === "ArrowLeft" && next) {
      event.preventDefault();
      savePosition();
      window.location.href = next.file;
    }

    if (event.key === "ArrowRight" && previous) {
      event.preventDefault();
      savePosition();
      window.location.href = previous.file;
    }
  });

  document.getElementById("share-chapter").addEventListener("click", async () => {
    const message = document.getElementById("reader-message");
    const url = window.location.href.split("#")[0];

    try {
      if (navigator.share) {
        await navigator.share({
          title: chapter.title,
          url
        });
      } else if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
        message.textContent = "تم نسخ رابط الفصل.";
      } else {
        message.textContent = `رابط الفصل: ${url}`;
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        message.textContent = `رابط الفصل: ${url}`;
      }
    }
  });

  window.addEventListener("bt:change", syncControls);

  syncControls();

  window.addEventListener("load", async () => {
    if (document.fonts) {
      await document.fonts.ready;
    }

    let requestedParagraph = null;

    try {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      requestedParagraph = paragraphs.find((paragraph) => paragraph.id === hash);
    } catch {
      // تجاهل رابط فقرة غير صالح.
    }

    if (requestedParagraph) {
      requestedParagraph.scrollIntoView({ block: "start" });
    } else if (
      initialPosition.status !== "unread" &&
      initialPosition.paragraph
    ) {
      const saved = paragraphs.find(
        (paragraph) => paragraph.id === initialPosition.paragraph
      );

      if (saved) {
        saved.scrollIntoView({ block: "start" });
      }
    }

    ready = true;
    updateProgress();

    // يُسجّل فتح الفصل دون تحويله تلقائيًا إلى مقروء.
    BT.savePosition(chapterId, progress, currentParagraph().id);
  });
})();
