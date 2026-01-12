import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();

    if (!password) {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    // Get the hash - prefer ADMIN_PASSWORD_B64 (base64 encoded) for reliability
    const base64Hash = process.env.ADMIN_PASSWORD_B64;
    let hashedPassword = process.env.ADMIN_PASSWORD;
    
    // If ADMIN_PASSWORD_B64 is set, decode it (avoids $ character issues)
    if (base64Hash) {
      try {
        hashedPassword = Buffer.from(base64Hash, 'base64').toString('utf-8');
      } catch (error) {
        return NextResponse.json(
          { error: "Server configuration error. Failed to decode ADMIN_PASSWORD_B64." },
          { status: 500 }
        );
      }
    }
    
    if (!hashedPassword) {
      return NextResponse.json(
        { error: "Server configuration error. ADMIN_PASSWORD or ADMIN_PASSWORD_B64 not set." },
        { status: 500 }
      );
    }

    // Remove surrounding quotes if present
    hashedPassword = hashedPassword.trim();
    if (
      (hashedPassword.startsWith('"') && hashedPassword.endsWith('"')) ||
      (hashedPassword.startsWith("'") && hashedPassword.endsWith("'"))
    ) {
      hashedPassword = hashedPassword.slice(1, -1);
    }

    // Validate hash format
    if (!hashedPassword.startsWith("$2a$") && !hashedPassword.startsWith("$2b$") && !hashedPassword.startsWith("$2y$")) {
      return NextResponse.json(
        { error: "Server configuration error. Invalid password hash format." },
        { status: 500 }
      );
    }

    // Compare the provided password with the hashed password
    const isValid = await bcrypt.compare(password.trim(), hashedPassword);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 401 }
      );
    }

    // Set a secure cookie to indicate authentication
    const cookieStore = await cookies();
    cookieStore.set("admin-authenticated", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
