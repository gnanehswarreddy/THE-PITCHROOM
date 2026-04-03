export const ROUTES = {
  root: "/",
  home: "/home",
  login: "/login",
  signup: "/signup",
  selectRole: "/select-role",
  onboarding: "/onboarding",
  writerDashboard: "/writer/dashboard",
  producerDashboard: "/producer/dashboard",
} as const;

export const getDashboardRoute = (role?: string | null) => {
  if (role === "writer") return ROUTES.writerDashboard;
  if (role === "producer") return ROUTES.producerDashboard;
  return ROUTES.selectRole;
};

export const getPostAuthRoute = (role?: string | null, onboardingCompleted?: boolean | null) => {
  if (!role) return ROUTES.selectRole;
  if (!onboardingCompleted) return ROUTES.onboarding;
  return getDashboardRoute(role);
};
