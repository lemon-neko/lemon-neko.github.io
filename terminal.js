(function () {
  "use strict";

  var terminal = document.querySelector("[data-terminal]");
  var output = document.getElementById("terminal-output");
  var form = document.getElementById("terminal-form");
  var input = document.getElementById("terminal-input");

  if (!terminal || !output || !form || !input) return;

  var MAX_ENTRIES = 100;
  var MAX_HISTORY = 50;
  var history = [];
  var historyIndex = 0;
  var isComposing = false;
  var lastFortuneIndex = -1;

  var fortunes = [
    "把复杂的事情讲清楚，本身就是一种创造。",
    "先构建一个能工作的版本，再让它长出自己的性格。",
    "Enough abstraction makes it concrete.",
    "好工具不会替你思考，它会让思考走得更远。",
    "保持好奇，也给偶然留一点空间。"
  ];

  var helpLines = [
    "可用命令：",
    "  help          查看命令列表",
    "  about         认识羽白",
    "  now           查看正在做的事",
    "  links         打开其他入口",
    "  fortune       获取一条随机短句",
    "  echo <text>   回显一段文字",
    "  clear         清空终端"
  ];

  function trimOutput() {
    while (output.querySelectorAll(".terminal-entry").length > MAX_ENTRIES) {
      var oldest = output.querySelector(".terminal-entry");
      if (!oldest) break;
      oldest.remove();
    }
  }

  function scrollToLatest() {
    output.scrollTop = output.scrollHeight;
  }

  function appendLine(text, className) {
    var line = document.createElement("p");
    line.className = "terminal-line terminal-entry" + (className ? " " + className : "");
    line.textContent = text;
    output.appendChild(line);
    trimOutput();
    scrollToLatest();
    return line;
  }

  function appendLines(lines, className) {
    lines.forEach(function (line) {
      appendLine(line, className);
    });
  }

  function appendCommand(command) {
    var line = document.createElement("p");
    var prompt = document.createElement("span");
    var value = document.createElement("span");

    line.className = "terminal-line terminal-entry terminal-command";
    prompt.className = "terminal-prompt";
    prompt.textContent = "visitor@yubai:~$";
    value.textContent = command;
    line.appendChild(prompt);
    line.appendChild(value);
    output.appendChild(line);
    trimOutput();
  }

  function appendLinks() {
    var line = document.createElement("p");
    line.className = "terminal-line terminal-entry";

    var github = document.createElement("a");
    github.className = "terminal-link";
    github.href = "https://github.com/lemon-neko";
    github.target = "_blank";
    github.rel = "noopener noreferrer";
    github.textContent = "GitHub @lemon-neko";

    line.appendChild(github);
    output.appendChild(line);
    trimOutput();
    scrollToLatest();
  }

  function runCommand(rawCommand) {
    var command = rawCommand.trim();
    if (!command) return;

    appendCommand(command);

    var firstSpace = command.search(/\s/);
    var name = (firstSpace === -1 ? command : command.slice(0, firstSpace)).toLowerCase();
    var argument = firstSpace === -1 ? "" : command.slice(firstSpace).trim();

    switch (name) {
      case "help":
        appendLines(helpLines, "terminal-muted");
        break;
      case "about":
        appendLine("羽白 — AI Engineer · Builder · Observer");
        appendLine("构建 AI 系统，也思考系统背后技术与人的关系。", "terminal-muted");
        break;
      case "now":
        appendLines([
          "🚀 Building — AI applications",
          "🧪 Exploring — LLM · Agent · Human-AI Interaction",
          "✍️ Creating — Technology, people and the future"
        ]);
        break;
      case "links":
        appendLinks();
        break;
      case "fortune":
        var nextIndex = Math.floor(Math.random() * fortunes.length);
        if (fortunes.length > 1 && nextIndex === lastFortuneIndex) {
          nextIndex = (nextIndex + 1) % fortunes.length;
        }
        lastFortuneIndex = nextIndex;
        appendLine(fortunes[nextIndex], "terminal-success");
        break;
      case "echo":
        appendLine(argument || "用法：echo <text>", argument ? "" : "terminal-muted");
        break;
      case "clear":
        output.replaceChildren();
        break;
      case "neko":
        appendLine(" /\\_/\\\n( o.o )\n > ^ <", "terminal-ascii");
        appendLine("你发现了一只藏在终端里的猫。", "terminal-muted");
        window.dispatchEvent(new CustomEvent("yubai:neko-found"));
        break;
      case "sudo":
        appendLine("权限不足：这里没有 root，只有好奇心。", "terminal-error");
        break;
      default:
        appendLine("command not found: " + name + "。输入 help 查看可用命令。", "terminal-error");
    }

    scrollToLatest();
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (isComposing) return;

    var command = input.value.trim();
    if (!command) return;

    if (history[history.length - 1] !== command) {
      history.push(command);
      if (history.length > MAX_HISTORY) history.shift();
    }
    historyIndex = history.length;
    input.value = "";
    runCommand(command);
  });

  input.addEventListener("compositionstart", function () {
    isComposing = true;
  });

  input.addEventListener("compositionend", function () {
    isComposing = false;
  });

  input.addEventListener("keydown", function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l") {
      event.preventDefault();
      output.replaceChildren();
      return;
    }

    if (event.key === "Enter" && !isComposing) {
      event.preventDefault();
      form.requestSubmit();
      return;
    }

    if (isComposing || !history.length) return;

    if (event.key === "ArrowUp") {
      event.preventDefault();
      historyIndex = Math.max(0, historyIndex - 1);
      input.value = history[historyIndex];
      input.setSelectionRange(input.value.length, input.value.length);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      historyIndex = Math.min(history.length, historyIndex + 1);
      input.value = historyIndex === history.length ? "" : history[historyIndex];
      input.setSelectionRange(input.value.length, input.value.length);
    }
  });

  terminal.addEventListener("click", function (event) {
    if (event.target.closest("a") || event.target === input) return;
    input.focus();
  });

  terminal.dataset.ready = "true";
})();
