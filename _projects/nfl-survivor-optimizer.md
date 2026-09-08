---
name: NFL Survivor Pool Optimizer
tools: [Python, JavaScript, SciPy, NumPy, GitHub Actions]
image: https://raw.githubusercontent.com/jlattanzi4/nfl-survivor-optimizer/main/images/demo.png
description: Hungarian-algorithm path search plus a Monte Carlo pool simulation on live market lines, running entirely in the browser.
external_url: https://jlattanzi4.github.io/nfl-survivor-optimizer/
---

# NFL Survivor Pool Optimizer

## The Problem

A survivor pool asks you to pick one team to win each week, using each team only once. Surviving is not the goal, though: winning is. That means every pick has to balance the chance your team wins against how much of the pool goes out with you if it loses, and how much of the pool is left standing if it wins.

## The Solution

A static web app that answers "who do I pick this week?" with a number: your simulated share of the pot.

- **Market-driven probabilities.** Current-week moneylines from six sportsbooks are de-vigged and averaged, with Pinnacle weighted double. Future weeks use SurvivorGrid's look-ahead spreads, converted with a logistic curve calibrated to historical straight-up results.
- **Exact path search.** Weeks-to-teams is an assignment problem; the Hungarian algorithm solves it optimally, minimizing the sum of `−log p`. A leverage term generates additional paths that lean on less popular teams.
- **Pool simulation.** Each candidate path is played through 20,000 simulated seasons against a field that picks in proportion to public pick shares. The ranking metric is pool equity, so the same favorite can be the right call in a 10-entry pool and the wrong call in a 1,000-entry pool.

## Architecture

- **Python pipeline** scrapes SurvivorGrid, calls The Odds API, fits the public-pick model, and writes one JSON file.
- **GitHub Actions** runs the pipeline three times a day and commits the data; the site is hosted on GitHub Pages with no backend.
- **Browser engine** (plain JavaScript, no framework) runs the Hungarian solver and the Monte Carlo simulation in a Web Worker in about a quarter of a second.
- **Tests** cover the parser, vig removal, the optimizer, the simulator, and a parity check that the JavaScript port matches the Python reference.

## What I Learned

- Rebuilding a Streamlit prototype as a static site removed the cold starts and unlocked a real interface: an 18-week "gauntlet" that fills in as you explore picks.
- Getting the objective right mattered more than the algorithm. The original version maximized survival probability; the rewrite maximizes expected share of the pot.
- Scraper edge cases (neutral-site games, pick'em lines) had silently dropped 18 games a season. Fixture-based tests now catch that.

## Links

- **[Live app](https://jlattanzi4.github.io/nfl-survivor-optimizer/)**
- **[GitHub repository](https://github.com/jlattanzi4/nfl-survivor-optimizer)**
