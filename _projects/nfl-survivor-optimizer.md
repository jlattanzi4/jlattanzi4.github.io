---
name: NFL Survivor Pool Optimizer
tools: [Python, Streamlit, Pandas, SciPy, BeautifulSoup]
image: https://raw.githubusercontent.com/jlattanzi4/nfl-survivor-optimizer/main/images/demo.png
description: A data-driven application that uses the Hungarian algorithm to optimize NFL Survivor Pool picks for the entire season.
external_url: https://nfl-survivor-optimizer.streamlit.app/
---

# NFL Survivor Pool Optimizer

## The Problem

NFL Survivor Pools require you to pick one team to win each week, but you can only use each team once per season. This creates a complex optimization problem: which team should you pick this week to maximize your chances of surviving the entire season?

## The Solution

I built an intelligent system that solves this challenge using advanced optimization techniques and real-time data:

### Key Features

- **Hungarian Algorithm Optimization**: Uses linear sum assignment to find the optimal team selection path
- **Real-Time Odds Integration**: Pulls live moneylines from The Odds API
- **Season-Long Projections**: Scrapes future week projections from SurvivorGrid
- **Pool Size Adjustments**: Tailors recommendations based on your pool's size (contrarian vs. consensus strategies)
- **Interactive UI**: Week-by-week team selection with smart filtering
- **Complete Season Outlook**: Shows your optimal path from current week through Week 18

## Technical Highlights

### Technologies Used
- **Python**: Core programming language
- **Streamlit**: Interactive web application framework
- **SciPy**: Linear sum assignment (Hungarian algorithm)
- **Pandas & NumPy**: Data manipulation and analysis
- **BeautifulSoup**: Web scraping for projection data
- **The Odds API**: Real-time betting odds

### The Algorithm

The app uses the **Hungarian Algorithm** (linear sum assignment) to solve the assignment problem:
- **Goal**: Maximize the probability of winning out (surviving all remaining weeks)
- **Constraint**: Each team can only be used once
- **Method**: Convert to a cost minimization problem using `-log(win_probability)`
  - Minimizing the sum of `-log(p)` = Maximizing the product of probabilities
  - This finds the path with the highest overall win-out probability

### Key Technical Implementations
- Logarithmic cost function to convert probability products to sums
- Spread-to-probability conversion: `P(win) = 1 / (1 + 10^(spread/14))`
- Moneyline-to-probability calculations handling both favorites and underdogs
- Dynamic pool size strategy adjustments

## Business Impact

The tool helps users make data-driven decisions in survivor pools by:
- **Maximizing long-term survival probability** (not just current week win rate)
- **Balancing risk vs. reward** based on pool size
- **Providing strategic planning** with complete season outlook
- **Saving research time** by automating data collection and analysis

## What I Learned

- **End-to-end project deployment**: From data collection through algorithm implementation to production deployment
- **Working with external APIs and web scraping**: Real-time data integration from multiple sources
- **User experience design**: Translating complex optimization problems into intuitive interfaces
- **Documentation importance**: Clear READMEs and code comments for maintainability

## Links

- **[Live Demo](https://nfl-survivor-optimizer.streamlit.app/)** - Try it yourself
- **[GitHub Repository](https://github.com/jlattanzi4/nfl-survivor-optimizer)** - View the code
