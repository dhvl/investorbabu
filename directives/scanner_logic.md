# Signal Scanner Logic & Memory

This directive documents the programmatic scanning logic for the Bluecandle strategy and its integration behavior.

## Core Architecture
* **Programmatic Execution:** The scanner (`main.py`) operates 100% programmatically and runs 24/7 on a 15-minute cron.
* **No Email Dependencies:** The system downloads live candle data directly from Yahoo Finance via the `yfinance` module. It does NOT wait for TradingView email alerts to execute trades, which avoids email server queue latency completely.
* **Strict Inside Bar Math:** To trigger a signal, a candle must satisfy the strict mathematical definition of an Inside Bar:
  * $\text{High} \le \text{Previous High}$
  * $\text{Low} \ge \text{Previous Low}$
  * If a candle breaks either of these boundaries on the Yahoo Finance data feed, it is mathematically disqualified, even if third-party pine scripts plot a visual shape.
