"use strict";

const sparksContainer = document.getElementById("sparks");
const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
);

if (sparksContainer && !reducedMotion.matches) {
  const fragment = document.createDocumentFragment();

  function createSpark({
    left,
    top,
    dx,
    dy,
    delay,
    duration,
    size
  }) {
    const spark = document.createElement("span");

    spark.className = "spark";
    spark.style.left = left;
    spark.style.top = top;

    spark.style.setProperty("--dx", `${dx}px`);
    spark.style.setProperty("--dy", `${dy}px`);
    spark.style.setProperty("--delay", `${delay}s`);
    spark.style.setProperty("--duration", `${duration}s`);
    spark.style.setProperty("--size", `${size}px`);

    fragment.appendChild(spark);
  }

  // شرارات تتطاير خلال نزول النيزك.
  for (let i = 0; i < 32; i++) {
    const progress = i / 31;
    const distance = 1 - progress;

    createSpark({
      left: `${50 + distance * 60}%`,
      top: `${72 - distance * 95}%`,
      dx: 15 + Math.random() * 60,
      dy: -20 - Math.random() * 60,
      delay: 0.45 + progress * 1.95,
      duration: 0.3 + Math.random() * 0.4,
      size: 1 + Math.random() * 2
    });
  }

  // شرارات الارتطام تنتشر من نقطة الاصطدام.
  for (let i = 0; i < 70; i++) {
    const angle = Math.random() * Math.PI * 2;

    const distance =
      (0.15 + Math.random() * 0.85) *
      Math.min(window.innerWidth * 0.6, 560);

    createSpark({
      left: "50%",
      top: "72%",
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance * 0.65 - 65,
      delay: 2.4 + Math.random() * 0.16,
      duration: 0.8 + Math.random() * 1.5,
      size: 1 + Math.random() * 3
    });
  }

  sparksContainer.appendChild(fragment);

  // حذف عناصر الشرارات عند انتهاء حركتها.
  sparksContainer.addEventListener("animationend", (event) => {
    if (event.target.classList.contains("spark")) {
      event.target.remove();
    }
  });
}
