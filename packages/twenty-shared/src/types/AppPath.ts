export enum AppPath {
  // Not logged-in
  Verify = '/verify',
  VerifyEmail = '/verify-email',
  SignInUp = '/welcome',
  Invite = '/invite/:workspaceInviteHash',
  ResetPassword = '/reset-password/:passwordResetToken',

  // Onboarding
  WorkspaceActivation = '/workspace-activation',
  CreateProfile = '/create/profile',
  SyncEmails = '/sync/emails',
  InstallApps = '/install-apps',
  InviteTeam = '/invite-team',
  PlanRequired = '/plan-required',
  PlanRequiredSuccess = '/plan-required/payment-success',
  BookCall = '/book-call',

  // Onboarded
  AiChat = '/chat/:threadId?',
  Index = '/',
  // Mobile only: the navigation menu is a page there rather than a drawer.
  Home = '/home',
  TasksPage = '/objects/tasks',
  OpportunitiesPage = '/objects/opportunities',

  RecordIndexPage = '/objects/:objectNamePlural',
  RecordShowPage = '/object/:objectNameSingular/:objectRecordId',
  PageLayoutPage = '/page/:pageLayoutId',
  WorkflowCoreIndexPage = '/workflow-core',
  WorkflowCoreShowPage = '/workflow-core/:coreWorkflowId',

  Settings = `settings`,
  SettingsCatchAll = `/${Settings}/*`,
  Developers = `developers`,
  DevelopersCatchAll = `/${Developers}/*`,

  Authorize = '/authorize',

  // Deep link for twenty.com/dpa → in-app DPA generator (login-gated redirect).
  Dpa = '/dpa',

  // Built-in help centre. Same-origin and self-contained: the pages render local
  // content and never link out, so a help URL opened directly or refreshed stays
  // inside the app.
  Help = '/help',
  HelpArticle = '/help/:helpArticleSlug',

  // 404 page not found
  NotFoundWildcard = '*',
  NotFound = '/not-found',
}
