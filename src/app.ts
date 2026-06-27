// ============================================================
// Korea Watch — World Cup 2026 third-place tracker
// Compiled to ../app.js by `npm run build` (tsc). No modules: top-level
// functions stay global so the inline onclick="" handlers in index.html resolve.
// ============================================================

// ---------- types ----------
interface TeamRec { pts: number; gf: number; ga: number; }
interface RankedTeam extends TeamRec { name: string; }

// hs/as: a number once a score is in, "" when cleared, undefined before kickoff.
type ScoreVal = number | string;
type MatchStatus = "scheduled" | "live" | "final";

interface MatchData {
  home: string;
  away: string;
  time: string;
  kickoff?: string;            // ISO with ET offset; drives auto-refresh windows
  api?: [string[], string[]];  // [homeNameHints, awayNameHints]
  hs?: ScoreVal;
  as?: ScoreVal;
  confirmed?: boolean;         // real locked result, protected from reset
  apiStatus?: MatchStatus;
}

interface GroupData {
  day: string;
  status: string;
  teams: Record<string, TeamRec>;
  matches: MatchData[];
  headline: string;
  want: string[];
  danger: string[];
}

type ScoreModel = "uniform" | "poisson";
type VerdictStatus = "clinched" | "eliminated" | "alive";
interface Verdict { minAbove: number; maxAbove: number; status: VerdictStatus; }

// worldcup26.ir /get/games — scores are STRINGS, finished is "TRUE"/"FALSE".
interface ApiGame {
  home_team_name_en: string;
  away_team_name_en: string;
  home_score: string | null;
  away_score: string | null;
  finished: string;
}
interface ApiResponse { games?: ApiGame[]; }

// ---------- DATA: current standings BEFORE each final match ----------
// gf/ga are goals for/against so far. Final matches listed with kickoff (ET).
const KOREA = { pts: 3, gd: -1, gf: 2 };

// ---------- scoreline model ----------
// 'uniform'  = every 0..4 score equally likely (conservative; original behaviour).
// 'poisson'  = goals ~ Poisson(expected), expected derived from rough strength gap.
let MODEL: ScoreModel = "uniform";
// Rough relative strength (~ -1.4 minnow … +1.6 elite). Only teams appearing in
// still-to-play matches matter. These are tunable estimates, not official ratings.
const STRENGTH: Record<string, number> = {
  Egypt: 0.1, Iran: 0.0, Belgium: 0.9, NZ: -1.0,
  England: 1.2, Ghana: 0.0, Croatia: 0.8, Panama: -1.1,
  Colombia: 0.7, Portugal: 1.3, DRCongo: -0.4, Uzbek: -1.0,
  Argentina: 1.6, Austria: 0.3, Algeria: 0.0, Jordan: -1.2,
  France: 1.5, Norway: 0.7, Senegal: 0.5, Iraq: -0.9,
  Spain: 1.5, Uruguay: 0.8, CapeVerde: -0.6, Saudi: -0.8
};
function poissonSample(lambda: number): number {
  const L = Math.exp(-lambda); let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}
function expectedGoals(home: string, away: string): [number, number] {
  const sh = STRENGTH[home] ?? 0, sa = STRENGTH[away] ?? 0;
  return [Math.max(0.15, 1.3 + 0.55 * (sh - sa)), Math.max(0.15, 1.3 + 0.55 * (sa - sh))];
}
// one sampled scoreline for a match: fixed if entered, else model-driven
function sampleScore(m: MatchData): [number, number] {
  if (m.hs != null && m.hs !== "" && m.as != null && m.as !== "") return [Number(m.hs), Number(m.as)];
  if (MODEL === "poisson") { const [lh, la] = expectedGoals(m.home, m.away); return [poissonSample(lh), poissonSample(la)]; }
  return [(Math.random() * 5) | 0, (Math.random() * 5) | 0];
}
// one sampled final table for a group → its 3rd-place team
function sampleGroupThird(g: string): RankedTeam {
  const data = groups[g], t: Record<string, TeamRec> = {};
  for (const n in data.teams) t[n] = { ...data.teams[n] };
  for (const m of data.matches) {
    const [hs, as] = sampleScore(m);
    t[m.home].gf += hs; t[m.home].ga += as; t[m.away].gf += as; t[m.away].ga += hs;
    if (hs > as) t[m.home].pts += 3; else if (as > hs) t[m.away].pts += 3;
    else { t[m.home].pts += 1; t[m.away].pts += 1; }
  }
  return Object.entries(t).map(([n, r]) => ({ name: n, ...r }))
    .sort((a, b) => b.pts - a.pts || gd(b) - gd(a) || b.gf - a.gf)[2];
}

const groups: Record<string, GroupData> = {
  I: {
    day: "Friday", status: "live",
    teams: {
      France: { pts: 6, gf: 6, ga: 1 }, Norway: { pts: 6, gf: 7, ga: 3 },
      Senegal: { pts: 0, gf: 3, ga: 6 }, Iraq: { pts: 0, gf: 1, ga: 7 }
    },
    matches: [
      { home: "Norway", away: "France", time: "Fri 3PM", hs: 1, as: 4, confirmed: true,
        kickoff: "2026-06-26T15:00:00-04:00", api: [["norway"], ["france"]] },
      { home: "Senegal", away: "Iraq", time: "Fri 3PM", hs: 5, as: 0, confirmed: true,
        kickoff: "2026-06-26T15:00:00-04:00", api: [["senegal"], ["iraq"]] }
    ],
    headline: "Senegal must NOT beat Iraq by 2+",
    want: [
      "A draw, a Senegal loss, or a 1-goal Senegal win → Korea safe from Group I.",
      "Norway vs France is irrelevant (both already through)."
    ],
    danger: [
      "Senegal winning by 2+ (e.g. 2-0) → reaches GD −1 with more goals than Korea → ranks above Korea on the goals tiebreaker."
    ]
  },
  H: {
    day: "Friday", status: "live",
    teams: {
      Spain: { pts: 4, gf: 4, ga: 0 }, Uruguay: { pts: 2, gf: 3, ga: 3 },
      CapeVerde: { pts: 2, gf: 2, ga: 2 }, Saudi: { pts: 1, gf: 1, ga: 5 }
    },
    matches: [
      { home: "CapeVerde", away: "Saudi", time: "Fri 8PM", hs: 0, as: 0, confirmed: true,
        kickoff: "2026-06-26T20:00:00-04:00", api: [["cape verde", "cabo verde"], ["saudi"]] },
      { home: "Uruguay", away: "Spain", time: "Fri 8PM", hs: 0, as: 1, confirmed: true,
        kickoff: "2026-06-26T20:00:00-04:00", api: [["uruguay"], ["spain"]] }
    ],
    headline: "Spain must beat Uruguay",
    want: [
      "If Spain wins, Korea is 100% safe from Group H — verified.",
      "Cape Verde vs Saudi result then doesn't matter at all."
    ],
    danger: [
      "Any Uruguay–Spain draw, or a Uruguay win → a Group H team finishes 3rd on 3+ pts with GD ≥ −1 → ranks above Korea."
    ]
  },
  G: {
    day: "Friday", status: "live",
    teams: {
      Egypt: { pts: 4, gf: 4, ga: 2 }, Iran: { pts: 2, gf: 2, ga: 2 },
      Belgium: { pts: 2, gf: 1, ga: 1 }, NZ: { pts: 1, gf: 3, ga: 5 }
    },
    matches: [
      { home: "Egypt", away: "Iran", time: "Fri 11PM",
        kickoff: "2026-06-26T23:00:00-04:00", api: [["egypt"], ["iran"]] },
      { home: "NZ", away: "Belgium", time: "Fri 11PM",
        kickoff: "2026-06-26T23:00:00-04:00", api: [["new zealand"], ["belgium"]] }
    ],
    headline: "Egypt must beat Iran",
    want: [
      "If Egypt wins, Korea is 100% safe from Group G — verified.",
      "NZ vs Belgium is irrelevant (Iran finishes 3rd on 2 pts either way)."
    ],
    danger: [
      "Iran drawing or beating Egypt → a 3-or-4-point team finishes 3rd and ranks above Korea."
    ]
  },
  L: {
    day: "Saturday", status: "live",
    teams: {
      England: { pts: 4, gf: 4, ga: 2 }, Ghana: { pts: 4, gf: 1, ga: 0 },
      Croatia: { pts: 3, gf: 3, ga: 4 }, Panama: { pts: 0, gf: 0, ga: 4 }
    },
    matches: [
      { home: "Croatia", away: "Ghana", time: "Sat 5PM",
        kickoff: "2026-06-27T17:00:00-04:00", api: [["croatia"], ["ghana"]] },
      { home: "Panama", away: "England", time: "Sat 5PM",
        kickoff: "2026-06-27T17:00:00-04:00", api: [["panama"], ["england"]] }
    ],
    headline: "Need Ghana to beat Croatia (shakiest group)",
    want: [
      "Ghana beating Croatia is the best hope.",
      "Even then it's not a lock — the England/Ghana third can still edge Korea in some scores."
    ],
    danger: [
      "Croatia drawing OR winning → Croatia (or a 4-pt England/Ghana third) finishes above Korea.",
      "Croatia already leads Korea on goals scored, so they only need a point."
    ]
  },
  K: {
    day: "Saturday", status: "live",
    teams: {
      Colombia: { pts: 6, gf: 4, ga: 1 }, Portugal: { pts: 4, gf: 6, ga: 1 },
      DRCongo: { pts: 1, gf: 1, ga: 2 }, Uzbek: { pts: 0, gf: 1, ga: 8 }
    },
    matches: [
      { home: "Colombia", away: "Portugal", time: "Sat 7:30PM",
        kickoff: "2026-06-27T19:30:00-04:00", api: [["colombia"], ["portugal"]] },
      { home: "DRCongo", away: "Uzbek", time: "Sat 7:30PM",
        kickoff: "2026-06-27T19:30:00-04:00", api: [["congo", "dr congo"], ["uzbekistan"]] }
    ],
    headline: "DR Congo must NOT win",
    want: [
      "A DR Congo draw or loss keeps them at ≤2 pts, below Korea.",
      "Colombia vs Portugal is irrelevant (both already through)."
    ],
    danger: [
      "DR Congo beating Uzbekistan → 4 pts → ranks above Korea outright."
    ]
  },
  J: {
    day: "Saturday", status: "live",
    teams: {
      Argentina: { pts: 6, gf: 5, ga: 2 }, Austria: { pts: 3, gf: 3, ga: 3 },
      Algeria: { pts: 3, gf: 2, ga: 4 }, Jordan: { pts: 0, gf: 2, ga: 5 }
    },
    matches: [
      { home: "Algeria", away: "Austria", time: "Sat 10PM",
        kickoff: "2026-06-27T22:00:00-04:00", api: [["algeria"], ["austria"]] },
      { home: "Jordan", away: "Argentina", time: "Sat 10PM",
        kickoff: "2026-06-27T22:00:00-04:00", api: [["jordan"], ["argentina"]] }
    ],
    headline: "Austria must beat Algeria (ideally clearly)",
    want: [
      "An Austria win almost always drops Algeria to a harmless 3-pt/−3 third.",
      "Jordan vs Argentina is irrelevant."
    ],
    danger: [
      "An Algeria–Austria draw → 4-pt third, ranks above Korea.",
      "Algeria winning, or a narrow high-scoring Austria win, can still leave a third above Korea."
    ]
  }
};

// DOM helper: assert an element that the static HTML guarantees exists.
function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
}

// store user-entered scores: groups[g].matches[i].hs / .as
function gd(t: TeamRec): number { return t.gf - t.ga; }

function computeGroupFinal(g: string): { table: Record<string, TeamRec>; ranked: RankedTeam[] } {
  // clone teams, apply any entered scores
  const data = groups[g];
  const t: Record<string, TeamRec> = {};
  for (const name in data.teams) t[name] = { ...data.teams[name] };
  for (const m of data.matches) {
    if (m.hs != null && m.as != null && m.hs !== "" && m.as !== "") {
      const hs = Number(m.hs), as = Number(m.as);
      t[m.home].gf += hs; t[m.home].ga += as;
      t[m.away].gf += as; t[m.away].ga += hs;
      if (hs > as) t[m.home].pts += 3;
      else if (as > hs) t[m.away].pts += 3;
      else { t[m.home].pts += 1; t[m.away].pts += 1; }
    }
  }
  // rank
  const ranked = Object.entries(t).map(([n, r]) => ({ name: n, ...r }))
    .sort((a, b) => b.pts - a.pts || gd(b) - gd(a) || b.gf - a.gf);
  return { table: t, ranked };
}

function allMatchesEntered(g: string): boolean {
  return groups[g].matches.every(m => m.hs != null && m.hs !== "" && m.as != null && m.as !== "");
}

function anyMatchEntered(g: string): boolean {
  return groups[g].matches.some(m => m.hs != null && m.hs !== "" && m.as != null && m.as !== "");
}

function thirdBeatsKorea(rec: TeamRec): boolean {
  if (rec.pts !== KOREA.pts) return rec.pts > KOREA.pts;
  if (gd(rec) !== KOREA.gd) return gd(rec) > KOREA.gd;
  return rec.gf > KOREA.gf; // goals scored; ties beyond this go to conduct (assume risk)
}

// ---- possibility: enumerate 0..4 scorelines for unentered matches ----
function groupThirdDist(g: string): RankedTeam[] {
  const data = groups[g];
  const base: Record<string, TeamRec> = {};
  for (const name in data.teams) base[name] = { ...data.teams[name] };
  const outcomes: RankedTeam[] = [];
  function rec(i: number, tbl: Record<string, TeamRec>): void {
    if (i === data.matches.length) {
      const ranked = Object.entries(tbl).map(([n, r]) => ({ name: n, ...r }))
        .sort((a, b) => b.pts - a.pts || gd(b) - gd(a) || b.gf - a.gf);
      outcomes.push(ranked[2]);
      return;
    }
    const m = data.matches[i];
    if (m.hs != null && m.hs !== "" && m.as != null && m.as !== "") {
      rec(i + 1, applied(tbl, m, Number(m.hs), Number(m.as)));
    } else {
      for (let h = 0; h <= 4; h++) for (let a = 0; a <= 4; a++)
        rec(i + 1, applied(tbl, m, h, a));
    }
  }
  function applied(tbl: Record<string, TeamRec>, m: MatchData, hs: number, as: number): Record<string, TeamRec> {
    const t: Record<string, TeamRec> = {}; for (const n in tbl) t[n] = { ...tbl[n] };
    t[m.home].gf += hs; t[m.home].ga += as; t[m.away].gf += as; t[m.away].ga += hs;
    if (hs > as) t[m.home].pts += 3; else if (as > hs) t[m.away].pts += 3;
    else { t[m.home].pts += 1; t[m.away].pts += 1; }
    return t;
  }
  rec(0, base);
  return outcomes;
}

function overallProb(): number {
  // Monte Carlo: fix finished groups once, sample the live ones per iteration.
  const fixedThirds: RankedTeam[] = [], liveGroups: string[] = [];
  for (const g in groups) {
    if (allMatchesEntered(g)) fixedThirds.push(computeGroupFinal(g).ranked[2]);
    else liveGroups.push(g);
  }
  const baseAbove = 4 + fixedThirds.filter(thirdBeatsKorea).length; // +4 locked thirds
  const N = 20000; let inCount = 0;
  for (let s = 0; s < N; s++) {
    let above = baseAbove;
    for (const g of liveGroups) if (thirdBeatsKorea(sampleGroupThird(g))) above++;
    if (above + 1 <= 8) inCount++; // Korea herself is the +1; needs ≤8 total
  }
  return inCount / N * 100;
}

// Possibility (not probability) analysis: across EVERY reachable 0..4 outcome,
// what's the fewest / most teams that can finish above Korea?
//   status: 'clinched' (always ≤7 above) | 'eliminated' (always ≥8) | 'alive'.
function verdictState(): Verdict {
  let minAbove = 4, maxAbove = 4; // 4 already-locked thirds sit above Korea
  for (const g in groups) {
    if (allMatchesEntered(g)) {
      if (thirdBeatsKorea(computeGroupFinal(g).ranked[2])) { minAbove++; maxAbove++; }
    } else {
      const outs = groupThirdDist(g);
      if (outs.some(thirdBeatsKorea)) maxAbove++;        // some outcome puts a team above
      if (outs.every(thirdBeatsKorea)) minAbove++;       // every outcome does → unavoidable
    }
  }
  const status: VerdictStatus = maxAbove <= 7 ? "clinched" : minAbove >= 8 ? "eliminated" : "alive";
  return { minAbove, maxAbove, status };
}

function render(): void {
  const wrap = byId("groups");
  wrap.innerHTML = "";

  // ----- group cards, separated by day -----
  const order = Object.keys(groups); // already in kickoff order I,H,G,L,K,J
  let currentDay: string | null = null;
  for (const g of order) {
    const data = groups[g];
    if (data.day !== currentDay) {
      currentDay = data.day;
      wrap.innerHTML += `<div class="daysep"><span>${currentDay}</span></div>`;
    }
    const { ranked } = computeGroupFinal(g);
    const third = ranked[2];
    const done = allMatchesEntered(g);
    const anyStarted = anyMatchEntered(g);
    const beats = thirdBeatsKorea(third);

    let rows = "";
    ranked.forEach((r, idx) => {
      rows += `<tr class="${idx === 2 ? 'third' : ''}">
        <td>${r.name}</td><td>${r.pts}</td>
        <td>${gd(r) >= 0 ? '+' : ''}${gd(r)}</td><td>${r.gf}</td></tr>`;
    });

    let matchRows = "";
    data.matches.forEach((m, i) => {
      const hasScore = m.hs !== undefined && m.hs !== "" && m.hs !== null
                    && m.as !== undefined && m.as !== "" && m.as !== null;
      let status: MatchStatus | "manual";
      if (!hasScore) {
        status = "scheduled"; // no score entered → never LIVE or FINAL, no matter what apiStatus says
      } else if (m.confirmed) {
        status = "final";
      } else if (m.apiStatus === "live") {
        status = "live";
      } else if (m.apiStatus === "final") {
        status = "final";
      } else {
        status = "manual"; // has a score, but it's user-typed / not API-confirmed
      }
      const badge = {
        final: '<span class="mbadge final">FINAL</span>',
        live: '<span class="mbadge live">● LIVE</span>',
        manual: '<span class="mbadge manual">manual</span>',
        scheduled: '<span class="mbadge sched">not started</span>'
      }[status];
      matchRows += `<div class="match">
        <span class="time">${m.time}</span>
        <span class="teams">${m.home} <span class="vs">vs</span> ${m.away}</span>
        <input class="score" inputmode="numeric" value="${m.hs ?? ''}"
          onchange="setScore('${g}',${i},'hs',this.value)">
        <input class="score" inputmode="numeric" value="${m.as ?? ''}"
          onchange="setScore('${g}',${i},'as',this.value)">
        ${badge}
      </div>`;
    });

    const bullets = (arr: string[]) => arr.map(x => `<li>${x}</li>`).join("");
    let threatClass: string, threatHTML: string;
    if (done) {
      threatClass = beats ? 'bad' : 'good';
      threatHTML = beats
        ? `<div class="thead">✗ ${third.name} finished 3rd and ranks ABOVE Korea</div><ul>${bullets(data.danger)}</ul>`
        : `<div class="thead">✓ ${third.name} finished 3rd — below Korea, SAFE</div>`;
    } else {
      threatClass = 'warn';
      threatHTML = `<div class="thead">▶ ${data.headline}</div>
        <div class="tsub good">Want</div><ul>${bullets(data.want)}</ul>
        <div class="tsub bad">Danger</div><ul>${bullets(data.danger)}</ul>`;
    }

    wrap.innerHTML += `
      <div class="group">
        <div class="ghead">
          <span class="gname">Group ${g}</span>
          <span class="gstatus ${done ? 'done' : anyStarted ? 'live' : 'sched'}">${done ? 'FINISHED' : anyStarted ? 'LIVE' : 'NOT STARTED'}</span>
        </div>
        <table>
          <tr><th>Team</th><th>Pts</th><th>GD</th><th>GF</th></tr>
          ${rows}
        </table>
        <div class="matches">${matchRows}</div>
        <div class="threat ${threatClass}">${threatHTML}</div>
      </div>`;
  }

  // ----- live top-8 third-place tracker -----
  renderTop8();

  // ----- verdict -----
  const p = overallProb();
  const el = byId("pctNum");
  el.textContent = Math.round(p) + "%";
  el.className = "pct " + (p >= 75 ? 'good' : p >= 45 ? 'warn' : 'bad');

  // plain-English verdict line
  const vs = verdictState();
  const vEl = document.getElementById("verdictText");
  if (vEl) {
    if (vs.status === "clinched") {
      vEl.className = "verdictText good";
      vEl.textContent = `✅ Korea is THROUGH — even the worst remaining results leave only ${vs.maxAbove} teams above her (8+ would eliminate).`;
    } else if (vs.status === "eliminated") {
      vEl.className = "verdictText bad";
      vEl.textContent = `⛔ Korea is OUT — at least ${vs.minAbove} teams already finish above her (8+ = eliminated).`;
    } else {
      vEl.className = "verdictText warn";
      const needBad = 8 - vs.minAbove, cushion = 7 - vs.minAbove;
      vEl.textContent = `⏳ Still alive — out only if ${needBad}+ more of the live groups send a team above Korea (cushion: ${cushion}).`;
    }
  }
  maybeNotifyVerdict(vs.status);

  recordProb(p);   // sparkline trajectory
  renderRd32(vs);  // round-of-32 preview
}

// Locked thirds plus each group's current 3rd-place team, ranked, top 8 highlighted.
interface ThirdRow extends TeamRec { name: string; grp: string; done: boolean; korea?: boolean; }
function renderTop8(): void {
  const box = document.getElementById("top8body");
  if (!box) return;
  // locked thirds (done playing)
  const locked: ThirdRow[] = [
    { name: "Ecuador", grp: "E", pts: 4, gf: 2, ga: 2, done: true },
    { name: "Sweden", grp: "F", pts: 4, gf: 7, ga: 7, done: true },
    { name: "Bosnia", grp: "B", pts: 4, gf: 5, ga: 6, done: true },
    { name: "Paraguay", grp: "D", pts: 4, gf: 2, ga: 4, done: true },
    { name: "Korea", grp: "A", pts: 3, gf: 2, ga: 3, done: true, korea: true },
    { name: "Scotland", grp: "C", pts: 3, gf: 1, ga: 4, done: true },
  ];
  const live: ThirdRow[] = [];
  for (const g of Object.keys(groups)) {
    const { ranked } = computeGroupFinal(g);
    const t = ranked[2];
    live.push({ name: t.name, grp: g, pts: t.pts, gf: t.gf, ga: t.ga, done: allMatchesEntered(g) });
  }
  const all = [...locked, ...live].sort((a, b) =>
    b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);

  let html = "";
  all.forEach((t, i) => {
    const rank = i + 1;
    const inTop8 = rank <= 8;
    const cls = (t.korea ? 'k8row ' : '') + (inTop8 ? 'inrow' : 'outrow');
    const status = inTop8
      ? `<span class="mini in">IN</span>`
      : `<span class="mini out">OUT</span>`;
    const liveDot = t.done ? '' : '<span class="livedot" title="not final"></span>';
    html += `<tr class="${cls}">
      <td>${rank}</td>
      <td>${t.name}${liveDot} <span class="grp">${t.grp}</span></td>
      <td>${t.pts}</td>
      <td>${(t.gf - t.ga) >= 0 ? '+' : ''}${t.gf - t.ga}</td>
      <td>${t.gf}</td>
      <td>${status}</td>
    </tr>`;
    if (rank === 8) html += `<tr class="cutline"><td colspan="6">— top 8 cut line —</td></tr>`;
  });
  box.innerHTML = html;
}

function setScore(g: string, i: number, side: "hs" | "as", val: string): void {
  groups[g].matches[i][side] = val === "" ? "" : val;
  render();
}
function resetScores(): void {
  for (const g in groups) groups[g].matches.forEach(m => {
    if (m.confirmed) return; // never wipe a real, locked-in result
    m.hs = ""; m.as = ""; m.apiStatus = "scheduled";
  });
  render();
}
function applyRooting(): void {
  // fill in the best-case-for-Korea scoreline in each group
  const best: Record<string, [string, string, number, number][]> = {
    I: [["Norway", "France", 1, 1], ["Senegal", "Iraq", 1, 1]],
    H: [["CapeVerde", "Saudi", 2, 0], ["Uruguay", "Spain", 0, 2]],
    G: [["Egypt", "Iran", 2, 0], ["NZ", "Belgium", 0, 1]],
    L: [["Croatia", "Ghana", 0, 1], ["Panama", "England", 0, 2]],
    K: [["Colombia", "Portugal", 1, 1], ["DRCongo", "Uzbek", 1, 1]],
    J: [["Algeria", "Austria", 0, 2], ["Jordan", "Argentina", 0, 2]]
  };
  for (const g in best) {
    best[g].forEach((sc, i) => { groups[g].matches[i].hs = sc[2]; groups[g].matches[i].as = sc[3]; });
  }
  render();
}

// ============================================================
// PROBABILITY SPARKLINE — records a point each time the input state changes
// (we ignore Monte-Carlo jitter by keying on a signature of all entered scores).
// ============================================================
let probHistory: number[] = [];
let lastStateSig: string | null = null;
function stateSignature(): string {
  let s = '';
  for (const g in groups) for (const m of groups[g].matches) s += `${m.hs ?? ''}-${m.as ?? ''}|`;
  return s + MODEL;
}
function recordProb(p: number): void {
  const sig = stateSignature();
  if (sig === lastStateSig) return; // unchanged input → don't record MC noise
  lastStateSig = sig;
  probHistory.push(p);
  if (probHistory.length > 40) probHistory.shift();
  drawSparkline();
}
function drawSparkline(): void {
  const svg = document.getElementById("sparkline");
  if (!svg) return;
  const W = 170, H = 40, pad = 4, h = probHistory;
  if (h.length < 2) {
    svg.innerHTML = `<text x="${W / 2}" y="${H / 2 + 4}" text-anchor="middle" style="fill:var(--dim)" font-size="10">enter a score…</text>`;
    return;
  }
  const x = (i: number) => pad + i * (W - 2 * pad) / (h.length - 1);
  const y = (v: number) => pad + (1 - v / 100) * (H - 2 * pad);
  const pts = h.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = h[h.length - 1];
  const col = last >= 75 ? 'var(--good)' : last >= 45 ? 'var(--warn)' : 'var(--bad)';
  const y50 = y(50).toFixed(1);
  svg.innerHTML =
    `<line x1="${pad}" y1="${y50}" x2="${W - pad}" y2="${y50}" style="stroke:var(--line)" stroke-dasharray="2 2"/>` +
    `<polyline points="${pts}" style="fill:none;stroke:${col};stroke-width:2" stroke-linejoin="round" stroke-linecap="round"/>` +
    `<circle cx="${x(h.length - 1).toFixed(1)}" cy="${y(last).toFixed(1)}" r="2.8" style="fill:${col}"/>`;
}

// ============================================================
// ROUND-OF-32 PREVIEW — Korea's third-place slot meets the Group G winner.
// ============================================================
function renderRd32(vs?: Verdict): void {
  const box = document.getElementById("rd32");
  if (!box) return;
  const v = vs ?? verdictState();
  if (v.status === "eliminated") { box.classList.remove('show'); return; }
  const gWinner = computeGroupFinal('G').ranked[0];
  const gDone = allMatchesEntered('G');
  byId("r32main").innerHTML =
    `Round of 32: Korea <span class="vsteam">vs ${gWinner.name}</span> — Group G winner`;
  const winnerNote = gDone
    ? `${gWinner.name} won Group G.`
    : `${gWinner.name} currently tops Group G — not final (Egypt/Iran/Belgium still in play).`;
  const cond = v.status === "clinched"
    ? `Korea is through, so this is the matchup.`
    : `Conditional on Korea grabbing one of the 8 third-place slots.`;
  byId("r32sub").textContent = `${winnerNote} Likely Seattle (Lumen Field). ${cond}`;
  box.classList.add('show');
}

// ============================================================
// MODEL TOGGLE — uniform 0–4  vs  strength-weighted Poisson
// ============================================================
function toggleModel(): void {
  MODEL = MODEL === "uniform" ? "poisson" : "uniform";
  const b = document.getElementById("modelBtn");
  if (b) b.textContent = MODEL === "uniform" ? 'Model: Uniform 0–4' : 'Model: Strength-weighted';
  render();
}

// ============================================================
// BROWSER NOTIFICATIONS — on live API score changes and on verdict flips.
// ============================================================
let notifyEnabled = false;
let lastVerdictStatus: VerdictStatus | null = null;
const prevApiScores: Record<string, { h: number; a: number }> = {}; // key "G:0" → last score
function enableNotifications(): void {
  if (!("Notification" in window)) { alert("This browser doesn't support notifications."); return; }
  Notification.requestPermission().then(perm => {
    notifyEnabled = perm === "granted";
    const b = document.getElementById("notifyBtn");
    if (b) b.textContent = notifyEnabled ? "🔔 Notifications on" : "🔕 Notifications blocked";
  });
}
function notify(title: string, body: string): void {
  if (notifyEnabled && Notification.permission === "granted") {
    try { new Notification(title, { body }); } catch { /* ignore */ }
  }
}
function maybeNotifyVerdict(status: VerdictStatus): void {
  if (lastVerdictStatus && status !== lastVerdictStatus && status !== "alive") {
    notify(status === "clinched" ? "✅ Korea is THROUGH!" : "⛔ Korea is OUT",
      "The third-place picture just changed.");
  }
  lastVerdictStatus = status;
}

render();

// ============================================================
// LIVE SCORES — worldcup26.ir integration
// ============================================================
const API_BASE = "https://worldcup26.ir";
let lastFetchOk: boolean | null = null;
let liveTimer: number | null = null;

function norm(s: string): string { return (s || "").toLowerCase().trim(); }

function matchesHint(apiName: string, hints: string[]): boolean {
  const n = norm(apiName);
  return hints.some(h => n.includes(h));
}

async function fetchLiveScores(manual: boolean): Promise<void> {
  const statusEl = document.getElementById("liveStatus");
  if (statusEl) statusEl.textContent = "Fetching…";
  try {
    const res = await fetch(`${API_BASE}/get/games`, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json() as ApiResponse;
    const apiGames: ApiGame[] = data.games ?? [];
    let updated = 0, stillLive = false;

    for (const g in groups) {
      groups[g].matches.forEach((m, i) => {
        if (!m.api) return;
        const [homeHints, awayHints] = m.api;
        const found = apiGames.find(game =>
          matchesHint(game.home_team_name_en, homeHints) &&
          matchesHint(game.away_team_name_en, awayHints)
        );
        if (!found) return;

        const finished = String(found.finished).toUpperCase() === "TRUE";
        const now = new Date();
        const kickoffPassed = m.kickoff ? (now >= new Date(m.kickoff)) : false;

        // A match can only be live/final if EITHER the API explicitly says finished,
        // OR its real-world kickoff time has actually passed. We do NOT trust the
        // API's score field alone, because it sends 0-0 placeholders before kickoff.
        const hasStarted = finished || kickoffPassed;

        if (!hasStarted) {
          // Before kickoff: ignore entirely. Leave scores empty, mark scheduled.
          m.apiStatus = "scheduled";
          return;
        }

        const hs = found.home_score, as = found.away_score;
        const haveScore = hs !== null && hs !== undefined && hs !== "" &&
                          as !== null && as !== undefined && as !== "";

        // Even after kickoff passed, only adopt a score if the API actually has one.
        if (haveScore) {
          const newH = parseInt(hs as string, 10), newA = parseInt(as as string, 10);
          const key = g + ":" + i, prev = prevApiScores[key];
          if (!prev || prev.h !== newH || prev.a !== newA) {
            notify(`⚽ ${m.home} ${newH}–${newA} ${m.away}`, finished ? "Full time" : "Live score update");
          }
          prevApiScores[key] = { h: newH, a: newA };
          m.hs = newH;
          m.as = newA;
          m.apiStatus = finished ? "final" : "live";
          if (finished) m.confirmed = true;
          updated++;
        } else {
          m.apiStatus = finished ? "final" : "live";
        }
        if (!finished) {
          stillLive = true;
        }
      });
    }
    lastFetchOk = true;
    render();
    const now = new Date();
    if (statusEl) {
      statusEl.innerHTML = `✓ Updated ${updated} score${updated === 1 ? '' : 's'} · last checked ${now.toLocaleTimeString()}`;
      statusEl.className = "livestatus ok";
    }
    scheduleNextAutoRefresh(stillLive);
  } catch (err) {
    lastFetchOk = false;
    const msg = err instanceof Error ? err.message : String(err);
    if (statusEl) {
      statusEl.innerHTML = `⚠ Live fetch failed (${msg}) — manual entry still works`;
      statusEl.className = "livestatus err";
    }
    scheduleNextAutoRefresh(false, true);
  }
}

function anyMatchLiveSoonOrNow(): boolean {
  const now = new Date();
  for (const g in groups) {
    for (const m of groups[g].matches) {
      if (!m.kickoff) continue;
      const ko = new Date(m.kickoff);
      const mins = (ko.getTime() - now.getTime()) / 60000;
      if (mins <= 10 && mins > -180) return true;
    }
  }
  return false;
}

function scheduleNextAutoRefresh(matchInProgress: boolean, isErrorBackoff?: boolean): void {
  if (liveTimer) clearTimeout(liveTimer);
  if (!anyMatchLiveSoonOrNow()) {
    const statusEl = document.getElementById("liveStatus");
    if (statusEl && lastFetchOk) {
      statusEl.innerHTML += " · auto-refresh paused (no match live)";
    }
    return;
  }
  const interval = isErrorBackoff ? 5 * 60 * 1000
    : matchInProgress ? 2 * 60 * 1000
    : 60 * 1000;
  liveTimer = setTimeout(() => fetchLiveScores(false), interval);
}

function initLiveScores(): void {
  fetchLiveScores(false);
}
initLiveScores();
