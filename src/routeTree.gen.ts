// src/routeTree.gen.ts
import { Route as rootRouteImport } from './routes/__root'
import { Route as RegisterRouteImport } from './routes/register'
import { Route as LoginRouteImport } from './routes/login'
import { Route as AuthenticatedRouteImport } from './routes/_authenticated'
import { Route as IndexRouteImport } from './routes/index'
import { Route as AuthenticatedWeatherRouteImport } from './routes/_authenticated/weather'
import { Route as AuthenticatedProfileRouteImport } from './routes/_authenticated/profile'
import { Route as AuthenticatedPlantsRouteImport } from './routes/_authenticated/plants'
import { Route as AuthenticatedPlantDoctorRouteImport } from './routes/_authenticated/plant-doctor'
import { Route as AuthenticatedMarketplaceRouteImport } from './routes/_authenticated/marketplace'
import { Route as AuthenticatedDashboardRouteImport } from './routes/_authenticated/dashboard'
import { Route as AuthenticatedCommunityRouteImport } from './routes/_authenticated/community'
import { Route as AuthenticatedAssistantRouteImport } from './routes/_authenticated/assistant'
import { Route as AuthenticatedArticlesRouteImport } from './routes/_authenticated/articles'
import { Route as AuthenticatedAnalyticsRouteImport } from './routes/_authenticated/analytics'
import { Route as AuthenticatedAdminRouteImport } from './routes/_authenticated/admin'

const RegisterRoute = RegisterRouteImport.update({
  id: '/register',
  path: '/register',
  getParentRoute: () => rootRouteImport,
} as any)
const LoginRoute = LoginRouteImport.update({
  id: '/login',
  path: '/login',
  getParentRoute: () => rootRouteImport,
} as any)
const AuthenticatedRoute = AuthenticatedRouteImport.update({
  id: '/_authenticated',
  getParentRoute: () => rootRouteImport,
} as any)
const IndexRoute = IndexRouteImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRouteImport,
} as any)
const AuthenticatedWeatherRoute = AuthenticatedWeatherRouteImport.update({
  id: '/weather',
  path: '/weather',
  getParentRoute: () => AuthenticatedRoute,
} as any)
const AuthenticatedProfileRoute = AuthenticatedProfileRouteImport.update({
  id: '/profile',
  path: '/profile',
  getParentRoute: () => AuthenticatedRoute,
} as any)
const AuthenticatedPlantsRoute = AuthenticatedPlantsRouteImport.update({
  id: '/plants',
  path: '/plants',
  getParentRoute: () => AuthenticatedRoute,
} as any)
const AuthenticatedPlantDoctorRoute =
  AuthenticatedPlantDoctorRouteImport.update({
    id: '/plant-doctor',
    path: '/plant-doctor',
    getParentRoute: () => AuthenticatedRoute,
  } as any)
const AuthenticatedMarketplaceRoute =
  AuthenticatedMarketplaceRouteImport.update({
    id: '/marketplace',
    path: '/marketplace',
    getParentRoute: () => AuthenticatedRoute,
  } as any)
const AuthenticatedDashboardRoute = AuthenticatedDashboardRouteImport.update({
  id: '/dashboard',
  path: '/dashboard',
  getParentRoute: () => AuthenticatedRoute,
} as any)
const AuthenticatedCommunityRoute = AuthenticatedCommunityRouteImport.update({
  id: '/community',
  path: '/community',
  getParentRoute: () => AuthenticatedRoute,
} as any)
const AuthenticatedAssistantRoute = AuthenticatedAssistantRouteImport.update({
  id: '/assistant',
  path: '/assistant',
  getParentRoute: () => AuthenticatedRoute,
} as any)
const AuthenticatedArticlesRoute = AuthenticatedArticlesRouteImport.update({
  id: '/articles',
  path: '/articles',
  getParentRoute: () => AuthenticatedRoute,
} as any)
const AuthenticatedAnalyticsRoute = AuthenticatedAnalyticsRouteImport.update({
  id: '/analytics',
  path: '/analytics',
  getParentRoute: () => AuthenticatedRoute,
} as any)
const AuthenticatedAdminRoute = AuthenticatedAdminRouteImport.update({
  id: '/admin',
  path: '/admin',
  getParentRoute: () => AuthenticatedRoute,
} as any)

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/login': typeof LoginRoute
  '/register': typeof RegisterRoute
  '/admin': typeof AuthenticatedAdminRoute
  '/analytics': typeof AuthenticatedAnalyticsRoute
  '/articles': typeof AuthenticatedArticlesRoute
  '/assistant': typeof AuthenticatedAssistantRoute
  '/community': typeof AuthenticatedCommunityRoute
  '/dashboard': typeof AuthenticatedDashboardRoute
  '/marketplace': typeof AuthenticatedMarketplaceRoute
  '/market': typeof AuthenticatedMarketplaceRoute
  '/plant-doctor': typeof AuthenticatedPlantDoctorRoute
  '/plants': typeof AuthenticatedPlantsRoute
  '/profile': typeof AuthenticatedProfileRoute
  '/weather': typeof AuthenticatedWeatherRoute
}
export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/login': typeof LoginRoute
  '/register': typeof RegisterRoute
  '/admin': typeof AuthenticatedAdminRoute
  '/analytics': typeof AuthenticatedAnalyticsRoute
  '/articles': typeof AuthenticatedArticlesRoute
  '/assistant': typeof AuthenticatedAssistantRoute
  '/community': typeof AuthenticatedCommunityRoute
  '/dashboard': typeof AuthenticatedDashboardRoute
  '/marketplace': typeof AuthenticatedMarketplaceRoute
  '/plant-doctor': typeof AuthenticatedPlantDoctorRoute
  '/plants': typeof AuthenticatedPlantsRoute
  '/profile': typeof AuthenticatedProfileRoute
  '/weather': typeof AuthenticatedWeatherRoute
}
export interface FileRoutesById {
  __root__: typeof rootRouteImport
  '/': typeof IndexRoute
  '/_authenticated': typeof AuthenticatedRouteWithChildren
  '/login': typeof LoginRoute
  '/register': typeof RegisterRoute
  '/_authenticated/admin': typeof AuthenticatedAdminRoute
  '/_authenticated/analytics': typeof AuthenticatedAnalyticsRoute
  '/_authenticated/articles': typeof AuthenticatedArticlesRoute
  '/_authenticated/assistant': typeof AuthenticatedAssistantRoute
  '/_authenticated/community': typeof AuthenticatedCommunityRoute
  '/_authenticated/dashboard': typeof AuthenticatedDashboardRoute
  '/_authenticated/marketplace': typeof AuthenticatedMarketplaceRoute
  '/_authenticated/plant-doctor': typeof AuthenticatedPlantDoctorRoute
  '/_authenticated/plants': typeof AuthenticatedPlantsRoute
  '/_authenticated/profile': typeof AuthenticatedProfileRoute
  '/_authenticated/weather': typeof AuthenticatedWeatherRoute
}
export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths:
    | '/'
    | '/login'
    | '/register'
    | '/admin'
    | '/analytics'
    | '/articles'
    | '/assistant'
    | '/community'
    | '/dashboard'
    | '/marketplace'
    | '/plant-doctor'
    | '/plants'
    | '/profile'
    | '/weather'
  fileRoutesByTo: FileRoutesByTo
  to:
    | '/'
    | '/login'
    | '/register'
    | '/admin'
    | '/analytics'
    | '/articles'
    | '/assistant'
    | '/community'
    | '/dashboard'
    | '/marketplace'
    | '/plant-doctor'
    | '/plants'
    | '/profile'
    | '/weather'
  id:
    | '__root__'
    | '/'
    | '/_authenticated'
    | '/login'
    | '/register'
    | '/_authenticated/admin'
    | '/_authenticated/analytics'
    | '/_authenticated/articles'
    | '/_authenticated/assistant'
    | '/_authenticated/community'
    | '/_authenticated/dashboard'
    | '/_authenticated/marketplace'
    | '/_authenticated/plant-doctor'
    | '/_authenticated/plants'
    | '/_authenticated/profile'
    | '/_authenticated/weather'
  fileRoutesById: FileRoutesById
}
export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  AuthenticatedRoute: typeof AuthenticatedRouteWithChildren
  LoginRoute: typeof LoginRoute
  RegisterRoute: typeof RegisterRoute
}

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/register': {
      id: '/register'
      path: '/register'
      fullPath: '/register'
      preLoaderRoute: typeof RegisterRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/login': {
      id: '/login'
      path: '/login'
      fullPath: '/login'
      preLoaderRoute: typeof LoginRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/_authenticated': {
      id: '/_authenticated'
      path: ''
      fullPath: '/'
      preLoaderRoute: typeof AuthenticatedRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/': {
      id: '/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof IndexRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/_authenticated/weather': {
      id: '/_authenticated/weather'
      path: '/weather'
      fullPath: '/weather'
      preLoaderRoute: typeof AuthenticatedWeatherRouteImport
      parentRoute: typeof AuthenticatedRoute
    }
    '/_authenticated/profile': {
      id: '/_authenticated/profile'
      path: '/profile'
      fullPath: '/profile'
      preLoaderRoute: typeof AuthenticatedProfileRouteImport
      parentRoute: typeof AuthenticatedRoute
    }
    '/_authenticated/plants': {
      id: '/_authenticated/plants'
      path: '/plants'
      fullPath: '/plants'
      preLoaderRoute: typeof AuthenticatedPlantsRouteImport
      parentRoute: typeof AuthenticatedRoute
    }
    '/_authenticated/plant-doctor': {
      id: '/_authenticated/plant-doctor'
      path: '/plant-doctor'
      fullPath: '/plant-doctor'
      preLoaderRoute: typeof AuthenticatedPlantDoctorRouteImport
      parentRoute: typeof AuthenticatedRoute
    }
    '/_authenticated/marketplace': {
      id: '/_authenticated/marketplace'
      path: '/marketplace'
      fullPath: '/marketplace'
      preLoaderRoute: typeof AuthenticatedMarketplaceRouteImport
      parentRoute: typeof AuthenticatedRoute
    }
    '/_authenticated/dashboard': {
      id: '/_authenticated/dashboard'
      path: '/dashboard'
      fullPath: '/dashboard'
      preLoaderRoute: typeof AuthenticatedDashboardRouteImport
      parentRoute: typeof AuthenticatedRoute
    }
    '/_authenticated/community': {
      id: '/_authenticated/community'
      path: '/community'
      fullPath: '/community'
      preLoaderRoute: typeof AuthenticatedCommunityRouteImport
      parentRoute: typeof AuthenticatedRoute
    }
    '/_authenticated/assistant': {
      id: '/_authenticated/assistant'
      path: '/assistant'
      fullPath: '/assistant'
      preLoaderRoute: typeof AuthenticatedAssistantRouteImport
      parentRoute: typeof AuthenticatedRoute
    }
    '/_authenticated/articles': {
      id: '/_authenticated/articles'
      path: '/articles'
      fullPath: '/articles'
      preLoaderRoute: typeof AuthenticatedArticlesRouteImport
      parentRoute: typeof AuthenticatedRoute
    }
    '/_authenticated/analytics': {
      id: '/_authenticated/analytics'
      path: '/analytics'
      fullPath: '/analytics'
      preLoaderRoute: typeof AuthenticatedAnalyticsRouteImport
      parentRoute: typeof AuthenticatedRoute
    }
    '/_authenticated/admin': {
      id: '/_authenticated/admin'
      path: '/admin'
      fullPath: '/admin'
      preLoaderRoute: typeof AuthenticatedAdminRouteImport
      parentRoute: typeof AuthenticatedRoute
    }
  }
}

interface AuthenticatedRouteChildren {
  AuthenticatedAdminRoute: typeof AuthenticatedAdminRoute
  AuthenticatedAnalyticsRoute: typeof AuthenticatedAnalyticsRoute
  AuthenticatedArticlesRoute: typeof AuthenticatedArticlesRoute
  AuthenticatedAssistantRoute: typeof AuthenticatedAssistantRoute
  AuthenticatedCommunityRoute: typeof AuthenticatedCommunityRoute
  AuthenticatedDashboardRoute: typeof AuthenticatedDashboardRoute
  AuthenticatedMarketplaceRoute: typeof AuthenticatedMarketplaceRoute
  AuthenticatedPlantDoctorRoute: typeof AuthenticatedPlantDoctorRoute
  AuthenticatedPlantsRoute: typeof AuthenticatedPlantsRoute
  AuthenticatedProfileRoute: typeof AuthenticatedProfileRoute
  AuthenticatedWeatherRoute: typeof AuthenticatedWeatherRoute
}

const AuthenticatedRouteChildren: AuthenticatedRouteChildren = {
  AuthenticatedAdminRoute: AuthenticatedAdminRoute,
  AuthenticatedAnalyticsRoute: AuthenticatedAnalyticsRoute,
  AuthenticatedArticlesRoute: AuthenticatedArticlesRoute,
  AuthenticatedAssistantRoute: AuthenticatedAssistantRoute,
  AuthenticatedCommunityRoute: AuthenticatedCommunityRoute,
  AuthenticatedDashboardRoute: AuthenticatedDashboardRoute,
  AuthenticatedMarketplaceRoute: AuthenticatedMarketplaceRoute,
  AuthenticatedPlantDoctorRoute: AuthenticatedPlantDoctorRoute,
  AuthenticatedPlantsRoute: AuthenticatedPlantsRoute,
  AuthenticatedProfileRoute: AuthenticatedProfileRoute,
  AuthenticatedWeatherRoute: AuthenticatedWeatherRoute,
}

const AuthenticatedRouteWithChildren = AuthenticatedRoute._addFileChildren(
  AuthenticatedRouteChildren,
)

const rootRouteChildren: RootRouteChildren = {
  IndexRoute: IndexRoute,
  AuthenticatedRoute: AuthenticatedRouteWithChildren,
  LoginRoute: LoginRoute,
  RegisterRoute: RegisterRoute,
}
export const routeTree = rootRouteImport
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()
