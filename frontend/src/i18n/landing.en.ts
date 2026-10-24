// Welcome-page copy is isolated from layout. Add reviewed translations before enabling a locale.
export const landingEnglish = {
  brand: "Student Task Manager",
  skip: "Skip to content",
  navigation: "Welcome navigation",
  featuresLink: "Features",
  previewLink: "Your workspace",
  signIn: "Sign in",
  eyebrow: "A little structure. A lot more space.",
  headlineStart: "Less chaos.",
  headlineEnd: "More progress.",
  introduction:
    "Bring your courses, assignments, and deadlines into one calm workspace. Spend less time keeping track, and more time moving forward.",
  getStarted: "Get started",
  googleNote: "Continue securely with Google.",
  connecting: "Connecting to Google…",
  signInFailed: "Unable to open Google sign-in. Please try again.",
  unavailable:
    "Sign-in is unavailable in this environment. Please try again later.",
  previewLabel: "An illustrative student dashboard",
  previewCaption: "Illustrative preview · Sample data only",
  preview: {
    workspace: "My workspace",
    overview: "Overview",
    courses: "Courses",
    calendar: "Calendar",
    greeting: "A clearer picture of your week.",
    subheading: "A few small steps. Steady progress.",
    stats: [
      { label: "Tasks this week", value: "08" },
      { label: "Completed", value: "05" },
      { label: "Upcoming", value: "03" },
    ],
    taskHeading: "Next up",
    taskHint: "One thing at a time",
    courseHeading: "Your courses",
    tasks: [
      {
        title: "Read chapter 04",
        course: "Literature",
        due: "Tomorrow",
        complete: false,
      },
      {
        title: "Refine project outline",
        course: "Design foundations",
        due: "Thursday",
        complete: false,
      },
      {
        title: "Review practice questions",
        course: "Mathematics",
        due: "Completed",
        complete: true,
      },
    ],
    courseItems: [
      { name: "Literature", code: "ENG 201" },
      { name: "Design foundations", code: "DES 102" },
      { name: "Mathematics", code: "MATH 201" },
    ],
  },
  featuresEyebrow: "Less to manage. More room to think.",
  featuresHeading: "Built around your student life.",
  featuresIntroduction:
    "Simple tools for the work in front of you. Nothing extra to get in the way.",
  features: [
    {
      number: "01",
      title: "A home for every course.",
      description:
        "Keep each course and its coursework together. Find what you need without retracing your steps.",
    },
    {
      number: "02",
      title: "Every assignment, accounted for.",
      description:
        "Give homeworks, exams, finals, projects, and presentations a place. Set priorities and see your progress, one task at a time.",
    },
    {
      number: "03",
      title: "Deadlines, in perspective.",
      description:
        "See upcoming work on your dashboard and calendar. Plan your days with deadlines shown in your chosen timezone.",
    },
  ],
  closingEyebrow: "Make space for your next step.",
  closingHeading: "A calmer way to keep going.",
  closingBody:
    "Your semester is full enough. Give your plans a little breathing room.",
  closingAction: "Start planning",
  footerNote: "Made for the way students work.",
  backToTop: "Back to top",
};
export type LandingMessages = typeof landingEnglish;
