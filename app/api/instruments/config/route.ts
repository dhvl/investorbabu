import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.LOG_FILE_PATH 
  ? path.dirname(process.env.LOG_FILE_PATH) 
  : '/home/investo/bluecandle';

const CONFIG_FILE = path.join(DATA_DIR, 'instrument_configs.json');

const DEFAULT_CONFIGS = {
  "TATASTEEL": { "currency": "INR", "sim": { "capital": 10000.0, "lot_size": 0.0 }, "live": { "capital": 50000.0, "lot_size": 0.0 } },
  "POLYCAB": { "currency": "INR", "sim": { "capital": 10000.0, "lot_size": 0.0 }, "live": { "capital": 50000.0, "lot_size": 0.0 } },
  "HAVELLS": { "currency": "INR", "sim": { "capital": 10000.0, "lot_size": 0.0 }, "live": { "capital": 50000.0, "lot_size": 0.0 } },
  "DLF": { "currency": "INR", "sim": { "capital": 10000.0, "lot_size": 0.0 }, "live": { "capital": 50000.0, "lot_size": 0.0 } },
  "ADANIENSOL": { "currency": "INR", "sim": { "capital": 10000.0, "lot_size": 0.0 }, "live": { "capital": 50000.0, "lot_size": 0.0 } },
  "BTCUSD": { "currency": "USD", "sim": { "capital": 0.0, "lot_size": 1.0 }, "live": { "capital": 0.0, "lot_size": 1.0 } },
  "XAGUSD": { "currency": "USD", "sim": { "capital": 10000.0, "lot_size": 0.0 }, "live": { "capital": 10000.0, "lot_size": 0.0 } },
  "XAUUSD": { "currency": "USD", "sim": { "capital": 10000.0, "lot_size": 0.0 }, "live": { "capital": 10000.0, "lot_size": 0.0 } },
  "OILUSD": { "currency": "USD", "sim": { "capital": 10000.0, "lot_size": 0.0 }, "live": { "capital": 10000.0, "lot_size": 0.0 } },
  "CUCUSD": { "currency": "USD", "sim": { "capital": 10000.0, "lot_size": 0.0 }, "live": { "capital": 10000.0, "lot_size": 0.0 } }
};

function ensureConfigFile() {
  if (!fs.existsSync(CONFIG_FILE)) {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIGS, null, 2), 'utf8');
  }
}

export async function GET() {
  try {
    ensureConfigFile();
    const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    ensureConfigFile();
    const body = await request.json();
    const { symbol, currency, mode, capital, lot_size } = body;
    
    if (!symbol || !mode) {
      return NextResponse.json({ error: 'Missing symbol or mode' }, { status: 400 });
    }
    
    const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    
    if (!data[symbol]) {
      data[symbol] = {
        currency: currency || 'INR',
        sim: { capital: 10000.0, lot_size: 0.0 },
        live: { capital: 10000.0, lot_size: 0.0 }
      };
    }
    
    if (currency) data[symbol].currency = currency;
    
    if (mode === 'sim' || mode === 'live') {
      if (typeof capital === 'number') data[symbol][mode].capital = capital;
      if (typeof lot_size === 'number') data[symbol][mode].lot_size = lot_size;
    }
    
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf8');
    return NextResponse.json({ status: 'ok', data: data[symbol] });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
