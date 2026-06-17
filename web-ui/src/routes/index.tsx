import { createBrowserRouter, Navigate } from 'react-router';
import { Shell } from '@/components/layout/shell';
import { Dashboard } from './dashboard';
import { Devices } from './devices';
import { Inventory } from './inventory';
import { DeviceDetail } from './device-detail';
import { DeviceDetails } from './device-tabs/details';
import { DevicePorts } from './device-tabs/ports';
import { DeviceNodes } from './device-tabs/nodes';
import { DeviceVlans } from './device-tabs/vlans';
import { DeviceModules } from './device-tabs/modules';
import { DeviceAddresses } from './device-tabs/addresses';
import { DeviceNeighbors } from './device-tabs/neighbors';
import { DeviceLog } from './device-tabs/log';
import { NodeDetail } from './node-detail';
import { NodeHistory } from './node-history';
import { NotFound } from './not-found';
import { LoginRedirect } from './login-redirect';
import { Reports } from './reports';
import { ReportDetail } from './report-detail';
import { SearchPage } from './search';
import { TraceroutePage } from './traceroute';
import { TopologyPage } from './topology';
import { AdminShell } from './admin';
import { AdminActions } from './admin/actions';
import { AdminImport } from './admin/import';
import { AdminJobs } from './admin/jobs';
import { AdminUsers } from './admin/users';
import { AdminApiKeys } from './admin/api-keys';
import { AdminSettingsSnmp } from './admin/settings-snmp';
import { AdminSettingsSchedules } from './admin/settings-schedules';
import { AdminSettingsBranding } from './admin/settings-branding';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'devices', element: <Devices /> },
      { path: 'inventory', element: <Inventory /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'traceroute', element: <TraceroutePage /> },
      { path: 'topology', element: <TopologyPage /> },
      {
        path: 'devices/:ip',
        element: <DeviceDetail />,
        children: [
          { index: true, element: <Navigate to="details" replace /> },
          { path: 'details', element: <DeviceDetails /> },
          { path: 'ports', element: <DevicePorts /> },
          { path: 'nodes', element: <DeviceNodes /> },
          { path: 'addresses', element: <DeviceAddresses /> },
          { path: 'neighbors', element: <DeviceNeighbors /> },
          { path: 'vlans', element: <DeviceVlans /> },
          { path: 'modules', element: <DeviceModules /> },
          { path: 'log', element: <DeviceLog /> },
        ],
      },
      { path: 'nodes/:mac', element: <NodeDetail /> },
      { path: 'nodes/:mac/history', element: <NodeHistory /> },
      { path: 'reports', element: <Reports /> },
      { path: 'reports/:category/:tag', element: <ReportDetail /> },
      {
        path: 'admin',
        element: <AdminShell />,
        children: [
          { index: true, element: <Navigate to="/admin/actions" replace /> },
          { path: 'actions', element: <AdminActions /> },
          { path: 'import', element: <AdminImport /> },
          { path: 'jobs', element: <AdminJobs /> },
          { path: 'snmp', element: <AdminSettingsSnmp /> },
          { path: 'schedules', element: <AdminSettingsSchedules /> },
          { path: 'users', element: <AdminUsers /> },
          { path: 'api-keys', element: <AdminApiKeys /> },
          { path: 'branding', element: <AdminSettingsBranding /> },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
  // Standalone full-page login (no Shell chrome — no sidebar/topbar).
  { path: '/login', element: <LoginRedirect /> },
]);
