import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

// bot (index.js) এখন সরাসরি এই dashboard ফোল্ডারের ভেতরেই dashboard-data.json লেখে
const DATA_FILE = path.join(process.cwd(), 'dashboard-data.json');

export async function GET() {
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const data = JSON.parse(raw);
        return NextResponse.json({ ok: true, ...data });
    } catch (e) {
        return NextResponse.json({
            ok: false,
            message: 'dashboard-data.json পাওয়া যায়নি — বট (npm run dev) এখনো চালু হয়নি অথবা এখনো কোনো লগ তৈরি হয়নি।',
        });
    }
}