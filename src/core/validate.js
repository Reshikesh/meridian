/* Meridian core — validation.
   Pure: no DOM, no storage, no clock of its own (the caller passes `now`).

   Two callers with opposite obligations, so two sets of rules.

   CREATION (the sheets and the quick-add row) is strict: it refuses anything the
   product forbids, before a single byte is written, with a message that goes
   next to the field (QUALITY-BAR §4).

   IMPORT is forgiving about everything except structure. Decision 5 makes the
   workbook a first-class editor, and CLAUDE.md's "nothing may be lost" means a
   row describing hours somebody actually lived is never thrown away for
   breaking a rule the app enforces going forward. So the waking-hours day cap
   and a goal whose date has already passed are creation-path rules only; on
   import they become notes in the report. What import does reject is a row that
   cannot be understood at all: a duration that is not a number, a date that is
   not a date, a foreign key that points nowhere.

   Classic <script src> -> window.Meridian.validate ; CommonJS -> module.exports */
(function (root, factory) {
  var isNode = typeof module === 'object' && module.exports;
  var api = factory(
    isNode ? require('./dates.js') : root.Meridian.dates,
    isNode ? require('./aggregate.js') : root.Meridian.aggregate
  );
  if (isNode) module.exports = api;
  else (root.Meridian = root.Meridian || {}).validate = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (dates, aggregate) {
  'use strict';

  var DIRECTIONS = ['more', 'less', 'upkeep'];
  var THEMES = ['paper', 'graphite', 'blueprint'];
  var TARGET_UNITS = ['h'];              // decision 14: hours only in v1
  var HEX = /^#[0-9a-fA-F]{6}$/;

  /* ---------- cell coercion (import) ----------
     Each returns { ok, value } or { ok: false, reason }. `raw` arrives exactly
     as SheetJS read it: a string, a number, a boolean, or null. */

  function blank(v) {
    return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
  }

  function asText(v, field, opts) {
    if (blank(v)) {
      if (opts && opts.required) return { ok: false, reason: field + ' is blank' };
      return { ok: true, value: null };
    }
    return { ok: true, value: String(v).trim() };
  }

  function asId(v, field, opts) {
    var t = asText(v, field, opts);
    if (!t.ok || t.value === null) return t;
    if (/\s/.test(t.value)) return { ok: false, reason: field + ' "' + t.value + '" contains a space' };
    return t;
  }

  function asNumber(v, field, opts) {
    if (blank(v)) {
      if (opts && opts.required) return { ok: false, reason: field + ' is blank' };
      return { ok: true, value: null };
    }
    var n = typeof v === 'number' ? v : Number(String(v).trim());
    if (!isFinite(n)) return { ok: false, reason: field + ' "' + v + '" is not a number' };
    if (opts && opts.min !== undefined && n < opts.min) {
      return { ok: false, reason: field + ' must be ' + (opts.min === 0 ? 'zero or more' : 'more than ' + (opts.min - 1)) };
    }
    return { ok: true, value: Math.round(n * 100) / 100 };
  }

  function asInteger(v, field, opts) {
    if (blank(v)) {
      if (opts && opts.required) return { ok: false, reason: field + ' is blank' };
      return { ok: true, value: null };
    }
    var n = typeof v === 'number' ? v : Number(String(v).trim());
    if (!isFinite(n)) return { ok: false, reason: field + ' "' + v + '" is not a whole number' };
    if (n !== Math.round(n)) {
      return { ok: false, reason: field + ' "' + v + '" is not a whole number' };
    }
    if (opts && opts.min !== undefined && n < opts.min) {
      return { ok: false, reason: field + ' must be ' + (opts.min > 0 ? 'greater than ' + (opts.min - 1) : 'zero or more') };
    }
    if (opts && opts.max !== undefined && n > opts.max) {
      return { ok: false, reason: field + ' must be ' + opts.max + ' or less' };
    }
    return { ok: true, value: n };
  }

  function asBool(v, field) {
    if (blank(v)) return { ok: true, value: false };
    if (typeof v === 'boolean') return { ok: true, value: v };
    var s = String(v).trim().toUpperCase();
    if (s === 'TRUE' || s === '1' || s === 'YES') return { ok: true, value: true };
    if (s === 'FALSE' || s === '0' || s === 'NO') return { ok: true, value: false };
    return { ok: false, reason: field + ' "' + v + '" must be TRUE or FALSE' };
  }

  function asEnum(v, field, allowed, opts) {
    var t = asText(v, field, opts);
    if (!t.ok || t.value === null) return t;
    var s = t.value.toLowerCase();
    if (allowed.indexOf(s) === -1) {
      return { ok: false, reason: field + ' "' + t.value + '" must be ' + allowed.join(', ') };
    }
    return { ok: true, value: s };
  }

  /* ISO text is the contract, but Excel converts a retyped date cell into a
     serial number, and the friend is invited to retype. `parseSerial` is handed
     in by workbook.js from SheetJS; it carries no timezone, unlike reading the
     cell as a Date. */
  function asDayKey(v, field, opts) {
    if (blank(v)) {
      if (opts && opts.required) return { ok: false, reason: field + ' is blank' };
      return { ok: true, value: null };
    }
    if (typeof v === 'number' && opts && opts.parseSerial) {
      var fromSerial = opts.parseSerial(v);
      if (fromSerial) return { ok: true, value: fromSerial };
      return { ok: false, reason: field + ' "' + v + '" is not a date' };
    }
    var s = String(v).trim();
    var d = dates.parseDayKey(s);
    if (!d) return { ok: false, reason: field + ' "' + s + '" is not an ISO date (YYYY-MM-DD)' };
    return { ok: true, value: dates.dayKey(d) };
  }

  function asDateTime(v, field, opts) {
    if (blank(v)) {
      if (opts && opts.required) return { ok: false, reason: field + ' is blank' };
      return { ok: true, value: null };
    }
    if (typeof v === 'number' && opts && opts.parseSerial) {
      var day = opts.parseSerial(v);
      return day ? { ok: true, value: day + 'T00:00:00' } : { ok: false, reason: field + ' "' + v + '" is not a date and time' };
    }
    var s = String(v).trim();
    if (dates.isIsoDateTime(s)) return { ok: true, value: s.length === 16 ? s + ':00' : s };
    if (dates.parseDayKey(s)) return { ok: true, value: s + 'T00:00:00' };
    return { ok: false, reason: field + ' "' + s + '" is not a date and time' };
  }

  function asColour(v, field, opts) {
    var t = asText(v, field, opts);
    if (!t.ok || t.value === null) return t;
    if (!HEX.test(t.value)) {
      return { ok: false, reason: field + ' "' + t.value + '" is not a colour like #2b4a7d' };
    }
    return { ok: true, value: t.value.toLowerCase() };
  }

  /* ---------- creation-path rules ----------
     Each returns { ok, errors: [{ field, message }] }. The message is the exact
     text shown next to the field, so it is written as a sentence. */

  function fail(field, message) {
    return { field: field, message: message };
  }

  function result(errors) {
    return { ok: errors.length === 0, errors: errors };
  }

  function findById(list, id) {
    for (var i = 0; i < (list || []).length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* Business rule §8.17 / decision 17: a day may not exceed the waking hours.
     Cross-row, so it takes the whole state — and the entry being edited is
     excluded from the day's running total, or raising a 2 h entry to 2.5 h would
     be measured as if both existed. */
  function dayCapCheck(state, dayKey, addedMinutes, excludeId) {
    var capMinutes = aggregate.wakingMinutesPerDay(state.settings);
    var used = 0;
    var entries = state.entries || [];
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].date === dayKey && entries[i].id !== excludeId) {
        used += Number(entries[i].duration_min) || 0;
      }
    }
    var total = used + (Number(addedMinutes) || 0);
    return {
      ok: total <= capMinutes,
      capMinutes: capMinutes,
      usedMinutes: used,
      remainingMinutes: Math.max(0, capMinutes - used),
      totalMinutes: total
    };
  }

  function validateEntry(input, state, opts) {
    var errors = [];
    var now = (opts && opts.now) || new Date();
    var todayKey = dates.dayKey(dates.logicalDay(now));
    var excludeId = (opts && opts.excludeId) || null;

    var day = dates.parseDayKey(input.date);
    if (!day) errors.push(fail('date', 'Pick a day.'));
    else if (input.date > todayKey) errors.push(fail('date', 'You cannot log a day that has not happened.'));

    var minutes = input.duration_min;
    if (blank(minutes)) {
      errors.push(fail('duration_min', 'Enter how long it took.'));
    } else if (typeof minutes !== 'number' || !isFinite(minutes) || minutes !== Math.round(minutes)) {
      errors.push(fail('duration_min', 'Use a number of minutes.'));
    } else if (minutes <= 0) {
      errors.push(fail('duration_min', 'A duration has to be more than zero.'));
    }

    var category = findById(state.categories, input.category_id);
    if (!input.category_id) errors.push(fail('category_id', 'Pick a category.'));
    else if (!category) errors.push(fail('category_id', 'That category no longer exists.'));
    else if (category.archived && !excludeId) errors.push(fail('category_id', 'That category is archived.'));

    if (input.goal_id) {
      var goal = findById(state.goals, input.goal_id);
      if (!goal) {
        errors.push(fail('goal_id', 'That goal no longer exists.'));
      } else if (category && goal.category_id !== category.id) {
        /* Business rule §8.2: a goal lives inside one category. */
        var feeder = findById(state.categories, goal.category_id);
        errors.push(fail('goal_id', goal.short_name + ' is fed by ' +
          (feeder ? feeder.name : 'another category') + '.'));
      }
    }

    if (day && typeof minutes === 'number' && minutes > 0 && !errors.length) {
      var cap = dayCapCheck(state, input.date, minutes, excludeId);
      if (!cap.ok) {
        errors.push(fail('duration_min', 'That puts ' + dates.formatLong(day) + ' over ' +
          aggregate.wakingHoursPerDay(state.settings) + ' h. ' +
          aggregate.formatHours(cap.remainingMinutes) + ' h left.'));
      }
    }

    return result(errors);
  }

  function validateCategory(input, state, opts) {
    var errors = [];
    var excludeId = (opts && opts.excludeId) || null;

    var name = blank(input.name) ? '' : String(input.name).trim();
    if (!name) {
      errors.push(fail('name', 'Give it a name.'));
    } else {
      var clash = (state.categories || []).some(function (c) {
        return c.id !== excludeId && c.name.trim().toLowerCase() === name.toLowerCase();
      });
      if (clash) errors.push(fail('name', 'You already have a category with that name.'));
    }

    if (DIRECTIONS.indexOf(input.direction) === -1) {
      errors.push(fail('direction', 'Pick a direction.'));
    }

    if (!blank(input.colour) && !HEX.test(String(input.colour))) {
      errors.push(fail('colour', 'Pick a colour.'));
    }

    var plan = input.weekly_plan_hours;
    if (!blank(plan)) {
      var n = Number(plan);
      if (!isFinite(n) || n < 0) errors.push(fail('weekly_plan_hours', 'Planned hours cannot be negative.'));
    }

    /* Business rule §8.3: only More categories carry goals, so a category that
       feeds one cannot quietly stop being More. */
    if (excludeId && input.direction !== 'more') {
      var fed = (state.goals || []).filter(function (g) {
        return !g.archived && g.category_id === excludeId;
      });
      if (fed.length) {
        errors.push(fail('direction', 'This category feeds ' + fed[0].short_name +
          (fed.length > 1 ? ' and ' + (fed.length - 1) + ' more' : '') + '. Only More categories carry goals.'));
      }
    }

    return result(errors);
  }

  function validateGoal(input, state, opts) {
    var errors = [];
    var now = (opts && opts.now) || new Date();
    var todayKey = dates.dayKey(dates.logicalDay(now));

    if (blank(input.short_name)) errors.push(fail('short_name', 'Give it a short name.'));

    var category = findById(state.categories, input.category_id);
    if (!input.category_id) errors.push(fail('category_id', 'Pick the category that feeds it.'));
    else if (!category) errors.push(fail('category_id', 'That category no longer exists.'));
    else if (category.direction !== 'more') errors.push(fail('category_id', 'Only More categories can carry goals.'));
    else if (category.archived) errors.push(fail('category_id', 'That category is archived.'));

    var target = input.target_amount;
    if (blank(target)) {
      errors.push(fail('target_amount', 'How many hours does it need?'));
    } else {
      var n = Number(target);
      if (!isFinite(n)) errors.push(fail('target_amount', 'Use a number of hours.'));
      else if (n <= 0) errors.push(fail('target_amount', 'Hours needed has to be more than zero.'));
    }

    if (input.target_unit && TARGET_UNITS.indexOf(input.target_unit) === -1) {
      errors.push(fail('target_unit', 'Goals are measured in hours.'));
    }

    var by = dates.parseDayKey(input.by_date);
    if (!input.by_date) errors.push(fail('by_date', 'Pick a date.'));
    else if (!by) errors.push(fail('by_date', 'That is not a date.'));
    else if (input.by_date <= todayKey) errors.push(fail('by_date', 'Pick a date in the future.'));

    return result(errors);
  }

  /* Business rule §8.10: delete only clears categories with no hours. */
  function canDeleteCategory(state, categoryId) {
    var minutes = 0;
    var entries = state.entries || [];
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].category_id === categoryId) minutes += Number(entries[i].duration_min) || 0;
    }
    return { ok: minutes === 0, minutes: minutes };
  }

  return {
    DIRECTIONS: DIRECTIONS,
    THEMES: THEMES,
    TARGET_UNITS: TARGET_UNITS,
    HEX: HEX,
    blank: blank,
    asText: asText,
    asId: asId,
    asNumber: asNumber,
    asInteger: asInteger,
    asBool: asBool,
    asEnum: asEnum,
    asDayKey: asDayKey,
    asDateTime: asDateTime,
    asColour: asColour,
    dayCapCheck: dayCapCheck,
    validateEntry: validateEntry,
    validateCategory: validateCategory,
    validateGoal: validateGoal,
    canDeleteCategory: canDeleteCategory
  };
});
