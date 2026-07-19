import React from "react";
import ReactDOM from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import { ToastProvider } from "./lib/toast.jsx";

import SignIn from "./pages/SignIn.jsx";
import SignUp from "./pages/SignUp.jsx";
import Home from "./pages/Home.jsx";
import Review from "./pages/Review.jsx";
import Batch from "./pages/Batch.jsx";
import Audit from "./pages/Audit.jsx";
import Transactions from "./pages/Transactions.jsx";
import Settings from "./pages/Settings.jsx";

// Hash routing keeps every screen reachable from a static build with no server config.
// Review/Batch/Audit take a live run id — the id comes from the backend, not a mock.
// The no-id /review and /batch routes exist so the sidebar always lands on the
// actual page (showing a proper empty state) instead of redirecting elsewhere
// when no run currently qualifies.
const router = createHashRouter([
  { path: "/", element: <SignIn /> },
  { path: "/signup", element: <SignUp /> },
  { path: "/home", element: <Home /> },
  { path: "/review", element: <Review /> },
  { path: "/review/:runId", element: <Review /> },
  { path: "/batch", element: <Batch /> },
  { path: "/batch/:runId", element: <Batch /> },
  { path: "/audit/:runId", element: <Audit /> },
  { path: "/transactions", element: <Transactions /> },
  { path: "/settings", element: <Settings /> },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  </React.StrictMode>
);