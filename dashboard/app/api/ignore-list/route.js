import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

// ড্যাশবোর্ড ফোল্ডারের রুট ডিরেক্টরিতে ignore-list.json সেভ হবে
const ignoreListPath = path.join(process.cwd(), 'ignore-list.json');

export async function GET() {
    if (!fs.existsSync(ignoreListPath)) {
        fs.writeFileSync(ignoreListPath, JSON.stringify([]));
    }
    const data = fs.readFileSync(ignoreListPath, 'utf8');
    return NextResponse.json(JSON.parse(data));
}

export async function POST(req) {
    const { action, email } = await req.json();
    let list = [];
    
    if (fs.existsSync(ignoreListPath)) {
        list = JSON.parse(fs.readFileSync(ignoreListPath, 'utf8'));
    }

    const cleanEmail = email?.trim().toLowerCase();

    if (action === 'add' && cleanEmail) {
        if (!list.includes(cleanEmail)) list.push(cleanEmail);
    } else if (action === 'remove' && cleanEmail) {
        list = list.filter(e => e !== cleanEmail);
    }

    fs.writeFileSync(ignoreListPath, JSON.stringify(list, null, 2));
    return NextResponse.json(list);
}