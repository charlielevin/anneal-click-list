(function () {
  "use strict";

  var storageKey = "anneal-click-list-values-v1";
  var defaults = {
    naturalInput: "900C for 2 hr",
    targetTemp: 900,
    holdTime: 2,
    holdUnit: "hours",
    rampRate: 10,
    cooldownTarget: 20,
    programNumber: 1,
    currentPv: 50
  };

  var fields = {
    naturalInput: document.getElementById("naturalInput"),
    targetTemp: document.getElementById("targetTemp"),
    holdTime: document.getElementById("holdTime"),
    holdUnit: document.getElementById("holdUnit"),
    rampRate: document.getElementById("rampRate"),
    cooldownTarget: document.getElementById("cooldownTarget"),
    programNumber: document.getElementById("programNumber"),
    currentPv: document.getElementById("currentPv")
  };

  var parseStatus = document.getElementById("parseStatus");
  var warnings = document.getElementById("warnings");
  var parameterList = document.getElementById("parameterList");
  var conversionNote = document.getElementById("conversionNote");
  var clickList = document.getElementById("clickList");
  var verifyList = document.getElementById("verifyList");
  var etaOutput = document.getElementById("etaOutput");

  function readStoredValues() {
    try {
      var stored = JSON.parse(localStorage.getItem(storageKey));
      return stored && typeof stored === "object" ? stored : {};
    } catch (error) {
      return {};
    }
  }

  function numberValue(id) {
    var value = Number(fields[id].value);
    return Number.isFinite(value) ? value : 0;
  }

  function currentValues() {
    return {
      naturalInput: fields.naturalInput.value,
      targetTemp: numberValue("targetTemp"),
      holdTime: numberValue("holdTime"),
      holdUnit: fields.holdUnit.value,
      rampRate: numberValue("rampRate"),
      cooldownTarget: numberValue("cooldownTarget"),
      programNumber: Math.round(numberValue("programNumber")),
      currentPv: numberValue("currentPv")
    };
  }

  function saveValues(values) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(values));
    } catch (error) {
      // The app still works if storage is blocked.
    }
  }

  function setFields(values) {
    Object.keys(defaults).forEach(function (key) {
      fields[key].value = values[key];
    });
  }

  function formatHours(hours) {
    if (!Number.isFinite(hours)) {
      return "0";
    }
    if (Math.abs(hours - Math.round(hours)) < 0.0001) {
      return hours.toFixed(1);
    }
    return String(Number(hours.toFixed(3)));
  }

  function parseNaturalText(text) {
    var clean = text.toLowerCase().replace(/°/g, "").replace(/,/g, " ");
    var temp = null;
    var tempPatterns = [
      /(\d+(?:\.\d+)?)\s*(?:c|deg|degree|degrees)\b/,
      /(?:c|deg|degree|degrees)\s*(\d+(?:\.\d+)?)\b/
    ];

    tempPatterns.some(function (pattern) {
      var match = clean.match(pattern);
      if (match) {
        temp = Number(match[1]);
        return true;
      }
      return false;
    });

    if (temp === null) {
      var numbers = clean.match(/\d+(?:\.\d+)?/g) || [];
      var largeNumber = numbers.map(Number).find(function (value) {
        return value > 100;
      });
      if (largeNumber !== undefined) {
        temp = largeNumber;
      }
    }

    var timeMatch = clean.match(/(\d+(?:\.\d+)?)\s*(hr|hrs|hour|hours|h|min|mins|minute|minutes|m)\b/);
    var time = timeMatch ? Number(timeMatch[1]) : null;
    var unit = null;
    if (timeMatch) {
      unit = /^m/.test(timeMatch[2]) ? "minutes" : "hours";
    }

    return {
      targetTemp: temp,
      holdTime: time,
      holdUnit: unit,
      complete: Number.isFinite(temp) && Number.isFinite(time) && Boolean(unit)
    };
  }

  function applyParsedText() {
    var text = fields.naturalInput.value.trim();
    parseStatus.textContent = "";
    parseStatus.classList.remove("error");
    if (!text) {
      return;
    }

    var parsed = parseNaturalText(text);
    if (Number.isFinite(parsed.targetTemp)) {
      fields.targetTemp.value = parsed.targetTemp;
    }
    if (Number.isFinite(parsed.holdTime)) {
      fields.holdTime.value = parsed.holdTime;
    }
    if (parsed.holdUnit) {
      fields.holdUnit.value = parsed.holdUnit;
    }

    if (parsed.complete) {
      parseStatus.textContent = "Parsed: " + parsed.targetTemp + "C for " + parsed.holdTime + " " + parsed.holdUnit + ".";
    } else {
      parseStatus.textContent = "Could not fully parse. Please use manual fields.";
      parseStatus.classList.add("error");
    }
  }

  function buildWarnings(values) {
    var result = [];
    if (values.targetTemp > 1200) {
      result.push("Warning: Confirm this furnace/tube/sample setup is rated above this temperature.");
    }
    if (values.targetTemp < 20) {
      result.push("Warning: Target temperature is below 20C.");
    }
    if (values.holdTime <= 0) {
      result.push("Warning: Hold time must be greater than 0.");
    }
    if (values.rampRate <= 0) {
      result.push("Warning: Ramp rate must be greater than 0.");
    }
    return result;
  }

  function renderWarnings(items) {
    warnings.innerHTML = "";
    warnings.classList.toggle("visible", items.length > 0);
    items.forEach(function (item) {
      var div = document.createElement("div");
      div.textContent = item;
      warnings.appendChild(div);
    });
  }

  function parameterText(values, dwellHours) {
    return [
      "Pnr = " + values.programNumber,
      "",
      "Pr1 = " + values.rampRate + "     ramp rate up, C/min",
      "PL1 = " + values.targetTemp + "    anneal target, C",
      "Pd1 = " + formatHours(dwellHours) + "    dwell time, hours",
      "",
      "Pr2 = " + values.rampRate + "     ramp rate down, C/min",
      "PL2 = " + values.cooldownTarget + "     cooldown target, C",
      "Pd2 = 0",
      "",
      "Pr3 = END"
    ].join("\n");
  }

  function renderConversion(values, dwellHours) {
    if (values.holdUnit !== "minutes") {
      conversionNote.classList.remove("visible");
      conversionNote.textContent = "";
      return;
    }
    conversionNote.classList.add("visible");
    conversionNote.innerHTML = "<strong>Note:</strong><br>" +
      values.holdTime + " min / 60 = " + formatHours(dwellHours) + " hr.<br>" +
      "Enter " + formatHours(dwellHours) + " on the controller, not " + values.holdTime + ".";
  }

  function renderClickList(values, dwellHours) {
    var steps = [
      "Hold P until Pnr appears.",
      "Set Pnr = " + values.programNumber + " using Up / Down if needed.",
      "Press P once. Screen should show Pr1. Set Pr1 = " + values.rampRate + ".",
      "Press P once. Screen should show PL1. Set PL1 = " + values.targetTemp + ".",
      "Press P once. Screen should show Pd1. Set Pd1 = " + formatHours(dwellHours) + " hours.",
      "Press P once. Screen should show Pr2. Set Pr2 = " + values.rampRate + ".",
      "Press P once. Screen should show PL2. Set PL2 = " + values.cooldownTarget + ".",
      "Press P once. Screen should show Pd2. Set Pd2 = 0.",
      "Press P once. Screen should show Pr3. Use Up / Down until it says END.",
      "Press RUN/HOLD to start the program.",
      "While running, only tap the center display button to view PV / SP / OP / TIME. Do not press Up / Down while running unless intentionally editing."
    ];

    clickList.innerHTML = "";
    steps.forEach(function (step) {
      var li = document.createElement("li");
      li.textContent = step;
      clickList.appendChild(li);
    });
  }

  function renderVerify(values, dwellHours) {
    verifyList.innerHTML = [
      "<p><strong>During heat-up:</strong><br>RAMP 1 should be displayed. PV = actual furnace temperature, should climb. SP = setpoint, should climb toward " + values.targetTemp + "C. OP = output %, often near 100% during ramp.</p>",
      "<p><strong>At target:</strong><br>Controller should automatically switch to DWELL 1 / HOLD. PV should be close to " + values.targetTemp + "C. SP should be close to " + values.targetTemp + "C. TIME should show about " + formatHours(dwellHours) + ".</p>",
      "<p><strong>After dwell:</strong><br>Controller should automatically move to RAMP 2. Then cool toward " + values.cooldownTarget + "C. At the end, it should show END.</p>"
    ].join("");
  }

  function renderEta(values) {
    var remaining = values.targetTemp - values.currentPv;
    if (values.rampRate <= 0) {
      etaOutput.innerHTML = "<p>Enter a ramp rate greater than 0 to estimate ETA.</p>";
      return;
    }
    if (remaining <= 0) {
      etaOutput.innerHTML = "<p>Current PV is already at or above the target.</p>";
      return;
    }
    var etaMinutes = remaining / values.rampRate;
    var etaHours = etaMinutes / 60;
    etaOutput.innerHTML = [
      "<p>Current PV = " + values.currentPv + "C<br>Target = " + values.targetTemp + "C<br>Ramp rate = " + values.rampRate + "C/min</p>",
      "<p>Remaining = " + Number(remaining.toFixed(2)) + "C<br>ETA = " + Number(etaMinutes.toFixed(1)) + " min<br>ETA = " + Number(etaHours.toFixed(2)) + " hr</p>"
    ].join("");
  }

  function renderAll() {
    var values = currentValues();
    var dwellHours = values.holdUnit === "minutes" ? values.holdTime / 60 : values.holdTime;
    saveValues(values);
    renderWarnings(buildWarnings(values));
    parameterList.textContent = parameterText(values, dwellHours);
    renderConversion(values, dwellHours);
    renderClickList(values, dwellHours);
    renderVerify(values, dwellHours);
    renderEta(values);
  }

  function handleInput(event) {
    if (event.target === fields.naturalInput) {
      applyParsedText();
    }
    renderAll();
  }

  function applyPreset(button) {
    fields.targetTemp.value = button.dataset.presetTemp;
    fields.holdTime.value = button.dataset.presetTime;
    fields.holdUnit.value = button.dataset.presetUnit;
    fields.naturalInput.value = button.textContent.replace(",", " for");
    applyParsedText();
    renderAll();
  }

  setFields(Object.assign({}, defaults, readStoredValues()));
  applyParsedText();
  renderAll();

  Object.keys(fields).forEach(function (key) {
    fields[key].addEventListener("input", handleInput);
    fields[key].addEventListener("change", handleInput);
  });

  document.querySelectorAll(".preset").forEach(function (button) {
    button.addEventListener("click", function () {
      applyPreset(button);
    });
  });
})();
