import { api } from './client';
import { Device, DeviceListResponse, DeviceDetails, Port, NodeRow, VlanRow, ModuleRow, PortLogEntry, AddressRow, DeviceNeighbor, NeighborsResponse, PortProperties, PoePort, IpContext } from './types';
import { z } from 'zod';

// Resolve an arbitrary IP against the DB (device / device interface / host node).
export async function getIpContext(ip: string): Promise<IpContext> {
  const r = await api.get(`/object/ip/${encodeURIComponent(ip)}`);
  return IpContext.parse(r.data);
}

export async function listDevices(params: { page?: number; page_size?: number; sort?: string; q?: string } = {}): Promise<DeviceListResponse> {
  const r = await api.get('/devices', { params });
  return DeviceListResponse.parse(r.data);
}

export async function getDevice(ip: string): Promise<Device> {
  const r = await api.get(`/device/${ip}`);
  return Device.parse(r.data);
}

export async function getDeviceDetails(ip: string): Promise<DeviceDetails> {
  const r = await api.get(`/device/${ip}/details`);
  return DeviceDetails.parse(r.data);
}

export async function getDevicePorts(ip: string): Promise<Port[]> {
  const r = await api.get(`/device/${ip}/ports`);
  return z.object({ ports: z.array(Port) }).parse(r.data).ports;
}

export async function getDeviceNodes(ip: string): Promise<NodeRow[]> {
  const r = await api.get(`/device/${ip}/nodes`);
  return z.object({ nodes: z.array(NodeRow) }).parse(r.data).nodes;
}

export async function getDeviceVlans(ip: string): Promise<VlanRow[]> {
  const r = await api.get(`/device/${ip}/vlans`);
  return z.object({ vlans: z.array(VlanRow) }).parse(r.data).vlans;
}

export async function getDeviceModules(ip: string): Promise<ModuleRow[]> {
  const r = await api.get(`/device/${ip}/modules`);
  return z.object({ modules: z.array(ModuleRow) }).parse(r.data).modules;
}

export async function getDeviceLog(ip: string): Promise<PortLogEntry[]> {
  const r = await api.get(`/device/${ip}/log`);
  return z.object({ log: z.array(PortLogEntry) }).parse(r.data).log;
}

export async function getDeviceAddresses(ip: string): Promise<AddressRow[]> {
  const r = await api.get(`/object/device/${ip}/device_ips`);
  return z.array(AddressRow).parse(r.data);
}

export async function getDeviceNeighbors(ip: string): Promise<DeviceNeighbor[]> {
  const r = await api.get(`/object/device/${ip}/neighbors`);
  return NeighborsResponse.parse(r.data).neighbors;
}

// device_port_properties for one port: LLDP neighbor inventory + 802.1X + flags.
export async function getPortProperties(ip: string, port: string): Promise<PortProperties> {
  const r = await api.get(`/object/device/${ip}/port/${encodeURIComponent(port)}/properties`);
  return PortProperties.parse(r.data);
}

// PoE-capable ports for a device (device_port_power).
export async function getDevicePoweredPorts(ip: string): Promise<PoePort[]> {
  const r = await api.get(`/object/device/${ip}/powered_ports`);
  return z.array(PoePort).parse(r.data);
}
