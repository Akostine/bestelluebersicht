// src/app/api/test/route.js (or .ts)
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    message: 'API is working',
    time: new Date().toISOString()
  });
}