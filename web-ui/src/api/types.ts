import { z } from 'zod';

export const Device = z.object({
  ip: z.string(),
  name: z.string().nullable().optional(),
  dns: z.string().nullable().optional(),
  vendor: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  chassis_model: z.string().nullable().optional(),
  os: z.string().nullable().optional(),
  os_ver: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  contact: z.string().nullable().optional(),
  serial: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  uptime: z.number().nullable().optional(),
  creation: z.string().nullable().optional(),
  layers: z.string().nullable().optional(),
  num_ports: z.number().nullable().optional(),
  mac: z.string().nullable().optional(),
  chassis_id: z.string().nullable().optional(),
  ps1_type: z.string().nullable().optional(),
  ps2_type: z.string().nullable().optional(),
  ps1_status: z.string().nullable().optional(),
  ps2_status: z.string().nullable().optional(),
  fan: z.string().nullable().optional(),
  slots: z.number().nullable().optional(),
  snmp_ver: z.number().nullable().optional(),
  snmp_class: z.string().nullable().optional(),
  snmp_engineid: z.string().nullable().optional(),
  vtp_domain: z.string().nullable().optional(),
  vtp_mode: z.string().nullable().optional(),
  last_discover: z.string().nullable().optional(),
  last_macsuck: z.string().nullable().optional(),
  last_arpnip: z.string().nullable().optional(),
  is_pseudo: z.union([z.boolean(), z.number()]).nullable().optional(),
  pae_is_enabled: z.union([z.boolean(), z.number()]).nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
}).passthrough();
export type Device = z.infer<typeof Device>;

export const DeviceListResponse = z.object({
  devices: z.array(Device),
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
});
export type DeviceListResponse = z.infer<typeof DeviceListResponse>;

export const DeviceDetails = Device.extend({
  counts: z.object({
    ports: z.number(),
    nodes: z.number(),
    vlans: z.number(),
    modules: z.number(),
  }),
});
export type DeviceDetails = z.infer<typeof DeviceDetails>;

export const Port = z.object({
  port: z.string(),
  up_admin: z.string().nullable().optional(),
  up: z.string().nullable().optional(),
  speed: z.string().nullable().optional(),
  vlan: z.union([z.number(), z.string()]).nullable().optional(),
  name: z.string().nullable().optional(),
  remote_id: z.string().nullable().optional(),
  remote_port: z.string().nullable().optional(),
  remote_type: z.string().nullable().optional(),
}).passthrough();
export type Port = z.infer<typeof Port>;

export const NodeRow = z.object({
  mac: z.string(),
  switch: z.string().nullable().optional(),
  port: z.string().nullable().optional(),
  vlan: z.union([z.number(), z.string()]).nullable().optional(),
  time_first: z.string().nullable().optional(),
  time_last: z.string().nullable().optional(),
}).passthrough();
export type NodeRow = z.infer<typeof NodeRow>;

export const VlanRow = z.object({
  vlan: z.union([z.number(), z.string()]),
  description: z.string().nullable().optional(),
}).passthrough();
export type VlanRow = z.infer<typeof VlanRow>;

export const ModuleRow = z.object({
  index: z.union([z.number(), z.string()]),
  type: z.string().nullable().optional(),
  serial: z.string().nullable().optional(),
  fw: z.string().nullable().optional(),
  fw_ver: z.string().nullable().optional(),
  class: z.string().nullable().optional(),
  parent: z.union([z.number(), z.string()]).nullable().optional(),
  name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  hw_ver: z.string().nullable().optional(),
  sw_ver: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  fru: z.union([z.number(), z.boolean()]).nullable().optional(),
  pos: z.union([z.number(), z.string()]).nullable().optional(),
}).passthrough();
export type ModuleRow = z.infer<typeof ModuleRow>;

export const PortLogEntry = z.object({
  creation: z.string(),
  ip: z.string(),
  port: z.string().nullable(),
  action: z.string().nullable(),
  username: z.string().nullable(),
  reason: z.string().nullable(),
  log: z.string().nullable(),
}).passthrough();
export type PortLogEntry = z.infer<typeof PortLogEntry>;

export const AddressRow = z.object({
  ip: z.string(),
  dns: z.string().nullable().optional(),
  port: z.string().nullable().optional(),
  subnet: z.string().nullable().optional(),
  alias: z.string().nullable().optional(),
  creation: z.string().nullable().optional(),
}).passthrough();
export type AddressRow = z.infer<typeof AddressRow>;

export const NeighborRow = z.object({
  local_ip: z.string().optional(),
  remote_ip: z.string().nullable().optional(),
  local_port: z.string().nullable().optional(),
  remote_port: z.string().nullable().optional(),
  remote_type: z.string().nullable().optional(),
  remote_id: z.string().nullable().optional(),
}).passthrough();
export type NeighborRow = z.infer<typeof NeighborRow>;

// Rich neighbor from /object/device/:ip/neighbors (Util::Topology). One entry
// per neighbor device, with one or more links (ports) to it.
export const NeighborLink = z.object({
  local_port: z.string().nullable().optional(),
  remote_port: z.string().nullable().optional(),
  remote_id: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
}).passthrough();
export const DeviceNeighbor = z.object({
  ip: z.string(),
  dns: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  vendor: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  os: z.string().nullable().optional(),
  serial: z.string().nullable().optional(),
  layers: z.string().nullable().optional(),
  discovered: z.boolean().optional(),
  links: z.array(NeighborLink).default([]),
}).passthrough();
export type DeviceNeighbor = z.infer<typeof DeviceNeighbor>;

export const NeighborsResponse = z.object({
  device: z.record(z.string(), z.unknown()).optional(),
  neighbors: z.array(DeviceNeighbor).default([]),
}).passthrough();

// device_port_properties row (LLDP neighbor inventory + 802.1X + flags).
export const PortProperties = z.record(z.string(), z.unknown());
export type PortProperties = Record<string, unknown>;

// A PoE-capable port from /object/device/:ip/powered_ports.
export const PoePort = z.object({
  port: z.string(),
  admin: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  class: z.string().nullable().optional(),
  power: z.number().nullable().optional(),
}).passthrough();
export type PoePort = z.infer<typeof PoePort>;

// Resolution of an arbitrary IP (e.g. a traceroute hop) against the DB.
export const IpContext = z.object({
  ip: z.string(),
  kind: z.enum(['device', 'device-interface', 'host', 'unknown']),
  device: z.object({
    ip: z.string(), name: z.string().nullable().optional(), dns: z.string().nullable().optional(),
    vendor: z.string().nullable().optional(), model: z.string().nullable().optional(),
    os: z.string().nullable().optional(), os_ver: z.string().nullable().optional(),
  }).passthrough().nullable().optional(),
  port: z.string().nullable().optional(),
  dns: z.string().nullable().optional(),
  subnet: z.string().nullable().optional(),
  mac: z.string().optional(),
  switch: z.string().nullable().optional(),
  vlan: z.union([z.string(), z.number()]).nullable().optional(),
  active: z.boolean().optional(),
  last_seen: z.string().nullable().optional(),
  vrf: z.string().nullable().optional(),
}).passthrough();
export type IpContext = z.infer<typeof IpContext>;

export const Health = z.object({
  status: z.string(),
  db: z.string().optional(),
  workers: z.number().optional(),
  backends: z.number().optional(),
}).passthrough();
export type Health = z.infer<typeof Health>;
