"use strict";

(() => {
  const chapters = window.BT_CHAPTERS;
  const published = chapters
    .filter((chapter) => chapter.status === "published")
    .sort((a, b) => a.number - b.number);

  const preferenceKey = "broken-throne-catalog-v1";

  const controls = {
    search: document.getElementById("chapter-search"),
    filter: document.getElementById("chapter-filter"),
    tag: document.getElementById("chapter-tag"),
    sort: document.getElementById("chapter-sort"),
    view: document.getElementById("chapter-view"),
    summaries: document.getElementById("show-summaries")
  };

  const list = document.getElementById("chapters-list");
  const message = document.getElementById("catalog-message");
  const volumes = [...new Set(chapters.map((chapter) => chapter.volume))];

  function element(tag, className, text) {
    const node = document.createElement(tag);

    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;

    return node;
  }

  function normalize(value) {
    return String(value)
      .replace(/[٠-٩]/g, (digit) => "٠١٢٣٤٥٦٧٨٩".indexOf(digit))
      .replace(/[۰-۹]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹".indexOf(digit))
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/[أإآ]/g, "ا")
      .toLowerCase()
      .trim();
  }

  function isNew(chapter) {
    if (chapter.status !== "published" || !chapter.date) return false;

    const publishedAt = new Date(`${chapter.date}T00:00:00+03:00`);
    const age = Date.now() - publishedAt.getTime();

    return age >= 0 && age < 7 * 24 * 60 * 60 * 1000;
  }

  function dateLabel(value) {
    if (!value) return "موعد النشر لم يُحدّد";

    return new Date(`${value}T12:00:00+03:00`).toLocaleDateString(
      "ar-JO",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "Asia/Amman"
      }
    );
  }

  function savePreferences() {
    try {
      localStorage.setItem(
        preferenceKey,
        JSON.stringify({
          search: controls.search.value,
          filter: controls.filter.value,
          tag: controls.tag.value,
          sort: controls.sort.value,
          view: controls.view.value,
          summaries: controls.summaries.checked
        })
      );
    } catch {
      // تبقى الفلاتر قابلة للاستخدام حتى لو كان التخزين غير متاح.
    }
  }

  [...new Set(chapters.flatMap((chapter) => chapter.tags))]
    .forEach((tag) => {
      const option = element("option", "", tag);
      option.value = tag;
      controls.tag.appendChild(option);
    });

  try {
    const saved = JSON.parse(localStorage.getItem(preferenceKey) || "{}");

    Object.entries(controls).forEach(([name, control]) => {
      if (name === "summaries") {
        control.checked = saved.summaries === true;
      } else if (typeof saved[name] === "string") {
        const previous = control.value;
        control.value = saved[name];

        if (control.tagName === "SELECT" && !control.value) {
          control.value = previous;
        }
      }
    });
  } catch {
    // استخدام الخيارات الافتراضية.
  }

  function setLink(id, chapter, resume = false) {
    const link = document.getElementById(id);

    if (!chapter) {
      link.hidden = true;
      return;
    }

    const position = BT.chapter(chapter.id);
    const hash = resume && position.paragraph
      ? `#${encodeURIComponent(position.paragraph)}`
      : "";

    link.href = chapter.file + hash;
    link.hidden = false;
  }

  function updateProgress() {
    const read = published.filter(
      (chapter) => BT.chapter(chapter.id).status === "read"
    ).length;

    document.getElementById("progress-count").textContent =
      `قرأت ${read} من ${published.length} فصل`;

    const timeline = document.getElementById("chapter-timeline");
    timeline.replaceChildren();

    published.forEach((chapter) => {
      const state = BT.chapter(chapter.id);
      const segment = element("span", state.status);

      segment.title = `الفصل ${chapter.number}: ${
        state.status === "read"
          ? "مقروء"
          : state.status === "reading"
            ? "جاري القراءة"
            : "غير مقروء"
      }`;

      timeline.appendChild(segment);
    });

    setLink("first-chapter", published[0]);
    setLink("last-chapter", published[published.length - 1]);
    setLink(
      "continue-chapter",
      published.find((chapter) => chapter.id === BT.lastId),
      true
    );
  }

  function chapterCard(chapter) {
    const state = BT.chapter(chapter.id);
    const available = chapter.status === "published";

    const card = element("article", "chapter-card");
    const meta = element("div", "chapter-meta");

    const status = !available
      ? "قريبًا"
      : state.status === "read"
        ? "✓ مقروء"
        : state.status === "reading"
          ? `◐ جاري القراءة · ${Math.round(state.progress * 100)}%`
          : "○ غير مقروء";

    meta.appendChild(element("span", "chapter-badge", status));

    if (isNew(chapter)) {
      meta.appendChild(element("span", "chapter-badge", "جديد"));
    }

    if (chapter.type !== "main") {
      meta.appendChild(
        element(
          "span",
          "chapter-badge",
          chapter.type === "announcement" ? "إعلان" : "فصل جانبي"
        )
      );
    }

    const heading = element("h3");
    const title = chapter.type === "main"
      ? `${chapter.number}. ${chapter.title}`
      : chapter.title;

    if (available) {
      const link = element("a", "", title);
      link.href = chapter.file;
      heading.appendChild(link);
    } else {
      heading.textContent = title;
    }

    const details = element("div", "chapter-meta");

    details.appendChild(
      element(
        "span",
        "",
        available
          ? dateLabel(chapter.date)
          : `متوقع: ${dateLabel(chapter.date)}`
      )
    );

    if (state.words > 0) {
      details.appendChild(
        element(
          "span",
          "",
          `${state.words} كلمة · نحو ${Math.max(
            1,
            Math.ceil(state.words / 200)
          )} دقائق`
        )
      );
    }

    card.append(meta, heading, details);

    const tags = element("div", "chapter-tags");

    chapter.tags.forEach((tag) => {
      tags.appendChild(element("span", "chapter-tag", tag));
    });

    card.appendChild(tags);

    if (controls.summaries.checked && chapter.summary) {
      card.appendChild(
        element("p", "chapter-summary", chapter.summary)
      );
    }

    if (controls.summaries.checked && chapter.excerpt && available) {
      const preview = element("blockquote", "chapter-preview", chapter.excerpt);
      card.appendChild(preview);

      let timer;

      card.addEventListener("pointerdown", (event) => {
        if (event.pointerType !== "touch") return;

        timer = setTimeout(() => {
          card.classList.add("show-preview");
        }, 500);
      });

      ["pointerup", "pointercancel", "pointermove"].forEach((name) => {
        card.addEventListener(name, () => clearTimeout(timer));
      });

      const previewButton = element("button", "bt-button", "معاينة");
      previewButton.type = "button";
      previewButton.addEventListener("click", () => {
        card.classList.toggle("show-preview");
      });

      card.appendChild(previewButton);
    }

    if (available) {
      const actions = element("div", "bt-actions");
      actions.style.marginTop = "15px";

      const toggle = element(
        "button",
        "bt-button",
        state.status === "read"
          ? "تحديد كغير مقروء"
          : "تحديد كمقروء"
      );

      toggle.type = "button";
      toggle.addEventListener("click", () => {
        BT.markRead(chapter.id, state.status !== "read");
      });

      actions.appendChild(toggle);
      card.appendChild(actions);
    }

    return card;
  }

  function render() {
    const closedVolumes = new Set(
      [...list.querySelectorAll("details:not([open])")]
        .map((node) => node.dataset.volume)
    );

    const query = normalize(controls.search.value);

    const filtered = chapters.filter((chapter) => {
      const state = BT.chapter(chapter.id);

      if (
        query &&
        !normalize(`${chapter.number} ${chapter.title}`).includes(query)
      ) return false;

      if (
        controls.tag.value &&
        !chapter.tags.includes(controls.tag.value)
      ) return false;

      if (
        controls.filter.value === "unread" &&
        (chapter.status !== "published" || state.status !== "unread")
      ) return false;

      if (
        controls.filter.value === "bookmarked" &&
        state.bookmarks.length === 0
      ) return false;

      if (controls.filter.value === "new" && !isNew(chapter)) {
        return false;
      }

      return true;
    });

    filtered.sort((a, b) => {
      return controls.sort.value === "asc"
        ? a.number - b.number
        : b.number - a.number;
    });

    list.replaceChildren();

    const links = document.getElementById("volume-links");
    links.replaceChildren();

    const orderedVolumes = [...volumes];

    if (controls.sort.value === "desc") {
      orderedVolumes.reverse();
    }

    orderedVolumes.forEach((volume) => {
      const items = filtered.filter((chapter) => chapter.volume === volume);
      if (!items.length) return;

      const id = `volume-${volumes.indexOf(volume) + 1}`;
      const group = element("details", "volume");

      group.id = id;
      group.dataset.volume = volume;
      group.open = !closedVolumes.has(volume);

      group.appendChild(
        element("summary", "", `${volume} · ${items.length}`)
      );

      const container = element(
        "div",
        `chapter-items ${controls.view.value}`
      );

      items.forEach((chapter) => {
        container.appendChild(chapterCard(chapter));
      });

      group.appendChild(container);
      list.appendChild(group);

      const link = element("a", "bt-button", volume);
      link.href = `#${id}`;

      link.addEventListener("click", () => {
        group.open = true;
      });

      links.appendChild(link);
    });

    if (!filtered.length) {
      list.appendChild(
        element("p", "bt-empty", "لا توجد فصول تطابق خيارات البحث.")
      );
    }

    updateProgress();
  }

  Object.values(controls).forEach((control) => {
    control.addEventListener(
      control.type === "search" ? "input" : "change",
      () => {
        savePreferences();
        render();
      }
    );
  });

  document.getElementById("jump-form").addEventListener("submit", (event) => {
    event.preventDefault();

    const raw = normalize(document.getElementById("jump-number").value);

    if (!/^\d+$/.test(raw)) {
      message.textContent = "اكتب رقم فصل صحيح.";
      return;
    }

    const chapter = chapters.find(
      (item) => item.type === "main" && item.number === Number(raw)
    );

    if (!chapter) {
      message.textContent = "هذا الفصل غير موجود.";
    } else if (chapter.status !== "published") {
      message.textContent = "هذا الفصل لم يُنشر بعد.";
    } else {
      window.location.href = chapter.file;
    }
  });

  document.getElementById("random-chapter").addEventListener("click", () => {
    if (!published.length) return;

    const chapter = published[Math.floor(Math.random() * published.length)];
    window.location.href = chapter.file;
  });

  document.getElementById("mark-all").addEventListener("click", () => {
    if (confirm("تحديد جميع الفصول المنشورة كمقروءة؟")) {
      BT.markAll(published.map((chapter) => chapter.id));
    }
  });

  document.getElementById("reset-progress").addEventListener("click", () => {
    if (confirm("مسح تقدّم القراءة؟ ستبقى الإشارات والإعدادات محفوظة.")) {
      BT.resetProgress(published.map((chapter) => chapter.id));
    }
  });

  window.addEventListener("bt:change", render);

  render();
})();
