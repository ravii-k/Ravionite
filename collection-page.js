(function () {
  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function setHTML(id, value) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = value;
  }

  function renderHeroTitle(lines) {
    return lines
      .map(function (line) {
        var content = line.gradient
          ? '<span class="gradient-text">' + line.text + "</span>"
          : line.text;
        return '<span class="hero-line"><span class="hero-line-inner">' + content + "</span></span>";
      })
      .join("");
  }

  function renderChips(chips) {
    return (chips || [])
      .map(function (chip) {
        return '<span class="chip">' + chip + "</span>";
      })
      .join("");
  }

  function renderSteps(steps) {
    var grid = document.getElementById("stepsGrid");
    if (!grid) return;

    grid.innerHTML = "";
    (steps || []).forEach(function (step, index) {
      var card = document.createElement("div");
      card.className = "sequence-card";
      card.setAttribute("data-reveal", "");
      card.innerHTML =
        '<div class="sequence-num">' + String(index + 1) + "</div>" +
        '<div class="sequence-title">' + step.title + "</div>" +
        '<div class="sequence-text">' + step.text + "</div>";
      grid.appendChild(card);
    });
  }

  function setStats(stats) {
    stats.forEach(function (stat, index) {
      setText("collectionStatLabel" + (index + 1), stat.label);
    });
  }

  function animateStats(stats) {
    window.setTimeout(function () {
      stats.forEach(function (stat, index) {
        NexusTheme.animateNumber(
          "collectionStat" + (index + 1),
          0,
          stat.value,
          stat.duration || 1400 + index * 200,
          stat.formatter || function (value) {
            return String(value).padStart(2, "0");
          }
        );
      });
    }, 1300);
  }

  function setWorkflow(workflow) {
    setText("workflowLabel", workflow.label);
    setText("workflowTitle", workflow.title);
    setText("workflowCopy", workflow.copy);
    setText("workflowBadge", workflow.badge);
    setText("workflowMainLine", workflow.mainLine);

    workflow.metrics.forEach(function (metric, index) {
      setText("workflowMetricValue" + (index + 1), metric.value);
      setText("workflowMetricLabel" + (index + 1), metric.label);
    });

    setText("workflowCopyBtn", workflow.copyButtonLabel);
  }

  function updateButtonState(button, idleLabel, successLabel) {
    button.textContent = successLabel;
    button.classList.add("copied");
    window.setTimeout(function () {
      button.textContent = idleLabel;
      button.classList.remove("copied");
    }, 1800);
  }

  function buildPromptCards(prompts) {
    var grid = document.getElementById("promptsGrid");
    if (!grid) return;

    prompts.forEach(function (prompt, index) {
      var card = document.createElement("div");
      card.className = "prompt-card";
      card.setAttribute("data-reveal", "");
      card.innerHTML =
        '<div class="prompt-num">' + prompt.num + "</div>" +
        '<div class="prompt-tag">' + prompt.tag + "</div>" +
        '<div class="prompt-title">' + prompt.title + "</div>" +
        '<div class="prompt-desc">' + prompt.desc + "</div>" +
        '<div class="prompt-divider"></div>' +
        '<div class="prompt-how-label">How to use</div>' +
        '<div class="prompt-how">' + prompt.howTo + "</div>" +
        '<button class="copy-btn" type="button" data-index="' + index + '">Copy Prompt</button>';

      card.addEventListener("click", function (event) {
        if (event.target.closest(".copy-btn")) return;
        openOverlay(prompts, index);
      });

      card.querySelector(".copy-btn").addEventListener("click", function (event) {
        event.stopPropagation();
        NexusTheme.copyText(prompt.prompt).then(function () {
          updateButtonState(event.currentTarget, "Copy Prompt", "Copied!");
        });
      });

      grid.appendChild(card);
    });
  }

  function openOverlay(prompts, index) {
    var prompt = prompts[index];
    var overlay = document.getElementById("overlay");
    var copyButton = document.getElementById("overlayCopyBtn");

    setText("overlayTag", "Prompt " + prompt.num + " / " + prompt.tag);
    setText("overlayTitle", prompt.title);
    setText("overlayDesc", prompt.desc);
    setText("overlayPrompt", prompt.prompt);
    copyButton.textContent = "Copy Full Prompt";
    copyButton.classList.remove("copied");
    copyButton.dataset.index = String(index);

    overlay.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeOverlay() {
    var overlay = document.getElementById("overlay");
    if (!overlay) return;
    overlay.classList.remove("active");
    document.body.style.overflow = "";
  }

  function bindOverlay(prompts) {
    var overlay = document.getElementById("overlay");
    var closeButton = document.getElementById("overlayClose");
    var copyButton = document.getElementById("overlayCopyBtn");

    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) closeOverlay();
    });

    closeButton.addEventListener("click", closeOverlay);

    copyButton.addEventListener("click", function () {
      var index = Number(copyButton.dataset.index || 0);
      NexusTheme.copyText(prompts[index].prompt).then(function () {
        updateButtonState(copyButton, "Copy Full Prompt", "Copied!");
      });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeOverlay();
    });
  }

  function initCollectionPage() {
    var config = window.collectionConfig;
    if (!config) return;

    document.body.classList.add("collection-page");
    if (config.pageClass) {
      document.body.classList.add(config.pageClass);
    }

    document.title = config.metaTitle;
    setText("collectionMeta", config.navMeta);
    setText("collectionBadgeText", config.hero.badge);
    setHTML("collectionHeroTitle", renderHeroTitle(config.hero.lines));
    setText("collectionSubtitle", config.hero.subtitle);
    setText("collectionPrimaryCta", config.hero.primaryCtaLabel);
    setText("collectionQuickCopy", config.hero.quickCopyLabel);

    setStats(config.stats);
    setText("introLabel", config.intro.label);
    setText("introTitle", config.intro.title);
    setText("introCopy", config.intro.copy);
    setText("warningTitle", config.warning.title);
    setText("warningText", config.warning.text);
    setHTML("warningChips", renderChips(config.warning.chips));

    setText("promptLabel", config.promptSection.label);
    setText("promptTitle", config.promptSection.title);
    setText("promptCopy", config.promptSection.copy);

    renderSteps(config.steps);
    buildPromptCards(config.prompts);
    setWorkflow(config.workflow);
    bindOverlay(config.prompts);

    document.getElementById("collectionPrimaryCta").setAttribute("href", "#prompts");
    document.getElementById("collectionQuickCopy").addEventListener("click", function () {
      NexusTheme.copyText(config.prompts[config.hero.quickCopyIndex].prompt).then(function () {
        updateButtonState(
          document.getElementById("collectionQuickCopy"),
          config.hero.quickCopyLabel,
          "Copied!"
        );
      });
    });

    document.getElementById("workflowCopyBtn").addEventListener("click", function () {
      NexusTheme.copyText(config.prompts[config.workflow.copyIndex].prompt).then(function () {
        updateButtonState(
          document.getElementById("workflowCopyBtn"),
          config.workflow.copyButtonLabel,
          "Copied!"
        );
      });
    });

    document.getElementById("ctaTitle").innerHTML = config.cta.title;
    setText("ctaSub", config.cta.subtitle);
    setText("ctaPrimary", config.cta.primaryLabel);

    renderChips([]);

    NexusTheme.setupNav("navbar");
    NexusTheme.setupScrollProgress("scrollProgress");
    NexusTheme.setupHeroIntro();
    NexusTheme.createHeroScene({
      canvasId: "collection-hero-canvas",
      heroSelector: "#hero",
      widthRatio: config.heroWidthRatio || 0.58,
      variant: config.sceneVariant || "workflow"
    });
    NexusTheme.setupReveal();
    animateStats(config.stats);

    window.setTimeout(function () {
      document.getElementById("workflow-progress").style.width = "100%";
      NexusTheme.animateNumber("workflow-fill", 0, 100, 1400, function (value) {
        return value + "%";
      });
    }, 900);
  }

  document.addEventListener("DOMContentLoaded", initCollectionPage);
})();
