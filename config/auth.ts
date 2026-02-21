export const PUBLIC_ROUTES = ["/", "/node", "/login", "/api/feed", "/api/node"];

export const isPublicRoute = (pathname: string) => {
  const isMatch = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (pathname.includes("favicon.ico") || pathname.startsWith("/_next")) {
    return true;
  }

  return isMatch;
};
