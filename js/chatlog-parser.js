$(document).ready(function () {
  let applyBackground = false;
  let applyCensorship = false; // State for censorship
  let censorshipStyle = 'pixelated'; // 'blurred' or 'hidden'
  let characterName = "";
  const $textarea = $("#chatlogInput");
  const $output = $("#output");
  const $toggleBackgroundBtn = $("#toggleBackground");
  const $toggleCensorshipBtn = $("#toggleCensorship"); // Censor Button
  const $toggleCensorshipStyleBtn = $("#toggleCensorshipStyle"); // Censorship Style Toggle

  $toggleBackgroundBtn.click(toggleBackground);
  $toggleCensorshipBtn.click(toggleCensorship); // Handle Censor Button Click
  $toggleCensorshipStyleBtn.click(toggleCensorshipStyle); // Handle Censorship Style Toggle

  function toggleBackground() {
    applyBackground = !applyBackground;
    $output.toggleClass("background-active", applyBackground);

    $toggleBackgroundBtn
      .toggleClass("btn-dark", applyBackground)
      .toggleClass("btn-outline-dark", !applyBackground);

    processOutput();
  }

  function toggleCensorship() {
    applyCensorship = !applyCensorship;
    $toggleCensorshipBtn
      .toggleClass("btn-dark", applyCensorship)
      .toggleClass("btn-outline-dark", !applyCensorship);
    processOutput();
  }

  function toggleCensorshipStyle() {
    censorshipStyle = (censorshipStyle === '像素化') ? '隐藏' : '像素化';
    $toggleCensorshipStyleBtn.text(`审查风格: ${censorshipStyle.charAt(0).toUpperCase() + censorshipStyle.slice(1)}`);
    processOutput();
  }

  $("#characterNameInput").on("input", debounce(applyFilter, 300));

  function applyFilter() {
    characterName = $("#characterNameInput").val().toLowerCase();
    processOutput();
  }

  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  function throttle(func, limit) {
    let lastFunc, lastRan;
    return function () {
      const context = this;
      const args = arguments;
      if (!lastRan) {
        func.apply(context, args);
        lastRan = Date.now();
      } else {
        clearTimeout(lastFunc);
        lastFunc = setTimeout(function () {
          if (Date.now() - lastRan >= limit) {
            func.apply(context, args);
            lastRan = Date.now();
          }
        }, limit - (Date.now() - lastRan));
      }
    };
  }

  $textarea.off("input").on("input", throttle(processOutput, 200));

  function processOutput() {
    const chatText = $textarea.val();
    const chatLines = chatText.split("\n").map(removeTimestamps);
    let fragment = document.createDocumentFragment();
  
    chatLines.forEach((line) => {
      const div = document.createElement("div");
      div.className = "generated";
  
      // Apply formatting first
      let formattedLine = formatLineWithFilter(line);
  
      // Then apply censorship
      if (applyCensorship) {
        formattedLine = applyCensorshipToLine(formattedLine, line);
      }
  
      div.innerHTML = addLineBreaksAndHandleSpans(formattedLine);
      fragment.appendChild(div);
  
      const clearDiv = document.createElement("div");
      clearDiv.className = "clear";
      fragment.appendChild(clearDiv);
    });
  
    $output.html('');
    $output.append(fragment);
    cleanUp();
  }

  function applyCensorshipToLine(formattedLine, originalLine) {
    const exclusionPatterns = [
      /\[S:\s*\d+\s*\|\s*CH:.*\]/,
      /\[\d{2}\/[A-Z]{3}\/\d{4}\]/,
      /intercom/i
    ];

    if (exclusionPatterns.some((pattern) => pattern.test(originalLine))) {
      return formattedLine;
    }

    const censorshipRules = [
      {
        regex: /\$\d+(?:,\d{3})*\.\d{1,3}/g, // Matches $123.456, $1,234.56
        replacement: (match) => `<span class="${censorshipStyle}">${match}</span>`
      },
      {
        regex: /\[\$\d+(?:,\d{3})*\.\d{1,3}\]/g, // Matches [$123.456], [$1,234.56]
        replacement: (match) => `<span class="${censorshipStyle}">${match}</span>`
      },
      {
        regex: /\$\d+(?:,\d{3})*(?:\.\d{1,3})?/g, // Matches $500, $10,584, $123.456
        replacement: (match) => `<span class="${censorshipStyle}">${match}</span>`
      },
      {
        regex: /\(\d+(g)?\)/g, // Matches (number) and (numberg)
        replacement: (match) => `<span class="${censorshipStyle}">${match}</span>`
      },
      {
        regex: /(?<!<span class="me">[^<]*\s)\d+(?=\s[a-zA-Z]+\b)/g,
        replacement: (match) => `<span class="${censorshipStyle}">${match}</span>`
      },
      {
        regex: /#\d+/g, // #456987123
        replacement: (match) => `<span class="${censorshipStyle}">${match}</span>`
      },
      {
        regex: /\[#\d+\]/g, // [#420420]
        replacement: (match) => `<span class="${censorshipStyle}">[#${match.match(/#\d+/)[0].slice(1)}]</span>`
      },
      {
        regex: /(?=.*<span class="blue">)x(\d+)/g,
        replacement: (_match, p1) => `x<span class="${censorshipStyle}">${p1}</span>`
      }
    ];

    let censoredLine = formattedLine;
    censorshipRules.forEach(rule => {
      censoredLine = censoredLine.replace(rule.regex, rule.replacement);
    });

    return censoredLine;
  }

  function removeTimestamps(line) {
    return line.replace(/\[\d{2}:\d{2}:\d{2}\] /g, "");
  }

  function formatLineWithFilter(line) {
    const lowerLine = line.toLowerCase();

    if (isRadioLine(line)) {
      if (!characterName) {
        return wrapSpan("radioColor", line);
      }
      return lowerLine.includes(characterName)
        ? wrapSpan("radioColor", line)
        : wrapSpan("radioColor2", line);
    }

    if (lowerLine.includes("says [low]:")) {
      if (!characterName) {
        return wrapSpan("grey", line);
      }
      return lowerLine.includes(characterName)
        ? wrapSpan("lightgrey", line)
        : wrapSpan("grey", line);
    }

    if (lowerLine.includes("说:") || lowerLine.includes("大喊:")) {
      if (!characterName) {
        return wrapSpan("white", line);
      }
      return lowerLine.includes(characterName)
        ? wrapSpan("white", line)
        : wrapSpan("lightgrey", line);
    }

    return formatLine(line);
  }

  function isRadioLine(line) {
    return /\[S: \d+ \| CH: .+\]/.test(line);
  }

  function formatLine(line) {
    const lowerLine = line.toLowerCase();
    
    if (lowerLine.includes("[ch: vts - 船舶交通服务]")) return formatVesselTraffic(line);
    if (/\[[^\]]+ -> [^\]]+\]/.test(line)) return wrapSpan("depColor", line);
    if (line.startsWith("*")) return wrapSpan("me", line);
    if (line.startsWith(">")) return wrapSpan("ame", line);
    if (lowerLine.includes("密语:")) return handleWhispers(line);
    if (lowerLine.includes("说 (手机):")) return handleCellphone(line);
    if (lowerLine.includes("说 [悄悄地]:")) return wrapSpan("grey", line);
    if (lowerLine.includes("说:") || lowerLine.includes("大喊:"))
      return wrapSpan("white", line);
    if (
      lowerLine.includes("(商品)") ||
      lowerLine.match(/(.+?)\s+x(\d+)\s+\((\d+g)\)/)
    )
      return handleGoods(line);
    if (lowerLine.includes("[扩音器]:")) return wrapSpan("yellow", line);
    if (lowerLine.startsWith("信息:")) return formatInfo(line);
    if (lowerLine.includes("向您的银行账户转账了 $")) return colorMoneyLine(line);
    if (lowerLine.includes("[药品工厂]")) return formatDrugLab();
    if (lowerLine.includes("[character kill]")) return formatCharacterKill(line);
    if (lowerLine.startsWith("[信息]")) return colorInfoLine(line);
    if (/\[.*? 无线电\]/i.test(lowerLine)) return formatIntercom(line);
    if (lowerLine.startsWith("你将")) return wrapSpan("orange", line);
    if (lowerLine.includes("从资产")) return wrapSpan("death", line);
    if (lowerLine.startsWith("[手机]")) return colorPhoneLine(line);
    if (lowerLine.startsWith("使用 /phonecursor")) return formatPhoneCursor(line);
    if (lowerLine.includes("向您出示了他的")) return formatShown(line);
    if (
      lowerLine.includes("您已成功发送当前位置信息")
    )
      return wrapSpan("green", line);
      if (lowerLine.includes("您收到了新的位置信息, 来自"))
        return colorLocationLine(line);
      if (
        lowerLine.includes("您将") ||
        lowerLine.includes("支付了您") ||
        lowerLine.includes("您支付了") ||
        lowerLine.includes("您收到了")
      )
    return handleTransaction(line);
    if (lowerLine.includes("you are now masked")) return wrapSpan("green", line);
    if (lowerLine.includes("you have shown your inventory")) return wrapSpan("green", line);
    if (lowerLine.includes("you are not masked anymore")) return wrapSpan("death", line);
    if (lowerLine.includes("you're being robbed, use /arob")) return formatRobbery(line);
    if (lowerLine.includes("您已将主手机设置为")) return formatPhoneSet(line);
    if (lowerLine.includes("sms sent on")) return formatSmsSent(line);
    if (lowerLine.includes("sms received on your")) return formatSmsReceived(line);
    if (lowerLine.startsWith("you've cut")) return formatDrugCut(line);
    if (lowerLine.includes("[property robbery]")) return formatPropertyRobbery(line);

    return replaceColorCodes(line);
  }

  function wrapSpan(className, content) {
    return `<span class="${className}">${content}</span>`;
  }

  function handleWhispers(line) {
    return line.startsWith("(车中)")
      ? wrapSpan("yellow", line)
      : wrapSpan("whisper", line);
  }

  function handleCellphone(line) {
    return line.startsWith("!")
      ? wrapSpan("yellow", line.slice(1))
      : wrapSpan("white", line);
  }

  function handleGoods(line) {
    return wrapSpan(
      "yellow",
      line.replace(/(\$\d+)/, '<span class="green">$1</span>')
    );
  }

  function handleTransaction(line) {
    return (
      '<span class="green">' +
    line.replace(/(\$\d+(?:,\d{3})*(?:\.\d{1,3})?)/g, '<span class="green">$1</span>') +
      "</span>"
    );
  }

  function formatInfo(line) {
    const moneyMatch = line.match(/\$(\d+)/);
    const itemMatch = line.match(/took\s(.+?)\s\((\d+)\)\sfrom\s(the\s.+)\.$/i);

    if (moneyMatch) {
        const objectMatch = line.match(/from the (.+)\.$/i);
        return objectMatch
            ? `<span class="orange">Info:</span> <span class="white">You took</span> <span class="green">$${moneyMatch[1]}</span> <span class="white">from the ${objectMatch[1]}</span>.`
            : line;
    }

    if (itemMatch) {
        const itemName = itemMatch[1];
        const itemQuantity = itemMatch[2];
        const fromObject = itemMatch[3];

        return `<span class="orange">Info:</span> <span class="white">You took</span> <span class="white">${itemName}</span> <span class="white">(${itemQuantity})</span> <span class="white">from ${fromObject}</span>.`;
    }

    return line;
}

  function formatDrugLab() {
    return '<span class="orange">[药品工厂]</span> <span class="white">药品已经开始生产.</span>';
  }

  function formatCharacterKill(line) {
    return (
      '<span class="blue">[角色杀戮]</span> <span class="death">' +
      line.slice(16) +
      "</span>"
    );
  }

  function formatIntercom(line) {
    return line.replace(
      /\[(.*?) intercom\]: (.*)/i,
      '<span class="blue">[$1 无线电]: $2</span>'
    );
  }

  function formatPhoneCursor(line) {
    return '<span class="white">使用 <span class="yellow">/phonecursor (/pc)</span> 激活光标以使用电话.</span>';
  }

  function formatShown(line) {
    return `<span class="green">${line.replace(
      /他的 (.+)\./,
      '他的 <span class="white">$1</span>.'
    )}</span>`;
  }

  function replaceColorCodes(str) {
    return str
      .replace(
        /\{([A-Fa-f0-9]{6})\}/g,
        (_match, p1) => '<span style="color: #' + p1 + ';">'
      )
      .replace(/\{\/([A-Fa-f0-9]{6})\}/g, "</span>");
  }

  function colorMoneyLine(line) {
    return line
      .replace(
        /向您的银行账户转账了 (\$\d+(?:,\d{3})*(?:\.\d{1,3})?)/,
        '<span class="white">向您的银行账户转账了 </span><span class="green">$$$1</span>'
      )
      .replace(
        /from (.+) on your bank account\./,
        '<span class="white">from </span><span class="white">$1</span><span class="white"> on your bank account.</span>'
      );
  }

  function colorPhoneLine(line) {
    return line
      .replace(/\[手机\]/, '<span class="white">$&</span>')
      .replace(
        /您的 (.+?) 响了/,
        '<span class="white">您的 </span><span class="yellow">$1</span><span class="white"> 响了</span>'
      )
      .replace(
        /\(来自号码: ([^()]+)\)/,
        '<span class="white">(来自号码: </span><span class="white">$1</span><span class="white">)</span>'
      )
      .replace(/\/pickup/, '<span class="green">$&</span>')
      .replace(/\/hangup/, '<span class="yellow">$&</span>')
      .replace(/(使用手机界面进行操作\.)/, '<span class="white">$1</span>');
  }

  function colorLocationLine(line) {
    return line.replace(
      /(您收到了新的位置信息, 来自) (#\d+)(, 输入 )(\/removelocation)( 来清除地图 GPS 标记\.)/,
      '<span class="green">$1 </span>' +
      '<span class="yellow">$2</span>' +
      '<span class="green">$3</span>' +
      '<span class="death">$4</span>' +
      '<span class="green">$5</span>'
    );
  }

 function colorInfoLine(line) {
    const datePattern = /\[信息\]:\s\[(\d{2})\/([A-Z]{3})\/(\d{4})\]\s(.+)/;
    if (datePattern.test(line)) {
      return applyDatePattern(line);
    }
    let formattedLine = line.replace(
      /^\[信息\]/,
      '<span class="blue">[信息]</span>'
    );
    formattedLine = applyPhoneRequestFormatting(formattedLine);
    formattedLine = applyContactShareFormatting(formattedLine);
    formattedLine = applyNumberShareFormatting(formattedLine);
    formattedLine = applyContactSharedFormatting(formattedLine);

    return formattedLine;
  }

  function applyDatePattern(line) {
    return line.replace(
      /\[信息\]:\s\[(\d{2})\/([A-Z]{3})\/(\d{4})\]\s(.+)/,
      '<span class="blue">[信息]:</span> <span class="orange">[$1/$2/$3]</span> <span class="white">$4</span>'
    );
  }

  function applyPhoneRequestFormatting(line) {
    return line.replace(
      /(.+?)\s请求将他的主手机电话号码\s\(#(.+?)\)\s分享给您,\s署名为:\s(.+?),\s输入\s(\/acceptnumber)\s来将其加入您的通讯录, 或\s(\/declinenumber)\s来拒绝该请求!/,
      '<span class="yellow">$1</span> <span class="white">请求将他的主手机电话号码 (</span><span class="green">#$2</span><span class="white">) 分享给您, 署名为: </span><span class="yellow">$3</span><span class="white">, 输入 </span><span class="blue">$4</span><span class="white"> 来将其加入您的通讯录, 或 </span><span class="blue">$5</span><span class="white"> 来拒绝该请求!</span>'
    );
  }

  function applyContactShareFormatting(line) {
    return line.replace(
      /(.+?)\s分享了他的手机联系人\s(.+?)\s\(#(.+?)\)\s给您!\s输入\s(\/acceptcontact)\s来将该联系人保存至您的手机, 或输入\s(\/declinecontact)\s来拒绝该请求!/,
      '<span class="yellow">$1</span> <span class="white">分享了他的手机联系人 </span><span class="white">$2</span> <span class="white">(</span><span class="yellow">#$3</span><span class="white">)</span><span class="white"> 给您! 输入 </span><span class="yellow">$4</span><span class="white"> 来将该联系人保存至您的手机, 或输入 </span><span class="yellow">$5</span><span class="white"> 来拒绝该请求!</span>'
    );
  }

  function applyNumberShareFormatting(line) {
    return line.replace(
      /您请求将主手机的电话号码\s\(#(.+?)\)\s分享给\s(.+?)\s并署名:\s(.+?)\./,
      '<span class="white">您请求将主手机的电话号码 (</span><span class="green">#$1</span><span class="white">) 分享给 </span><span class="yellow">$2</span><span class="white"> 并署名: </span><span class="yellow">$3</span>'
    );
  }

  function applyContactSharedFormatting(line) {
    return line.replace(
      /您已将手机联系人\s(.+?)\s\(#(.+?)\)\s分享给\s(.+?)!/,
      '<span class="white">您已将手机联系人 </span><span class="yellow">$1</span><span class="white"> (</span><span class="yellow">#$2</span><span class="white">) 分享给 </span><span class="yellow">$3</span><span class="white">!</span>'
    );
  }

  function formatRobbery(line) {
    return line
        .replace(/\/arob/, '<span class="blue">/arob</span>')
        .replace(/\/report/, '<span class="death">/report</span>')
        .replace(/You're being robbed, use (.+?) to show your inventory/, '<span class="white">You\'re being robbed, use </span><span class="blue">$1</span><span class="white"> to show your inventory</span>');
}


  function formatPhoneSet(line) {
    return line.replace(/(#\d+)/, '<span class="blue">$1</span>');
  }

  function formatSmsSent(line) {
    return line
        .replace(/sent/, '<span class="death">sent</span>')
        .replace(/\[(#[^\]]+)\]/, '[<span class="green">$1</span>]')
        .replace(/on (.+?) \[/, 'on <span class="yellow">$1</span> [');
}

function formatSmsReceived(line) {
  return line
      .replace(/received/, '<span class="green">received</span>')
      .replace(/\[(#[^\]]+)\]/, '[<span class="green">$1</span>]')
      .replace(/your (.+?) \[/, 'your <span class="yellow">$1</span> [');
}

  function formatDrugCut(line) {
    const drugCutPattern = /You've cut (.+?) x(\d+) into x(\d+)\./i;
    const match = line.match(drugCutPattern);
  
    if (match) {
      const drugName = match[1];
      const firstAmount = match[2];
      const secondAmount = match[3];
  
      return (
        `<span class="white">You've cut </span>` +
        `<span class="blue">${drugName}</span>` +
        `<span class="blue"> x${firstAmount}</span>` +
        `<span class="white"> into </span><span class="blue">x${secondAmount}</span>` +
        `<span class="blue">.</span>`
      );
    }
  }

  function formatPropertyRobbery(line) {
    const robberyPattern = /\[PROPERTY ROBBERY\](.*?)(\$[\d,]+)(.*)/;
    const match = line.match(robberyPattern);
  
    if (match) {
      const textBeforeAmount = match[1];
      const amount = match[2];
      const textAfterAmount = match[3];
  
      return `<span class="green">[PROPERTY ROBBERY]</span>${textBeforeAmount}<span class="green">${amount}</span>${textAfterAmount}`;
    }
  
    return line;
  }

 function formatVesselTraffic(line) {
    const vesselTrafficPattern = /\*\*\s*\[CH: VTS - 船舶交通服务\]/;

    if (vesselTrafficPattern.test(line)) {
      return `<span class="vesseltraffic">${line}</span>`;
    }

    return line;
  }

function addLineBreaksAndHandleSpans(text) {
  const maxLineLength = 77;
  let result = "";
  let currentLineLength = 0;
  let inSpan = false;
  let currentSpan = "";

  function addLineBreak() {
    if (inSpan) {
      result +=
        '</span><br><span class="' +
        currentSpan.match(/class="([^"]+)"/)[1] +
        '">';
    } else {
      result += "<br>";
    }
    currentLineLength = 0;
  }

  for (let i = 0; i < text.length; i++) {
    if (text[i] === "<" && text.substr(i, 5) === "<span") {
      let spanEnd = text.indexOf(">", i);
      currentSpan = text.substring(i, spanEnd + 1);
      i = spanEnd;
      inSpan = true;
      result += currentSpan;
    } else if (text[i] === "<" && text.substr(i, 7) === "</span>") {
      inSpan = false;
      result += "</span>";
      i += 6;
    } else {
      result += text[i];
      currentLineLength++;

      if (currentLineLength >= maxLineLength && text[i] === " ") {
        addLineBreak();
      }
    }
  }

  return result;
}

function cleanUp() {
  $output.find(".generated").each(function () {
    let html = $(this).html();
    html = html.replace(/<br>\s*<br>/g, "<br>");
    html = html.replace(/^<br>|<br>$/g, "");
    html = html.replace(/<span[^>]*>\s*<\/span>/g, "");
    $(this).html(html);
  });
  applyStyles();
}

function applyStyles() {
  $(".generated:first").css({
    "margin-top": "0",
    "padding-top": "1px",
  });
  $(".generated:last").css({
    "padding-bottom": "1px",
    "margin-bottom": "0",
  });
  $(".generated").css("background-color", "transparent");

  if (applyBackground) {
    $(".generated").css("background-color", "#000000");
  }
}

processOutput();
});