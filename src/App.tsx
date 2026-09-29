import { createBrowserRouter, Navigate, RouterProvider, useParams } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { Layout } from "./app/Layout";
import { SessionProvider } from "./app/session";
import { db } from "./db/db";
import { Dashboard } from "./pages/Dashboard";
import { Help } from "./pages/Help";
import { SettingsPage } from "./pages/Settings";
import { Styleguide } from "./pages/Styleguide";
import { Workspace } from "./pages/Workspace";

function LatestVersion() {
  const { assetId } = useParams();
  const asset = useLiveQuery(() => (assetId ? db.assets.get(assetId) : undefined), [assetId], null);
  if (asset === null) return null;
  if (!asset) return <Navigate to="/" replace />;
  return <Navigate to={`/a/${asset.id}/v/${asset.latestVersionId}`} replace />;
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "a/:assetId", element: <LatestVersion /> },
      { path: "a/:assetId/v/:versionId/:step?", element: <Workspace /> },
      { path: "hilfe", element: <Help /> },
      { path: "einstellungen", element: <SettingsPage /> },
      { path: "styleguide", element: <Styleguide /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);

export function App() {
  return (
    <SessionProvider>
      <RouterProvider router={router} />
    </SessionProvider>
  );
}
