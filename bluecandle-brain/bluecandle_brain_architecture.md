# The Bluecandle Brain: ML Architecture & Implementation Guide

## Objective
To reverse-engineer the proprietary "Blue Candle" trading signal (currently dependent on an external TradingView chart scraper) by building a self-sufficient Machine Learning model using free Yahoo Finance data.

## Phase 1: Data Gathering (Positive Samples)
**Script:** `dataset_builder.py`
**Action:** We extracted the exact date and time of 122 historical Blue Candle detections from the `signals.json` log. For each signal, we used the `yfinance` API to travel back in time and pull the 15-minute OHLCV (Open, High, Low, Close, Volume) candlesticks immediately preceding the event.
**Result:** Created `bluecandle_dataset.csv` containing the "DNA" of 122 successful signals.

## Phase 2: Negative Sampling (False Data)
**Script:** `negative_sampler.py`
**Action:** To prevent the AI from overfitting or "memorizing" stock tickers, we fed it thousands of normal, non-signal candlesticks from the exact same 5 monitored stocks (TATASTEEL, DLF, POLYCAB, HAVELLS, ADANIENSOL). We deliberately avoided any timestamps within an hour of our known positive signals.
**Result:** Created `bluecandle_dataset_negatives.csv` with 1,000 perfectly clean, randomly sampled negative candles.

## Phase 3: Feature Engineering (The Math)
**Script:** `feature_builder.py`
**Action:** Raw prices (like ₹9,100 vs ₹200) are hard for AI to generalize. We converted the raw OHLCV data into universal technical indicators using native pandas calculations:
*   RSI (Relative Strength Index - 14 period)
*   MACD & Signal Line (12, 26, 9)
*   EMA (Exponential Moving Averages - 20 & 50 period)
*   Bollinger Bands (20 period, 2 StdDev)
*   Volume Surge % (Volume relative to 20-period Simple Moving Average)
**Result:** Created `training_dataset.csv` containing 1,122 rows of fully enriched mathematical features.

## Phase 4: Training the AI Model
**Script:** `model_trainer.py`
**Action:** We fed the enriched dataset into a `RandomForestClassifier` from `scikit-learn`. We explicitly hid 20% of the data during training so we could test the AI on "unseen" market conditions.
**Result:** The model successfully identified the hidden mathematical pattern behind the Blue Candle with staggering accuracy.
*   **Overall Accuracy:** `97.78%`
*   **Precision:** `91%` (When it calls a signal, it's correct 91% of the time)
*   **Recall:** `88%` (It catches 88% of all true Blue Candles)
*   **Artifacts Generated:** `bluecandle_model.joblib` (The Brain) and `model_features.joblib` (The required input mapping).

## Phase 5: Shadow Mode (Live Testing)
**Script:** `brain_scanner.py`
**Action:** A lightweight script designed to run in parallel with the legacy `main.py` scanner. Every 15 minutes, it calculates the current market features and asks the ML Brain for a prediction.
**Integration:**
1.  **Safety:** It operates in strict "Read-Only" mode. It cannot place trades via the Kite API.
2.  **Dashboard Sync:** If it detects a signal, it checks `signals.json`. If TradingView already found it, it upgrades the UI badge to **`🧠 Brain Verified`**. If TradingView missed it, it injects a standalone **`🧠 Brain V2 ONLY`** signal card.

## Future Roadmap (The Expansion)
Once the Brain proves itself in Shadow Mode during the upcoming trading sessions, the TradingView scraper dependency can be completely retired. The Brain can then be safely deployed to scan the entire Nifty 500 bucket at lightning speed, entirely for free, directly on the server.
