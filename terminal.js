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
  var chatTimer;
  var typing;

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
    "  now           查看当前作品与关注方向",
    "  projects      浏览项目、获奖信息与演示",
    "  universe      返回宇宙总览",
    "  orbit         开启自动探索（universe 退出）",
    "  visit <planet> 进入星球（origin / intelligence / ventures / observatory / playground）",
    "  links         打开 GitHub 与项目入口",
    "  fortune       获取一条随机短句",
    "  echo <text>   回显一段文字",
    "  clear         清空终端",
    "  claude / gpt / deepseek  和一位室友聊天",
    "  summon       召唤三位室友",
    "  chat         随机打开合租群",
    "  chat <话题>   midnight / coding / life / yubai / chaos"
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
    appendEntry(line);
  }

  function appendEntry(line) {
    output.appendChild(line);
    trimOutput();
    scrollToLatest();
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

  function getProjects() {
    return Array.prototype.map.call(
      document.querySelectorAll("#projects .project-card"),
      function (card) {
        var title = card.querySelector("h3");
        var descriptions = Array.from(card.querySelectorAll(".project-description"), function (p) { return p.textContent.trim(); });
        var award = card.querySelector(".project-award");
        var link = card.querySelector(".project-link");
        return {
          title: title ? title.textContent.trim() : "",
          description: descriptions.join("\n"),
          award: award ? award.textContent.trim() : "",
          linkLabel: link ? link.firstChild.textContent.trim() : "",
          href: link ? link.getAttribute("href") : ""
        };
      }
    ).filter(function (project) {
      return project.title && project.href;
    });
  }

  function appendLink(label, href) {
    var line = document.createElement("p");
    line.className = "terminal-line terminal-entry";

    var link = document.createElement("a");
    link.className = "terminal-link";
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label + " ↗";
    link.setAttribute("aria-label", label + "（在新标签页打开）");

    line.appendChild(link);
    output.appendChild(line);
    trimOutput();
    scrollToLatest();
  }

  function appendProjects() {
    var projects = getProjects();
    if (!projects.length) {
      appendLine("项目展示正在更新。", "terminal-muted");
      return;
    }

    appendLine("项目展示：");
    projects.forEach(function (project, index) {
      appendLine((index + 1) + ". " + project.title);
      if (project.award) appendLine(project.award, "terminal-award");
      if (project.description) appendLine(project.description, "terminal-muted");
      appendLink(project.linkLabel + " — " + project.title, project.href);
    });
  }

  function appendLinks() {
    appendLink("GitHub @lemon-neko", "https://github.com/lemon-neko");
    getProjects().forEach(function (project) {
      appendLink(project.title, project.href);
    });
  }

  function appendRoommate(id, text, showMapLink) {
    var line = document.createElement("p");
    line.className = "terminal-line terminal-entry terminal-roommate";
    line.dataset.speaker = id;
    var name = document.createElement("strong");
    name.textContent = roommateDialogue.characters[id].name;
    var copy = document.createElement("span");
    copy.append(name, " · " + text);
    var avatar = document.querySelector('#roommate-sighting [data-roommate="' + id + '"] svg').cloneNode(true);
    if (showMapLink) {
      var link = document.createElement("a");
      link.className = "terminal-link";
      link.href = "#home";
      link.textContent = "去星图看看 ↑";
      copy.append(" ", link);
    }
    line.append(avatar, copy);
    appendEntry(line);
  }

  function meetRoommate(id) {
    var text = roommateDialogue.line(id, "replies");
    var name = roommateDialogue.characters[id].name;
    appendRoommate(id, text, true);
    window.dispatchEvent(new CustomEvent("yubai:roommate", { detail: { id: id, name: name, text: text } }));
  }

  function stopChat() {
    clearTimeout(chatTimer);
    typing?.remove();
  }

  function startChat(topic, summoned) {
    var scene = roommateDialogue.chat(topic);
    if (!scene) {
      appendLine("没找到这个频道。试试 chat midnight / coding / life / yubai / chaos。", "terminal-error");
      return;
    }
    var channel = roommateDialogue.channels[scene.channel] || "隐藏频道";
    appendLine((summoned ? "三位室友上线 · " : "") + channel + " / " + scene.title + "（本地剧本）", "terminal-chat-title");
    typing = document.createElement("p");
    typing.className = "terminal-line terminal-typing";
    typing.setAttribute("aria-hidden", "true");
    function next(index) {
      if (index === scene.messages.length) return;
      var [id, text] = scene.messages[index];
      var dots = document.createElement("span");
      dots.textContent = "…";
      typing.dataset.speaker = id;
      typing.replaceChildren(roommateDialogue.characters[id].name + " 正在输入", dots);
      output.append(typing);
      scrollToLatest();
      chatTimer = setTimeout(function () {
        typing.remove();
        appendRoommate(id, text, false);
        next(index + 1);
      }, Math.min(750, 300 + text.length * 10));
    }
    next(0);
  }

  function runCommand(rawCommand) {
    var command = rawCommand.trim();
    if (!command) return;

    stopChat();
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
        appendLine(document.querySelector(".about-intro").textContent, "terminal-muted");
        break;
      case "now":
        appendLine("当前作品：");
        getProjects().forEach(function (project) {
          appendLine("  " + project.title + (project.award ? " — " + project.award : ""));
        });
        document.querySelectorAll(".currently-list li").forEach(function (item) {
          appendLine(item.querySelector("strong").textContent + " — " + item.querySelector("p").innerText, "terminal-muted");
        });
        appendLine("输入 projects 查看项目介绍与体验入口。", "terminal-muted");
        break;
      case "universe":
      case "orbit":
        window.yubaiUniverse?.overview({ orbit: name === "orbit" });
        break;
      case "visit":
        if (!window.yubaiUniverse?.visit(argument.toLowerCase() === "life" || argument === "人生" ? "ventures" : argument.toLowerCase())) {
          appendLine("未知星球。可用：origin、intelligence、ventures、observatory、playground。", "terminal-error");
        }
        break;
      case "projects":
        appendProjects();
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
      case "claude":
      case "gpt":
      case "deepseek":
        meetRoommate(name);
        break;
      case "summon":
      case "chat":
        startChat(name === "summon" ? "" : argument.toLowerCase(), name === "summon");
        break;
      case "sudo":
        appendLine("权限不足：这里没有 root，只有好奇心。", "terminal-error");
        break;
      default:
        appendLine("command not found: " + name + "。输入 help 查看可用命令。", "terminal-error");
    }

    scrollToLatest();
  }

  function submitCommand(value) {
    if (isComposing) return;
    var command = value.trim();
    if (!command) return;

    if (history[history.length - 1] !== command) {
      history.push(command);
      if (history.length > MAX_HISTORY) history.shift();
    }
    historyIndex = history.length;
    input.value = "";
    runCommand(command);
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    submitCommand(input.value);
  });
  window.addEventListener("yubai:roommates-summoned", function () { runCommand("summon"); });
  window.addEventListener("pagehide", stopChat);
  var guide = document.querySelector(".console-guide");
  if (guide) {
    var stackedConsole = matchMedia("(max-width:680px)");
    guide.querySelector(".console-commands").hidden = false;
    guide.querySelector(".roommate-channels").hidden = false;
    guide.querySelectorAll(".roommate-card").forEach(function (button) { button.disabled = false; });
    guide.addEventListener("click", function (event) {
      var button = event.target.closest("[data-command]");
      if (!button) return;
      submitCommand(button.dataset.command);
      if (stackedConsole.matches && button.closest(".roommates, .roommate-channels")) terminal.scrollIntoView({block:"nearest"});
    });
  }

  input.addEventListener("compositionstart", function () {
    isComposing = true;
  });

  input.addEventListener("compositionend", function () {
    isComposing = false;
  });

  input.addEventListener("keydown", function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l") {
      event.preventDefault();
      stopChat();
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
