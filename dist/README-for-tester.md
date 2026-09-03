# Meridian — a few days of your time

Thank you for trying this. It is a small, private time tracker. It runs entirely
on your own computer: there is no account, no server, and nothing leaves your
machine unless you send it to me yourself.

What I am hoping for is a few ordinary days of use and then your honest
reaction. Notes at the end of this file on what would help most.

---

## Opening it

1. Unzip the folder somewhere you will find again — Desktop or Documents is fine.
2. Open the folder and **double-click `index.html`**.

It opens in your browser and that is the whole installation. There is nothing to
install and nothing to sign into.

**Use Chrome or Edge if you can**; Firefox works too. Keep it in one browser
rather than moving between them — see *Where your data lives* below.

You can close the tab and come back whenever you like. Everything you have
logged is still there.

---

## The one rule that will surprise you

**The day changes over at 4 a.m., not midnight.**

So something you log at 1 a.m. on Tuesday counts as Monday, because that is the
day you were actually still living. If you log late at night and the date looks
wrong, this is why, and it is deliberate.

---

## Logging

Open **Log**. The strip near the top is the fast way in, and it is built for the
keyboard:

| Field | What goes in it |
|---|---|
| How long | `1.5`, `1.5h` or `90m` — all mean the same thing |
| What did you do? | Optional. A few words |
| Category | Where the time went |
| Counts toward | A goal, if it feeds one. Optional |

Type the duration, press **Tab**, type what you did, **Tab**, pick a category,
and press **Enter**. The row clears and the cursor goes back to the start, so
you can log a whole day without touching the mouse.

The **+** at the end of the row opens a larger form. Use it when you want to see
what an entry does to a goal's finishing date before you save it.

Some things worth knowing:

- **Log durations, not clock times.** Meridian only ever asks how long
  something took.
- **You do not have to account for all 24 hours.** The header says how much is
  still unaccounted for; that is information, not a target.
- **← and →** at the top right move between days, so you can fill in yesterday.
- The **…** at the end of any row edits or deletes it.
- If you make a mistake, nothing is ever really lost — see *Nothing is deleted*.

**Categories** are yours to change. *Manage categories* on the Log screen lets
you add, rename, recolour and archive them. Each one has a direction:

- **More** — you want more of this. Only these can carry goals.
- **Less** — you want less of this.
- **Upkeep** — the cost of running a life. Logged, never judged.

---

## The other screens

**Where it went** is the payoff. Pick a date range — click a day, then click
another day, in either order — and it shows where the hours went. Click any band
in the chart to shade the days it happened on. The presets (30D, 90D, YTD, ALL)
are quicker than clicking.

**Goals** turns logged hours into a finishing date. A goal is fed by one *More*
category and needs a number of hours and a date. Meridian then tells you when it
will actually land at the pace you are really going, which may not be the date
you typed. That is the point of it.

**Progress**, **Plan** and **Lessons** are not built yet. They need a few weeks
of history to say anything true, so they say so instead.

---

## Where your data lives, and how to keep it

Everything is stored **inside the browser you opened it in**, on this computer.
That means:

- Another browser will not see it. Neither will another computer.
- Clearing your browsing data can erase it.

So: **export at the end of each day.**

Click **DATA** in the top right, then **Export**. You get a file called
`meridian-data-2026-09-03.xlsx`. Save it into the **`data`** folder inside the
Meridian folder. It takes five seconds and it is your only real backup.

The header tells you where you stand — *"3 unexported changes"*, or
*"Exported 12 min ago"*. If you try to close the tab with unsaved changes, the
browser will ask before letting you.

The export is an ordinary Excel file and you are welcome to open it, read it,
and even edit it. If you change something there, use **Import** to bring it
back; every row is checked and anything that will not load is listed with the
reason rather than quietly dropped.

---

## Starting for real

The first time you open it, you get three choices:

- **Import workbook** — if I have sent you one.
- **Start with demo data** — a fortnight of invented entries so every screen has
  something in it. Good for a look around. It is marked **DEMO** in the header,
  and **Start fresh** on that badge clears it.
- **Start empty** — the eight starter categories and nothing else.

**Have a look around with the demo first, then Start fresh before your real
first day.** Otherwise the invented hours mix into yours.

---

## Nothing is deleted

Anything you have actually lived gets archived rather than removed, so past
weeks still add up. A category with no hours in it can be deleted outright; one
with hours can only be archived, and it stays in your history while leaving the
lists you pick from. Goals work the same way.

---

## What would help me most

Use it for a few normal days. Then tell me:

1. **What made you stop using it?** Any moment you thought "I'll do it later" is
   the most useful thing you can report.
2. **What did you expect to happen that didn't?** Where did you click something
   and get a surprise?
3. **Did the numbers ever look wrong?** If so, which screen, and what did you
   expect instead?
4. **What was missing?** Not features you can imagine — things you actually
   reached for and could not find.
5. **Anything ugly, cramped, or hard to read**, and roughly how big your browser
   window was.

If something looks broken, telling me **which screen, what you did, what you
saw, and what you expected** is worth more than anything else. A screenshot is
ideal.

**Send back the `.xlsx` from your `data` folder along with your notes.** It lets
me see exactly what you saw. It contains only what you typed — your categories,
your entries, your goals. If any of it is private, delete those rows in Excel
first, or just send the notes.

---

## If something goes wrong

- **A blank page.** Make sure you opened `index.html` from the unzipped folder,
  not from inside the zip itself. Windows will happily preview a zip and the
  page will not work from there.
- **Nothing saves between visits.** Private or incognito windows throw data away
  when they close. Use an ordinary window.
- **You want to start over.** DATA → Start fresh. Export first if you want to
  keep what is there.

There is nothing you can click that will damage anything, so do try things.

Thank you — genuinely. A few days of real use tells me more than months of
guessing.
