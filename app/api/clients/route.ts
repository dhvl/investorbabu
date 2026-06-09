import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const DATA_DIR = process.env.LOG_FILE_PATH 
  ? path.dirname(process.env.LOG_FILE_PATH) 
  : '/home/investo/bluecandle';

const FLASK_URL = 'https://api.investorbabu.com/api/clients';

export async function GET() {
  try {
    // Try requesting Flask server first
    const response = await fetch(FLASK_URL, { cache: 'no-store', next: { revalidate: 0 } });
    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data);
    }
  } catch (err) {
    console.warn("Flask get_clients failed, falling back to direct file read:", err);
  }

  // Fallback direct file read
  try {
    const clientsPath = path.join(DATA_DIR, 'clients.json');
    const pendingPath = path.join(DATA_DIR, 'pending_clients.json');

    let clients = {};
    if (fs.existsSync(clientsPath)) {
      clients = JSON.parse(fs.readFileSync(clientsPath, 'utf8'));
    }

    let pending = {};
    if (fs.existsSync(pendingPath)) {
      pending = JSON.parse(fs.readFileSync(pendingPath, 'utf8'));
    }

    return NextResponse.json({
      status: "ok",
      clients,
      pending
    });
  } catch (error) {
    return NextResponse.json({ status: "error", message: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, ...payload } = body; // action: 'approve' | 'update' | 'delete'

    let endpoint = FLASK_URL;
    if (action === 'approve') endpoint += '/approve';
    else if (action === 'update') endpoint += '/update';
    else if (action === 'delete') endpoint += '/delete';
    else {
      return NextResponse.json({ status: "error", message: "Invalid action" }, { status: 400 });
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Flask backend returned status ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to execute clients action:", error);
    return NextResponse.json({ status: "error", message: String(error) }, { status: 500 });
  }
}
