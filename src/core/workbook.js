/* Meridian core — the workbook.
   Pure: no DOM, no storage, no globals. SheetJS arrives as a PARAMETER, never
   as `window.XLSX` — `require()` of the vendored UMD sets no global in Node, so
   a bare identifier would work in the browser and fail every unit test.

   Seven sheets, spec §7. One header row, string ids, ISO text dates, integer
   minutes, no formulas: the friend opens this in Excel and edits it (decision 5).

   "Round-trips exactly" means app export -> import -> app export. A hand-edited
   file cannot round-trip byte-for-byte and should not: import normalises (`More`
   becomes `more`, stray spaces go, a retyped date comes back from an Excel
   serial) and drops columns it does not know. What is guaranteed is that
   everything the app stores survives the journey unchanged.

   `schema_version`, `app_version` and `exported_at` are stamped at encode time
   and land in the import report. They are not state; holding them would make
   every export differ from the last one for no reason.

   Classic <script src> -> window.Meridian.workbook ; CommonJS -> module.exports */
(function (root, factory) {
  var isNode = typeof module === 'object' && module.exports;
  var api = factory(
    isNode ? require('./dates.js') : root.Meridian.dates,
    isNode ? require('./validate.js') : root.Meridian.validate,
    isNode ? require('./aggregate.js') : root.Meridian.aggregate
  );
  if (isNode) module.exports = api;
  else (root.Meridian = root.Meridian || {}).workbook = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (dates, validate, aggregate) {
  'use strict';

  var SCHEMA_VERSION = 1;
  var APP_VERSION = '1.0.0';

  /* Column order is the spec's. Reading is by header NAME, never by index —
     the friend will reorder columns in Excel and expect it to still work. */
  var SHEETS = [
    { name: 'Meta', columns: ['key', 'value'] },
    { name: 'Settings', columns: ['key', 'value'] },
    { name: 'Categories', columns: ['id', 'name', 'colour', 'direction', 'weekly_plan_hours', 'weekly_cap_hours', 'sort', 'archived', 'archived_on'] },
    { name: 'Goals', columns: ['id', 'short_name', 'identity', 'category_id', 'target_amount', 'target_unit', 'by_date', 'archived'] },
    { name: 'Entries', columns: ['id', 'date', 'duration_min', 'activity', 'category_id', 'goal_id', 'value', 'created_at'] },
    { name: 'Plan', columns: ['category_id', 'planned_hours', 'week_effective_from'] },
    { name: 'Lessons', columns: ['id', 'iso_week', 'date', 'text', 'tags'] }
  ];

  var SETTING_KEYS = ['theme', 'day_boundary', 'sleep_hours_per_day', 'errands_hours_per_week', 'week_start'];

  function defaultSettings() {
    return {
      theme: 'paper',
      day_boundary: '04:00',
      sleep_hours_per_day: aggregate.DEFAULT_SLEEP_HOURS,
      errands_hours_per_week: aggregate.DEFAULT_ERRANDS_HOURS,
      week_start: 'monday'
    };
  }

  function emptyState() {
    return {
      version: SCHEMA_VERSION,
      source: 'empty',
      settings: defaultSettings(),
      categories: [],
      goals: [],
      entries: [],
      plan: [],
      lessons: [],
      exportInfo: { unexported: 0, exported_at: null }
    };
  }

  /* One representation of empty, everywhere: null. Not undefined, not '', not a
     missing key — deep-equal is unforgiving and a workbook cell has only one
     kind of blank. */
  function nul(v) {
    return (v === undefined || v === '' || v !== v) ? null : v;
  }

  function bool(v) {
    return v ? 'TRUE' : 'FALSE';
  }

  function cmp(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
  }

  /* Deterministic order, applied on the way out AND on the way in, so a
     deep-equal comparison of two states is not really a comparison of two
     insertion histories. Nothing is ever ordered by id for display. */
  function canonical(state) {
    var out = {
      version: SCHEMA_VERSION,
      source: state.source,
      settings: state.settings,
      categories: (state.categories || []).slice().sort(function (a, b) {
        return cmp(Number(a.sort) || 0, Number(b.sort) || 0) || cmp(a.id, b.id);
      }),
      goals: (state.goals || []).slice().sort(function (a, b) { return cmp(a.id, b.id); }),
      entries: (state.entries || []).slice().sort(function (a, b) {
        return cmp(a.date, b.date) || cmp(a.id, b.id);
      }),
      plan: (state.plan || []).slice().sort(function (a, b) {
        return cmp(a.week_effective_from, b.week_effective_from) || cmp(a.category_id, b.category_id);
      }),
      lessons: (state.lessons || []).slice().sort(function (a, b) { return cmp(a.id, b.id); }),
      exportInfo: state.exportInfo
    };
    return out;
  }

  /* ---------- state -> rows ---------- */

  function toRows(state, opts) {
    var s = canonical(state);
    var now = (opts && opts.now) || new Date();
    var settings = s.settings || defaultSettings();

    var meta = [
      { key: 'schema_version', value: SCHEMA_VERSION },
      { key: 'app_version', value: (opts && opts.appVersion) || APP_VERSION },
      { key: 'exported_at', value: dates.isoDateTime(now) }
    ];

    var settingRows = SETTING_KEYS.map(function (k) {
      return { key: k, value: nul(settings[k]) };
    });

    return {
      Meta: meta,
      Settings: settingRows,
      Categories: s.categories.map(function (c) {
        return {
          id: c.id,
          name: c.name,
          colour: nul(c.colour),
          direction: c.direction,
          weekly_plan_hours: nul(c.weekly_plan_hours),
          weekly_cap_hours: nul(c.weekly_cap_hours),   // blank stays blank (decision 13)
          sort: nul(c.sort),
          archived: bool(c.archived),
          archived_on: nul(c.archived_on)
        };
      }),
      Goals: s.goals.map(function (g) {
        return {
          id: g.id,
          short_name: g.short_name,
          identity: nul(g.identity),
          category_id: g.category_id,
          target_amount: g.target_amount,
          target_unit: g.target_unit || 'h',
          by_date: g.by_date,
          archived: bool(g.archived)
        };
      }),
      Entries: s.entries.map(function (e) {
        return {
          id: e.id,
          date: e.date,
          duration_min: e.duration_min,
          activity: nul(e.activity),
          category_id: e.category_id,
          goal_id: nul(e.goal_id),
          value: nul(e.value),                          // always blank (decision 10)
          created_at: nul(e.created_at)
        };
      }),
      Plan: s.plan.map(function (p) {
        return {
          category_id: p.category_id,
          planned_hours: p.planned_hours,
          week_effective_from: p.week_effective_from
        };
      }),
      Lessons: s.lessons.map(function (l) {
        return {
          id: l.id,
          iso_week: l.iso_week,
          date: l.date,
          text: l.text,
          tags: (l.tags && l.tags.length) ? l.tags.join(',') : null
        };
      })
    };
  }

  /* ---------- rows -> state ---------- */

  function makeReport() {
    return {
      ok: true,
      fatal: null,
      sheets: [],
      rejects: [],
      notes: [],
      meta: { schema_version: null, app_version: null, exported_at: null },
      counts: { categories: 0, goals: 0, entries: 0, plan: 0, lessons: 0 },
      entryMinutes: 0,
      accepted: 0,
      rejected: 0
    };
  }

  function sheetSummary(report, name, present) {
    var s = { name: name, present: present, accepted: 0, rejected: 0 };
    report.sheets.push(s);
    return s;
  }

  function reject(report, summary, sheet, rowNumber, reason) {
    report.rejects.push({ sheet: sheet, row: rowNumber, reason: reason });
    summary.rejected += 1;
    report.rejected += 1;
  }

  /* Every column the sheet carries that the app does not know. Ignored, but
     said out loud — they are lost on the next export (QUALITY-BAR §6). */
  function noteUnknownColumns(report, name, headers, known) {
    var unknown = (headers || []).filter(function (h) {
      return h && known.indexOf(h) === -1;
    });
    if (unknown.length) {
      report.notes.push(name + ': ignored ' + (unknown.length === 1 ? 'column ' : 'columns ') +
        unknown.join(', ') + ' — not part of the workbook, and not written back on the next export.');
    }
  }

  function readRow(row, spec, ctx, errors) {
    var out = {};
    for (var i = 0; i < spec.length; i++) {
      var f = spec[i];
      var res = f.read(row[f.key], f.key, ctx);
      if (!res.ok) errors.push(res.reason);
      else out[f.key] = res.value;
    }
    return out;
  }

  /* A reference column resolved by id OR by the human name beside it.

     Decision 5 makes the workbook a first-class editor, and the person editing
     it is not technical: the Goals sheet asks for a `category_id` while the
     Categories sheet next door lists eight readable names, so typing `Learning`
     rather than `cat_learn` is the obvious thing to do, not a mistake. Both are
     accepted; the id is what gets stored, so the next export shows the id and
     the file teaches its own convention. */
  function makeResolver(rows, nameKey) {
    var byId = Object.create(null);
    var byName = Object.create(null);
    var ambiguous = Object.create(null);

    rows.forEach(function (r) {
      byId[r.id] = r;
      var n = String(r[nameKey] == null ? '' : r[nameKey]).trim().toLowerCase();
      if (!n) return;
      if (byName[n]) ambiguous[n] = true;
      else byName[n] = r;
    });

    return {
      example: rows.length ? rows[0].id : null,
      get: function (id) { return byId[id] || null; },
      resolve: function (raw) {
        if (raw == null || raw === '') return { ok: false, blank: true };
        if (byId[raw]) return { ok: true, value: raw };
        var n = String(raw).trim().toLowerCase();
        if (ambiguous[n]) return { ok: false, ambiguous: true };
        if (byName[n]) return { ok: true, value: byName[n].id, fromName: true };
        return { ok: false };
      }
    };
  }

  function refError(field, raw, res, resolver, what) {
    if (res.ambiguous) {
      return field + ' "' + raw + '" matches more than one ' + what +
        ' by name — use the id from the ' + what.charAt(0).toUpperCase() + what.slice(1) +
        (what === 'category' ? 'ies' : 's') + ' sheet';
    }
    return field + ' "' + raw + '" is not in the ' +
      (what === 'category' ? 'Categories' : 'Goals') + ' sheet' +
      (resolver.example ? ' — use an id like ' + resolver.example + ', or the exact ' + what + ' name' : '');
  }

  function namedRefNote(report, sheetName, n, what) {
    if (!n) return;
    report.notes.push(sheetName + ': ' + n + (n === 1 ? ' reference named a ' : ' references named a ') +
      what + ' instead of giving its id. Matched by name and saved with the id, so the next export shows the id.');
  }

  function fromRows(sheets, opts) {
    var ctx = { parseSerial: opts && opts.parseSerial };
    var report = makeReport();
    var state = emptyState();
    state.source = 'import';

    /* --- Meta --- */
    var metaRows = sheets.Meta && sheets.Meta.rows;
    if (!metaRows) {
      report.notes.push('Meta: sheet missing — assuming schema version ' + SCHEMA_VERSION + '.');
      sheetSummary(report, 'Meta', false);
    } else {
      sheetSummary(report, 'Meta', true).accepted = metaRows.length;
      metaRows.forEach(function (r) {
        var k = validate.blank(r.key) ? '' : String(r.key).trim();
        if (k === 'schema_version') report.meta.schema_version = Number(r.value);
        if (k === 'app_version') report.meta.app_version = r.value == null ? null : String(r.value);
        if (k === 'exported_at') report.meta.exported_at = r.value == null ? null : String(r.value);
      });
    }

    /* Guarded against NaN and against 0 being falsy: a workbook stamped
       `schema_version 0` is an older workbook, not an absent one. */
    var version = typeof report.meta.schema_version === 'number' &&
      isFinite(report.meta.schema_version) ? report.meta.schema_version : null;
    if (version !== null && version > SCHEMA_VERSION) {
      report.ok = false;
      report.fatal = {
        code: 'schema_newer',
        message: 'This workbook was written by a newer version of Meridian (schema ' +
          version + ', this app reads ' + SCHEMA_VERSION + '). Nothing was changed.'
      };
      return { state: null, report: report };
    }
    if (version !== null && version < SCHEMA_VERSION) {
      report.notes.push('This workbook uses schema ' + version + '; the app is on ' +
        SCHEMA_VERSION + '. It was read with the older rules and will be written back as ' +
        SCHEMA_VERSION + '.');
    }

    /* --- Settings --- */
    var settingsSheet = sheets.Settings;
    var settingsSummary = sheetSummary(report, 'Settings', !!settingsSheet);
    if (!settingsSheet) {
      report.notes.push('Settings: sheet missing — the defaults were used.');
    } else {
      noteUnknownColumns(report, 'Settings', settingsSheet.headers, ['key', 'value']);
      settingsSheet.rows.forEach(function (r, i) {
        var k = validate.blank(r.key) ? '' : String(r.key).trim();
        var rowNo = i + 2;
        if (SETTING_KEYS.indexOf(k) === -1) {
          if (k) report.notes.push('Settings: ignored unknown setting "' + k + '".');
          return;
        }
        var res = readSetting(k, r.value);
        if (!res.ok) reject(report, settingsSummary, 'Settings', rowNo, res.reason);
        else {
          state.settings[k] = res.value;
          settingsSummary.accepted += 1;
          report.accepted += 1;
        }
      });
    }

    /* --- Categories ---
       A workbook with no Categories sheet cannot be read at all: every entry
       and every goal points at one. That is the "import failed" state, not a
       page of rejects. */
    var catSheet = sheets.Categories;
    if (!catSheet || !catSheet.rows.length) {
      report.ok = false;
      report.fatal = {
        code: 'no_categories',
        message: catSheet
          ? 'The Categories sheet is empty. Every entry belongs to a category, so there is nothing to import.'
          : 'This workbook has no Categories sheet, so nothing in it can be read.'
      };
      sheetSummary(report, 'Categories', !!catSheet);
      return { state: null, report: report };
    }

    var catSummary = sheetSummary(report, 'Categories', true);
    noteUnknownColumns(report, 'Categories', catSheet.headers, SHEETS[2].columns);
    var seenCats = Object.create(null);
    catSheet.rows.forEach(function (r, i) {
      var rowNo = i + 2;
      var errors = [];
      var c = readRow(r, [
        { key: 'id', read: function (v, f) { return validate.asId(v, f, { required: true }); } },
        { key: 'name', read: function (v, f) { return validate.asText(v, f, { required: true }); } },
        { key: 'colour', read: function (v, f) { return validate.asColour(v, f); } },
        { key: 'direction', read: function (v, f) { return validate.asEnum(v, f, validate.DIRECTIONS, { required: true }); } },
        { key: 'weekly_plan_hours', read: function (v, f) { return validate.asNumber(v, f, { min: 0 }); } },
        { key: 'weekly_cap_hours', read: function (v, f) { return validate.asNumber(v, f, { min: 0 }); } },
        { key: 'sort', read: function (v, f) { return validate.asInteger(v, f); } },
        { key: 'archived', read: function (v, f) { return validate.asBool(v, f); } },
        { key: 'archived_on', read: function (v, f) { return validate.asDayKey(v, f, ctx); } }
      ], ctx, errors);

      if (!errors.length && seenCats[c.id]) errors.push('id "' + c.id + '" appears twice in this sheet');
      if (errors.length) return reject(report, catSummary, 'Categories', rowNo, errors[0]);

      seenCats[c.id] = true;
      c.weekly_plan_hours = c.weekly_plan_hours === null ? 0 : c.weekly_plan_hours;
      c.sort = c.sort === null ? 0 : c.sort;
      if (c.sort === 0 && r.sort === undefined) {
        /* deliberately quiet: a missing sort column is normal in a hand-made
           sheet and 0 is a valid answer. */
      }
      state.categories.push(c);
      catSummary.accepted += 1;
      report.accepted += 1;
    });

    if (!state.categories.length) {
      report.ok = false;
      report.fatal = {
        code: 'no_categories',
        message: 'Every row of the Categories sheet was rejected, so nothing else can be read.'
      };
      return { state: null, report: report };
    }

    var catIds = Object.create(null);
    state.categories.forEach(function (c) { catIds[c.id] = c; });
    var cats = makeResolver(state.categories, 'name');

    /* --- Goals --- */
    var goalSheet = sheets.Goals;
    var goalSummary = sheetSummary(report, 'Goals', !!goalSheet);
    var goalIds = Object.create(null);
    var namedCatRefs = { Goals: 0, Entries: 0, Plan: 0 };
    var namedGoalRefs = 0;
    if (!goalSheet) {
      report.notes.push('Goals: sheet missing — imported without goals.');
    } else {
      noteUnknownColumns(report, 'Goals', goalSheet.headers, SHEETS[3].columns);
      var pastGoals = 0;
      var todayKey = dates.dayKey(dates.logicalDay((opts && opts.now) || new Date()));
      goalSheet.rows.forEach(function (r, i) {
        var rowNo = i + 2;
        var errors = [];
        var g = readRow(r, [
          { key: 'id', read: function (v, f) { return validate.asId(v, f, { required: true }); } },
          { key: 'short_name', read: function (v, f) { return validate.asText(v, f, { required: true }); } },
          { key: 'identity', read: function (v, f) { return validate.asText(v, f); } },
          /* asText, not asId: this column accepts the category's NAME as well as
             its id, and names have spaces in them. */
          { key: 'category_id', read: function (v, f) { return validate.asText(v, f, { required: true }); } },
          { key: 'target_amount', read: function (v, f) { return validate.asNumber(v, f, { required: true }); } },
          { key: 'target_unit', read: function (v, f) { return validate.asEnum(v, f, validate.TARGET_UNITS); } },
          { key: 'by_date', read: function (v, f) { return validate.asDayKey(v, f, { required: true, parseSerial: ctx.parseSerial }); } },
          { key: 'archived', read: function (v, f) { return validate.asBool(v, f); } }
        ], ctx, errors);

        if (!errors.length) {
          if (goalIds[g.id]) {
            errors.push('id "' + g.id + '" appears twice in this sheet');
          } else {
            var catRef = cats.resolve(g.category_id);
            if (!catRef.ok) {
              errors.push(refError('category_id', g.category_id, catRef, cats, 'category'));
            } else {
              if (catRef.fromName) namedCatRefs.Goals += 1;
              g.category_id = catRef.value;
              if (g.target_amount <= 0) errors.push('target_amount must be more than zero');
            }
          }
        }
        if (errors.length) return reject(report, goalSummary, 'Goals', rowNo, errors[0]);

        g.target_unit = g.target_unit || 'h';
        goalIds[g.id] = g;
        state.goals.push(g);
        goalSummary.accepted += 1;
        report.accepted += 1;
        if (!g.archived && g.by_date < todayKey) pastGoals += 1;
      });
      namedRefNote(report, 'Goals', namedCatRefs.Goals, 'category');
      if (pastGoals) {
        report.notes.push(pastGoals + (pastGoals === 1 ? ' goal has' : ' goals have') +
          ' a date that has already passed. Kept as they are.');
      }
    }

    /* --- Entries --- */
    var goals = makeResolver(state.goals, 'short_name');

    var entrySheet = sheets.Entries;
    var entrySummary = sheetSummary(report, 'Entries', !!entrySheet);
    if (!entrySheet) {
      report.notes.push('Entries: sheet missing — imported without any logged hours.');
    } else {
      noteUnknownColumns(report, 'Entries', entrySheet.headers, SHEETS[4].columns);
      var seenEntries = Object.create(null);
      entrySheet.rows.forEach(function (r, i) {
        var rowNo = i + 2;
        var errors = [];
        var e = readRow(r, [
          { key: 'id', read: function (v, f) { return validate.asId(v, f, { required: true }); } },
          { key: 'date', read: function (v, f) { return validate.asDayKey(v, f, { required: true, parseSerial: ctx.parseSerial }); } },
          { key: 'duration_min', read: function (v, f) { return validate.asInteger(v, f, { required: true, min: 1 }); } },
          { key: 'activity', read: function (v, f) { return validate.asText(v, f); } },
          { key: 'category_id', read: function (v, f) { return validate.asText(v, f, { required: true }); } },
          { key: 'goal_id', read: function (v, f) { return validate.asText(v, f); } },
          { key: 'value', read: function (v, f) { return validate.asInteger(v, f, { min: 1, max: 5 }); } },
          { key: 'created_at', read: function (v, f) { return validate.asDateTime(v, f, ctx); } }
        ], ctx, errors);

        if (!errors.length) {
          if (seenEntries[e.id]) {
            errors.push('id "' + e.id + '" appears twice in this sheet');
          } else {
            var eCat = cats.resolve(e.category_id);
            if (!eCat.ok) {
              errors.push(refError('category_id', e.category_id, eCat, cats, 'category'));
            } else {
              if (eCat.fromName) namedCatRefs.Entries += 1;
              e.category_id = eCat.value;

              if (e.goal_id) {
                var eGoal = goals.resolve(e.goal_id);
                if (!eGoal.ok) {
                  errors.push(refError('goal_id', e.goal_id, eGoal, goals, 'goal'));
                } else {
                  if (eGoal.fromName) namedGoalRefs += 1;
                  e.goal_id = eGoal.value;
                  /* Business rule §8.2: a goal lives inside one category. */
                  if (goalIds[e.goal_id].category_id !== e.category_id) {
                    errors.push('goal_id "' + e.goal_id + '" is fed by ' +
                      catIds[goalIds[e.goal_id].category_id].name + ', but this row is ' +
                      catIds[e.category_id].name);
                  }
                }
              }
            }
          }
        }
        if (errors.length) return reject(report, entrySummary, 'Entries', rowNo, errors[0]);

        seenEntries[e.id] = true;
        state.entries.push(e);
        entrySummary.accepted += 1;
        report.accepted += 1;
        report.entryMinutes += e.duration_min;
      });

      namedRefNote(report, 'Entries', namedCatRefs.Entries, 'category');
      namedRefNote(report, 'Entries', namedGoalRefs, 'goal');

      /* The waking-hours cap is a rule about what you may log from here on, not
         a verdict on days already lived (decision 5). Over-full days are
         reported and kept. */
      var perDay = aggregate.byDay(state.entries);
      var capMinutes = aggregate.wakingMinutesPerDay(state.settings);
      var over = Object.keys(perDay).filter(function (k) { return perDay[k] > capMinutes; });
      if (over.length) {
        over.sort();
        report.notes.push(over.length + (over.length === 1 ? ' day holds' : ' days hold') +
          ' more than ' + aggregate.wakingHoursPerDay(state.settings) + ' h (' +
          over.slice(0, 3).join(', ') + (over.length > 3 ? ', …' : '') +
          '). Kept as logged; new entries on those days will be refused.');
      }
    }

    /* --- Plan --- */
    var planSheet = sheets.Plan;
    var planSummary = sheetSummary(report, 'Plan', !!planSheet);
    if (!planSheet) {
      report.notes.push('Plan: sheet missing — imported without a weekly plan.');
    } else {
      noteUnknownColumns(report, 'Plan', planSheet.headers, SHEETS[5].columns);
      planSheet.rows.forEach(function (r, i) {
        var rowNo = i + 2;
        var errors = [];
        var p = readRow(r, [
          { key: 'category_id', read: function (v, f) { return validate.asText(v, f, { required: true }); } },
          { key: 'planned_hours', read: function (v, f) { return validate.asNumber(v, f, { required: true, min: 0 }); } },
          { key: 'week_effective_from', read: function (v, f) { return validate.asDayKey(v, f, { required: true, parseSerial: ctx.parseSerial }); } }
        ], ctx, errors);

        if (!errors.length) {
          var pCat = cats.resolve(p.category_id);
          if (!pCat.ok) {
            errors.push(refError('category_id', p.category_id, pCat, cats, 'category'));
          } else {
            if (pCat.fromName) namedCatRefs.Plan += 1;
            p.category_id = pCat.value;
            if (dates.weekdayIndex(p.week_effective_from) !== 0) {
              errors.push('week_effective_from "' + p.week_effective_from + '" is not a Monday');
            }
          }
        }
        if (errors.length) return reject(report, planSummary, 'Plan', rowNo, errors[0]);

        state.plan.push(p);
        planSummary.accepted += 1;
        report.accepted += 1;
      });
      namedRefNote(report, 'Plan', namedCatRefs.Plan, 'category');
    }

    /* --- Lessons --- */
    var lessonSheet = sheets.Lessons;
    var lessonSummary = sheetSummary(report, 'Lessons', !!lessonSheet);
    if (!lessonSheet) {
      report.notes.push('Lessons: sheet missing — imported without any lessons.');
    } else {
      noteUnknownColumns(report, 'Lessons', lessonSheet.headers, SHEETS[6].columns);
      var seenLessons = Object.create(null);
      lessonSheet.rows.forEach(function (r, i) {
        var rowNo = i + 2;
        var errors = [];
        var l = readRow(r, [
          { key: 'id', read: function (v, f) { return validate.asId(v, f, { required: true }); } },
          { key: 'iso_week', read: function (v, f) { return validate.asText(v, f, { required: true }); } },
          { key: 'date', read: function (v, f) { return validate.asDayKey(v, f, { required: true, parseSerial: ctx.parseSerial }); } },
          { key: 'text', read: function (v, f) { return validate.asText(v, f, { required: true }); } },
          { key: 'tags', read: function (v, f) { return validate.asText(v, f); } }
        ], ctx, errors);

        if (!errors.length) {
          if (seenLessons[l.id]) errors.push('id "' + l.id + '" appears twice in this sheet');
          else if (!/^\d{4}-W\d{2}$/.test(l.iso_week)) {
            errors.push('iso_week "' + l.iso_week + '" is not an ISO week like 2026-W22');
          }
        }
        if (errors.length) return reject(report, lessonSummary, 'Lessons', rowNo, errors[0]);

        seenLessons[l.id] = true;
        l.tags = l.tags ? l.tags.split(',').map(function (t) { return t.trim(); }).filter(Boolean) : [];
        state.lessons.push(l);
        lessonSummary.accepted += 1;
        report.accepted += 1;
      });
    }

    report.counts = {
      categories: state.categories.length,
      goals: state.goals.length,
      entries: state.entries.length,
      plan: state.plan.length,
      lessons: state.lessons.length
    };

    return { state: canonical(state), report: report };
  }

  function readSetting(key, value) {
    if (key === 'theme') return validate.asEnum(value, 'theme', validate.THEMES, { required: true });
    if (key === 'week_start') return validate.asEnum(value, 'week_start', ['monday'], { required: true });
    if (key === 'day_boundary') {
      var t = validate.asText(value, 'day_boundary', { required: true });
      if (!t.ok) return t;
      if (!/^\d{2}:\d{2}$/.test(t.value)) return { ok: false, reason: 'day_boundary "' + t.value + '" is not a time like 04:00' };
      return t;
    }
    if (key === 'sleep_hours_per_day') return validate.asNumber(value, key, { required: true, min: 0 });
    if (key === 'errands_hours_per_week') return validate.asNumber(value, key, { required: true, min: 0 });
    return validate.asText(value, key);
  }

  /* ---------- SheetJS binding ---------- */

  function encode(XLSX, state, opts) {
    var rows = toRows(state, opts);
    var wb = XLSX.utils.book_new();
    SHEETS.forEach(function (def) {
      /* Every sheet is written, with its header row, even when it has no data:
         a missing sheet on the way back in is a note the friend does not need. */
      var aoa = [def.columns.slice()];
      (rows[def.name] || []).forEach(function (r) {
        aoa.push(def.columns.map(function (c) {
          var v = r[c];
          return v === undefined ? null : v;
        }));
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), def.name);
    });
    return XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellDates: false });
  }

  /* `cellDates: false` matters: read as Dates, SheetJS hands back UTC midnight,
     and local getters then report the day before for every tester west of UTC.
     Serials are decoded through SSF, which has no timezone in it at all. */
  function decode(XLSX, data, opts) {
    /* An .xlsx is a zip, so it starts `PK`. Checked before SheetJS sees
       it because SheetJS does not throw on a text file — it parses it as CSV and
       hands back a workbook with one nonsense sheet, which would then be
       reported as "no Categories sheet" rather than "this is not a workbook". */
    if (!looksLikeXlsx(data)) {
      var bad = makeReport();
      bad.ok = false;
      bad.fatal = { code: 'unreadable', message: 'This file could not be opened as an Excel workbook.' };
      return { state: null, report: bad };
    }

    var wb;
    try {
      wb = XLSX.read(data, { type: 'array', cellDates: false, cellNF: false, cellText: false, raw: true });
    } catch (err) {
      var report = makeReport();
      report.ok = false;
      report.fatal = { code: 'unreadable', message: 'This file could not be opened as an Excel workbook.' };
      return { state: null, report: report };
    }

    var parseSerial = function (n) {
      try {
        var d = XLSX.SSF.parse_date_code(n);
        if (!d || !d.y) return null;
        var made = dates.makeDay(d.y, d.m, d.d);
        return made ? dates.dayKey(made) : null;
      } catch (e) { return null; }
    };

    var sheets = {};
    SHEETS.forEach(function (def) {
      var ws = wb.Sheets[def.name];
      if (!ws) return;
      var aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false });
      var headers = (aoa[0] || []).map(function (h) {
        return h === null || h === undefined ? '' : String(h).trim();
      });
      var rows = [];
      for (var i = 1; i < aoa.length; i++) {
        var row = {};
        for (var c = 0; c < headers.length; c++) {
          if (headers[c]) row[headers[c]] = aoa[i][c] === undefined ? null : aoa[i][c];
        }
        var allBlank = Object.keys(row).every(function (k) { return validate.blank(row[k]); });
        if (!allBlank) rows.push(row);
      }
      sheets[def.name] = { headers: headers, rows: rows };
    });

    return fromRows(sheets, {
      parseSerial: parseSerial,
      now: (opts && opts.now) || new Date()
    });
  }

  function looksLikeXlsx(data) {
    var bytes;
    try {
      bytes = data instanceof Uint8Array ? data : new Uint8Array(
        data.buffer ? data.buffer.slice(data.byteOffset, data.byteOffset + 4) : data);
    } catch (e) { return false; }
    return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b &&
      bytes[2] === 0x03 && bytes[3] === 0x04;
  }

  /* Date only, never a datetime: Chromium rewrites `:` in a download filename,
     so `09:12:00` would reach the disk as `09_12_00`. */
  function exportFilename(now) {
    return 'meridian-data-' + dates.dayKey(dates.logicalDay(now || new Date())) + '.xlsx';
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    APP_VERSION: APP_VERSION,
    SHEETS: SHEETS,
    SETTING_KEYS: SETTING_KEYS,
    defaultSettings: defaultSettings,
    emptyState: emptyState,
    canonical: canonical,
    toRows: toRows,
    fromRows: fromRows,
    encode: encode,
    decode: decode,
    exportFilename: exportFilename
  };
});
