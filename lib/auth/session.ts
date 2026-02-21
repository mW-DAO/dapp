import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const secretKey = process.env.SESSION_SECRET || "default-secret-key-change-me";
const encodedKey = new TextEncoder().encode(secretKey);

type SessionPayload = {
  address: string;
  expiresAt: Date;
};

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedKey);
}

export async function decrypt(session: string | undefined = "") {
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch (error) {
    console.log("Failed to verify session");
    return null;
  }
}

export async function createSession(address: string) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const normalizedAddress = address.toLowerCase();
  const session = await encrypt({ address: normalizedAddress, expiresAt });

  const cookieStore = await cookies();
  cookieStore.set("auth_token", session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete("auth_token");
}

export async function getSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get("auth_token")?.value;
  const payload = await decrypt(session);

  if (!session || !payload) {
    return null;
  }

  return payload;
}
